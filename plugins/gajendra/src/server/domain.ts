import {
  DEFAULT_IDEMPOTENCY_LEDGER_LIMIT,
  DEFAULT_SOURCE_PREFERENCES,
  EMPTY_STORE,
  FOCUS_GUIDE,
  STORE_VERSION,
  type AgentThread,
  type DeckMutation,
  type DeckSnapshot,
  type DeckThread,
  type PriorityStore,
  type StoredEntry,
  type StoredMutationReceipt,
  type ThreadSourceStatus,
  type ThreadContext,
} from "../shared/contracts.js";
import { hashIdempotencyKey, isSha256Digest } from "./idempotency.js";

export function canonicalThreadId(sourceId: string, threadId: string): string {
  return `${sourceId}:${threadId}`;
}

export function normalizeStore(value: unknown): PriorityStore {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_STORE);
  const candidate = value as Partial<PriorityStore>;
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
        .filter(isStoredEntry)
        .map(normalizeStoredEntry)
        .filter(uniqueByThreadId())
    : [];
  const candidateCurrent = typeof candidate.currentFocusThreadId === "string"
    ? normalizeLegacyThreadId(candidate.currentFocusThreadId)
    : null;
  const current = candidateCurrent && entries.some(
    (entry) => entry.threadId === candidateCurrent && entry.level === "focus",
  )
    ? candidateCurrent
    : entries.find((entry) => entry.level === "focus")?.threadId ?? null;

  return {
    version: STORE_VERSION,
    revision: normalizeRevision(candidate.revision),
    currentFocusThreadId: current,
    entries,
    collapsed: {
      focus: Boolean(candidate.collapsed?.focus),
      important: Boolean(candidate.collapsed?.important),
    },
    sourcePreferences: normalizeSourcePreferences(candidate.sourcePreferences),
    idempotency: normalizeIdempotency(candidate.idempotency),
  };
}

export function applyMutation(store: PriorityStore, mutation: DeckMutation, now = new Date()): PriorityStore {
  const next = normalizeStore(store);

  if (mutation.type === "set-collapsed") {
    next.collapsed[mutation.level] = mutation.collapsed;
    return next;
  }
  if (mutation.type === "set-source-enabled") {
    next.sourcePreferences[mutation.sourceId] = mutation.enabled;
    return next;
  }

  if (mutation.type === "move-before") {
    return moveBefore(next, mutation, now);
  }

  const index = next.entries.findIndex((entry) => entry.threadId === mutation.threadId);

  if (mutation.type === "set-context") {
    if (index < 0) return next;
    const entry = next.entries[index];
    if (!entry) return next;
    if (mutation.context) entry.context = mutation.context;
    else delete entry.context;
    return repairCurrentFocus(next);
  }

  if (mutation.type === "set-level") {
    // A direct level change cannot silently replace NOW. The user must select another NOW first;
    // atomic move-before operations may still name an explicit valid replacement.
    if (next.currentFocusThreadId === mutation.threadId && mutation.level !== "focus") return next;
    const existing = index >= 0 ? next.entries[index] : undefined;
    if (index >= 0) next.entries.splice(index, 1);
    if (mutation.level) {
      next.entries.push(storedEntry(mutation.threadId, mutation.level, existing?.addedAt ?? now.toISOString(), existing?.context));
    }
    if (mutation.level === "focus" && !next.currentFocusThreadId) next.currentFocusThreadId = mutation.threadId;
    return repairCurrentFocus(next);
  }

  if (mutation.type === "set-current") {
    const existing = index >= 0 ? next.entries[index] : undefined;
    if (index >= 0) next.entries.splice(index, 1);
    next.entries.unshift(storedEntry(mutation.threadId, "focus", existing?.addedAt ?? now.toISOString(), existing?.context));
    next.currentFocusThreadId = mutation.threadId;
    return repairCurrentFocus(next);
  }

  if (index < 0) return repairCurrentFocus(next);
  const entry = next.entries[index];
  if (!entry) return repairCurrentFocus(next);
  const levelIndexes = next.entries
    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate }) => candidate.level === entry.level)
    .map(({ candidateIndex }) => candidateIndex);
  const position = levelIndexes.indexOf(index);
  const swapPosition = mutation.direction === "up" ? position - 1 : position + 1;
  const swapIndex = levelIndexes[swapPosition];
  if (swapIndex === undefined) return repairCurrentFocus(next);
  const swapped = next.entries[swapIndex];
  if (!swapped) return repairCurrentFocus(next);
  next.entries[index] = swapped;
  next.entries[swapIndex] = entry;
  return repairCurrentFocus(next);
}

function moveBefore(
  store: PriorityStore,
  mutation: Extract<DeckMutation, { type: "move-before" }>,
  now: Date,
): PriorityStore {
  const next = store;
  if (next.currentFocusThreadId === mutation.threadId && mutation.level !== "focus") {
    const replacement = Object.hasOwn(mutation, "currentThreadId") ? mutation.currentThreadId : null;
    const hasValidReplacement = typeof replacement === "string"
      && replacement !== mutation.threadId
      && next.entries.some((entry) => entry.threadId === replacement && entry.level === "focus");
    if (!hasValidReplacement) return next;
  }
  const existingIndex = next.entries.findIndex((entry) => entry.threadId === mutation.threadId);
  const existing = existingIndex >= 0 ? next.entries[existingIndex] : undefined;
  if (existingIndex >= 0) next.entries.splice(existingIndex, 1);

  if (mutation.level === null) {
    if (Object.hasOwn(mutation, "currentThreadId")) next.currentFocusThreadId = mutation.currentThreadId ?? null;
    return repairCurrentFocus(next);
  }

  const context = Object.hasOwn(mutation, "context")
    ? normalizeThreadContext(mutation.context)
    : existing?.context;
  const entry = storedEntry(mutation.threadId, mutation.level, existing?.addedAt ?? now.toISOString(), context);
  const beforeThreadId = mutation.beforeThreadId ?? null;
  if (beforeThreadId) {
    const beforeIndex = next.entries.findIndex((candidate) => candidate.threadId === beforeThreadId && candidate.level === mutation.level);
    if (beforeIndex >= 0) next.entries.splice(beforeIndex, 0, entry);
    else next.entries.push(entry);
  } else {
    let insertAt = next.entries.length;
    for (let index = next.entries.length - 1; index >= 0; index -= 1) {
      if (next.entries[index]?.level === mutation.level) {
        insertAt = index + 1;
        break;
      }
    }
    next.entries.splice(insertAt, 0, entry);
  }

  if (Object.hasOwn(mutation, "currentThreadId")) {
    next.currentFocusThreadId = mutation.currentThreadId ?? null;
  } else {
    if (mutation.isCurrent === true) next.currentFocusThreadId = mutation.threadId;
    if (mutation.isCurrent === false && next.currentFocusThreadId === mutation.threadId) {
      next.currentFocusThreadId = null;
    }
  }
  if (!Object.hasOwn(mutation, "currentThreadId") && mutation.level === "focus" && !next.currentFocusThreadId) {
    next.currentFocusThreadId = mutation.threadId;
  }
  return repairCurrentFocus(next);
}

function repairCurrentFocus(store: PriorityStore): PriorityStore {
  if (store.currentFocusThreadId && store.entries.some(
    (entry) => entry.threadId === store.currentFocusThreadId && entry.level === "focus",
  )) return store;
  store.currentFocusThreadId = store.entries.find((entry) => entry.level === "focus")?.threadId ?? null;
  return store;
}

export function buildSnapshot(
  store: PriorityStore,
  threads: AgentThread[],
  sources: ThreadSourceStatus[],
  error: string | null = null,
): DeckSnapshot {
  const normalized = normalizeStore(store);
  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
  const entriesById = new Map(normalized.entries.map((entry) => [entry.threadId, entry]));
  const resolve = (entry: StoredEntry): DeckThread | null => {
    const thread = threadsById.get(entry.threadId);
    return thread ? {
      ...thread,
      level: entry.level,
      isCurrent: normalized.currentFocusThreadId === entry.threadId,
      context: entry.context ?? null,
    } : null;
  };
  const focus = normalized.entries.filter((entry) => entry.level === "focus").map(resolve).filter(isPresent);
  const important = normalized.entries.filter((entry) => entry.level === "important").map(resolve).filter(isPresent);
  const available = threads
    .filter((thread) => !entriesById.has(thread.id))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((thread) => ({ ...thread, level: null, isCurrent: false, context: null }));

  return {
    generatedAt: new Date().toISOString(),
    revision: normalized.revision,
    current: focus.find((thread) => thread.isCurrent) ?? null,
    focus,
    important,
    available,
    collapsed: normalized.collapsed,
    focusGuide: FOCUS_GUIDE,
    focusOverGuide: focus.length > FOCUS_GUIDE,
    staleEntryCount: normalized.entries.length - focus.length - important.length,
    source: "gajendra-registry",
    sources,
    error,
  };
}

function normalizeLegacyThreadId(threadId: string): string {
  return threadId.includes(":") ? threadId : canonicalThreadId("codex", threadId);
}

function normalizeStoredEntry(entry: StoredEntry): StoredEntry {
  return storedEntry(
    normalizeLegacyThreadId(entry.threadId),
    entry.level,
    entry.addedAt,
    normalizeThreadContext(entry.context),
  );
}

function storedEntry(
  threadId: string,
  level: StoredEntry["level"],
  addedAt: string,
  context?: ThreadContext,
): StoredEntry {
  return context ? { threadId, level, addedAt, context } : { threadId, level, addedAt };
}

function normalizeThreadContext(value: unknown): ThreadContext | undefined {
  return value === "design" || value === "engineering" || value === "life" ? value : undefined;
}

function normalizeRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function normalizeIdempotency(value: unknown): StoredMutationReceipt[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const receipts: StoredMutationReceipt[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const receipt = candidate as Partial<StoredMutationReceipt> & { key?: unknown };
    const keyHash = isSha256Digest(receipt.keyHash)
      ? receipt.keyHash.toLowerCase()
      : typeof receipt.key === "string" && receipt.key.length > 0 && receipt.key.length <= 256
        ? hashIdempotencyKey(receipt.key)
        : null;
    if (!keyHash) continue;
    if (typeof receipt.fingerprint !== "string" || !/^[a-f0-9]{64}$/iu.test(receipt.fingerprint)) continue;
    if (typeof receipt.revision !== "number" || !Number.isSafeInteger(receipt.revision) || receipt.revision < 0) continue;
    if (seen.has(keyHash)) continue;
    seen.add(keyHash);
    receipts.push({ keyHash, fingerprint: receipt.fingerprint.toLowerCase(), revision: receipt.revision });
    if (receipts.length >= DEFAULT_IDEMPOTENCY_LEDGER_LIMIT) break;
  }
  return receipts;
}

function normalizeSourcePreferences(value: unknown): Record<string, boolean> {
  const preferences = { ...DEFAULT_SOURCE_PREFERENCES };
  if (!value || typeof value !== "object") return preferences;
  for (const [sourceId, enabled] of Object.entries(value)) {
    if (typeof enabled === "boolean" && sourceId.trim()) preferences[sourceId] = enabled;
  }
  return preferences;
}

function isStoredEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<StoredEntry>;
  return typeof entry.threadId === "string"
    && (entry.level === "focus" || entry.level === "important")
    && typeof entry.addedAt === "string";
}

function uniqueByThreadId() {
  const seen = new Set<string>();
  return (entry: StoredEntry) => {
    if (seen.has(entry.threadId)) return false;
    seen.add(entry.threadId);
    return true;
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
