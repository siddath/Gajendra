import { createHash } from "node:crypto";

import {
  MUTATION_PROTOCOL_VERSION,
  type DeckMutation,
  type DeckMutationRequest,
  type DeckMutationResult,
  type DeckSnapshot,
  type MutationErrorCode,
  type PriorityStore,
} from "../shared/contracts.js";
import { applyMutation, buildSnapshot } from "./domain.js";
import { hashIdempotencyKey } from "./idempotency.js";
import { GajendraStoreRepository } from "./store.js";
import { ThreadSourceRegistry, type SourceCollection } from "./thread-sources.js";
import { CODEX_PROVIDER_COLLECTION_ENVELOPE_MS } from "./codex-app-server.js";

type SourceRegistry = Pick<ThreadSourceRegistry, "collect" | "close">;
type MutationInput = DeckMutation | DeckMutationRequest;
type ValidationErrorCode = "unknown-thread" | "unknown-source" | "invalid-target";
type SourceCollectionCache = Map<string, SourceCollection>;
type MutationAttempt =
  | { retry: true }
  | { retry: false; result: DeckMutationResult; committedState?: PriorityStore; refreshSources: boolean };

const GENERATION_BUSY_MESSAGE = "Gajendra changed repeatedly while sources were loading. Refresh and retry.";
const MAX_GENERATION_RETRIES = 4;
/**
 * The maximum accepted Codex provider envelope is 60.75s: two 15s initialize attempts,
 * 0.75s bounded fallback teardown, a 20s thread page pass, and the hard-capped 10s runtime
 * enrichment. Add the initial 5s private store read and round up to a 70s service budget. The
 * native caller owns a separate margin for confirmation/transaction settling and process output.
 */
export const DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS =
  CODEX_PROVIDER_COLLECTION_ENVELOPE_MS + 9_250;

export type GajendraServiceOptions = {
  /**
   * Provider work is deliberately outside the store lock. The default is derived from the
   * accepted Codex provider bounds plus the initial store read; callers may still inject a tighter
   * explicit deadline for a host with a stricter latency contract.
   */
  generationDeadlineMs?: number;
  /** Optional bounded retry tuning; it cannot enlarge the fixed source-generation deadline. */
  maxGenerationRetries?: number;
  /** Deterministic clock seam for deadline regression tests; production uses Date.now. */
  now?: () => number;
};

export class GajendraService {
  private readonly generationDeadlineMs: number;
  private readonly maxGenerationRetries: number;
  private readonly now: () => number;

  constructor(
    private readonly store = new GajendraStoreRepository(),
    private readonly sources: SourceRegistry = new ThreadSourceRegistry(),
    options: GajendraServiceOptions = {},
  ) {
    // Do not derive this from staleLockMs: the Codex provider can legally outlive that recovery
    // marker while still staying bounded. An explicit caller deadline remains a tighter opt-in.
    this.now = options.now ?? Date.now;
    this.generationDeadlineMs = boundedPositive(
      options.generationDeadlineMs,
      DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS,
      DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS,
    );
    this.maxGenerationRetries = boundedPositive(
      options.maxGenerationRetries,
      Math.max(1, Math.floor(this.generationDeadlineMs / this.store.lockTimeoutMs)),
      MAX_GENERATION_RETRIES,
    );
  }

  async snapshot(): Promise<DeckSnapshot> {
    // Provider work stays outside the store lock, then the entire store generation is checked.
    // Source preferences alone are not enough: a concurrent writer can otherwise make returned
    // priority metadata and the source collection describe different store generations.
    const deadline = this.now() + this.generationDeadlineMs;
    const collections: SourceCollectionCache = new Map();
    let retries = 0;
    for (;;) {
      if (this.now() >= deadline) return this.safeAuthoritativeSnapshot();
      const state = await this.store.read();
      let collection: SourceCollection;
      try {
        collection = await this.collectForGeneration(state.sourcePreferences, collections, deadline);
      } catch (error) {
        if (error instanceof GenerationDeadlineError) return this.safeAuthoritativeSnapshot();
        throw error;
      }
      const confirmed = await this.store.read();
      if (confirmed.revision === state.revision) {
        return buildSnapshot(state, collection.threads, collection.sources, collection.error);
      }
      // The provider result depends on enabled sources, not priority ordering/collapse state. If
      // those preferences survived a concurrent write, derive the response from the confirmed
      // store generation without another slow provider call.
      if (sameSourcePreferences(confirmed.sourcePreferences, state.sourcePreferences)) {
        return buildSnapshot(confirmed, collection.threads, collection.sources, collection.error);
      }
      if (retries >= this.maxGenerationRetries || this.now() >= deadline) return this.safeAuthoritativeSnapshot();
      // A changed preference generation invalidates any older collection, even if a later toggle
      // happens to restore the same values. Only an unchanged generation may be coalesced.
      collections.clear();
      retries += 1;
    }
  }

  /** All writers enter here, whether they use the envelope or a legacy bare mutation shape. */
  async mutate(input: MutationInput): Promise<DeckMutationResult> {
    const request = normalizeRequest(input);
    const fingerprint = mutationFingerprint(request.mutation);
    const idempotencyKeyHash = request.idempotencyKey ? hashIdempotencyKey(request.idempotencyKey) : undefined;

    // Discovery stays outside the private mutation lock, but the complete store generation is
    // compared inside it. A changed source preference causes a fresh collection/retry; a priority
    // only write is safely derived from the transaction's current generation using the same
    // source collection, so it does not repeatedly invoke a slow provider.
    const deadline = this.now() + this.generationDeadlineMs;
    const collections: SourceCollectionCache = new Map();
    let retries = 0;
    for (;;) {
      if (this.now() >= deadline) return this.storeBusyResult();
      const stateForSources = await this.store.read();
      let collection: SourceCollection;
      try {
        collection = await this.collectForGeneration(stateForSources.sourcePreferences, collections, deadline);
      } catch (error) {
        if (error instanceof GenerationDeadlineError) return this.storeBusyResult();
        throw error;
      }
      const attempt = await this.store.transaction(async (current): Promise<{ value: MutationAttempt; next?: PriorityStore }> => {
        if (current.revision !== stateForSources.revision
          && !sameSourcePreferences(current.sourcePreferences, stateForSources.sourcePreferences)) {
          return { value: { retry: true } };
        }
        const snapshot = (state = current): DeckSnapshot => buildSnapshot(state, collection.threads, collection.sources, collection.error);
        const result = (value: DeckMutationResult, committedState?: PriorityStore): { value: MutationAttempt; next?: PriorityStore } => ({
          ...(committedState ? { next: committedState } : {}),
          value: {
            retry: false,
            result: value,
            ...(committedState ? { committedState } : {}),
            refreshSources: Boolean(committedState && request.mutation.type === "set-source-enabled"),
          },
        });
        const existingReceipt = idempotencyKeyHash
          ? current.idempotency.find((receipt) => receipt.keyHash === idempotencyKeyHash)
          : undefined;
        if (existingReceipt) {
          if (existingReceipt.fingerprint !== fingerprint) {
            return result(rejected(snapshot(), current.revision, "idempotency-key-reused"));
          }
          return result({
            protocolVersion: MUTATION_PROTOCOL_VERSION,
            outcome: "replayed",
            revision: current.revision,
            snapshot: snapshot(),
          });
        }

        if (request.expectedRevision !== undefined && request.expectedRevision !== current.revision) {
          return result(conflict(snapshot(), current.revision));
        }

        const validationError = validateMutation(current, request.mutation, collection);
        if (validationError) return result(rejected(snapshot(), current.revision, validationError));

        const next = applyMutation(current, request.mutation);
        next.revision = current.revision + 1;
        if (idempotencyKeyHash) {
          next.idempotency = [
            ...current.idempotency,
            { keyHash: idempotencyKeyHash, fingerprint, revision: next.revision },
          ].slice(-this.store.idempotencyLimit);
        }
        return result({
          protocolVersion: MUTATION_PROTOCOL_VERSION,
          outcome: "applied",
          revision: next.revision,
          snapshot: snapshot(next),
        }, next);
      });
      if (attempt.retry) {
        if (retries >= this.maxGenerationRetries || this.now() >= deadline) return this.storeBusyResult();
        collections.clear();
        retries += 1;
        continue;
      }
      if (attempt.refreshSources && attempt.committedState) {
        let refreshed: SourceCollection;
        try {
          refreshed = await this.collectForGeneration(attempt.committedState.sourcePreferences, collections, deadline);
        } catch (error) {
          if (error instanceof GenerationDeadlineError) {
            return {
              ...attempt.result,
              snapshot: this.safeSnapshotFromState(attempt.committedState),
            };
          }
          throw error;
        }
        return {
          ...attempt.result,
          snapshot: buildSnapshot(attempt.committedState, refreshed.threads, refreshed.sources, refreshed.error),
        };
      }
      return attempt.result;
    }
  }

  close(): Promise<void> {
    return this.sources.close();
  }

  private async collect(preferences: Record<string, boolean>): Promise<SourceCollection> {
    try {
      return await this.sources.collect(preferences);
    } catch {
      return { threads: [], sources: [], error: "Gajendra could not read the configured thread sources." };
    }
  }

  private async collectForGeneration(
    preferences: Record<string, boolean>,
    collections: SourceCollectionCache,
    deadline: number,
  ): Promise<SourceCollection> {
    const key = sourcePreferencesKey(preferences);
    const cached = collections.get(key);
    if (cached) return cached;
    const remaining = deadline - this.now();
    if (remaining <= 0) throw new GenerationDeadlineError();
    const collection = await completeBeforeDeadline(this.collect(preferences), remaining);
    // The timer protects real elapsed time; the injected clock makes a provider that resolves
    // after the absolute budget observable in deterministic tests as the same safe fallback.
    if (this.now() >= deadline) throw new GenerationDeadlineError();
    collections.set(key, collection);
    return collection;
  }

  private async safeAuthoritativeSnapshot(): Promise<DeckSnapshot> {
    return this.safeSnapshotFromState(await this.store.read());
  }

  private safeSnapshotFromState(state: PriorityStore): DeckSnapshot {
    return buildSnapshot(state, [], [], GENERATION_BUSY_MESSAGE);
  }

  private async storeBusyResult(): Promise<DeckMutationResult> {
    const snapshot = await this.safeAuthoritativeSnapshot();
    return {
      protocolVersion: MUTATION_PROTOCOL_VERSION,
      outcome: "rejected",
      revision: snapshot.revision,
      snapshot,
      error: { code: "store-busy", message: GENERATION_BUSY_MESSAGE },
    };
  }
}

class GenerationDeadlineError extends Error {}

function completeBeforeDeadline<T>(operation: Promise<T>, remainingMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new GenerationDeadlineError()), remainingMs);
    timeout.unref();
    void operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function sourcePreferencesKey(preferences: Record<string, boolean>): string {
  return JSON.stringify(Object.entries(preferences).sort(([left], [right]) => left.localeCompare(right)));
}

function sameSourcePreferences(left: Record<string, boolean>, right: Record<string, boolean>): boolean {
  return sourcePreferencesKey(left) === sourcePreferencesKey(right);
}

function boundedPositive(value: number | undefined, fallback: number, maximum: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

function normalizeRequest(input: MutationInput): Required<Pick<DeckMutationRequest, "mutation">> & Omit<DeckMutationRequest, "mutation"> {
  if ("mutation" in input) return input;
  return { mutation: input };
}

function mutationFingerprint(mutation: DeckMutation): string {
  return createHash("sha256").update(JSON.stringify(mutation)).digest("hex");
}

function validateMutation(
  store: Pick<PriorityStore, "entries" | "currentFocusThreadId">,
  mutation: DeckMutation,
  collection: SourceCollection,
): ValidationErrorCode | null {
  if (mutation.type === "set-collapsed") return null;
  if (mutation.type === "set-source-enabled") {
    return collection.sources.some((source) => source.id === mutation.sourceId && source.id !== "configured-sources")
      ? null
      : "unknown-source";
  }

  const knownThreadIds = new Set(collection.threads.map((thread) => thread.id));
  if (!knownThreadIds.has(mutation.threadId)) return "unknown-thread";
  const stored = store.entries.find((entry) => entry.threadId === mutation.threadId);
  if (mutation.type === "move" || mutation.type === "set-context") {
    return stored ? null : "invalid-target";
  }
  if (mutation.type === "set-level") {
    return store.currentFocusThreadId === mutation.threadId && mutation.level !== "focus"
      ? "invalid-target"
      : null;
  }
  if (mutation.type !== "move-before") return null;
  if (store.currentFocusThreadId === mutation.threadId && mutation.level !== "focus") {
    const replacement = Object.hasOwn(mutation, "currentThreadId") ? mutation.currentThreadId : null;
    if (typeof replacement !== "string" || replacement === mutation.threadId) return "invalid-target";
  }
  if (!Object.hasOwn(mutation, "currentThreadId") && mutation.isCurrent === true && mutation.level !== "focus") return "invalid-target";
  if (mutation.level === null) {
    if (mutation.beforeThreadId) return "invalid-target";
    return validatePostMoveCurrent(store, mutation, knownThreadIds);
  }
  if (mutation.beforeThreadId) {
    if (mutation.beforeThreadId === mutation.threadId || !knownThreadIds.has(mutation.beforeThreadId)) return "invalid-target";
    const before = store.entries.find((entry) => entry.threadId === mutation.beforeThreadId);
    if (before?.level !== mutation.level) return "invalid-target";
  }
  return validatePostMoveCurrent(store, mutation, knownThreadIds);
}

function validatePostMoveCurrent(
  store: Pick<PriorityStore, "entries" | "currentFocusThreadId">,
  mutation: Extract<DeckMutation, { type: "move-before" }>,
  knownThreadIds: Set<string>,
): ValidationErrorCode | null {
  if (!Object.hasOwn(mutation, "currentThreadId")) return null;
  const currentThreadId = mutation.currentThreadId;
  if (currentThreadId === undefined || currentThreadId === null) return null;
  if (!knownThreadIds.has(currentThreadId)) return "invalid-target";
  const postMoveFocusIds = new Set(store.entries
    .filter((entry) => entry.level === "focus")
    .map((entry) => entry.threadId));
  if (mutation.level === "focus") postMoveFocusIds.add(mutation.threadId);
  else postMoveFocusIds.delete(mutation.threadId);
  return postMoveFocusIds.has(currentThreadId) ? null : "invalid-target";
}

function conflict(snapshot: DeckSnapshot, revision: number): DeckMutationResult {
  return {
    protocolVersion: MUTATION_PROTOCOL_VERSION,
    outcome: "conflict",
    revision,
    snapshot,
    error: { code: "stale-revision", message: "Gajendra changed elsewhere. Refresh and retry this change." },
  };
}

function rejected(snapshot: DeckSnapshot, revision: number, code: Exclude<MutationErrorCode, "stale-revision" | "store-busy" | "store-recovery-required">): DeckMutationResult {
  const messages: Record<typeof code, string> = {
    "idempotency-key-reused": "This request key was already used for a different change.",
    "unknown-thread": "That thread is no longer available from an enabled source.",
    "unknown-source": "That source is not available in the current Gajendra registry.",
    "invalid-target": "That priority target is no longer valid. Refresh and retry.",
  };
  return {
    protocolVersion: MUTATION_PROTOCOL_VERSION,
    outcome: "rejected",
    revision,
    snapshot,
    error: { code, message: messages[code] },
  };
}
