export const STORE_VERSION = 3 as const;
export const MUTATION_PROTOCOL_VERSION = 1 as const;
export const FOCUS_GUIDE = 5;
export const DEFAULT_IDEMPOTENCY_LEDGER_LIMIT = 128;
/**
 * One receipt per acknowledged thread generation. The service rejects new-thread acknowledgements
 * at this ceiling instead of evicting an older receipt and silently resurrecting handled work.
 */
export const DEFAULT_REVIEW_ACKNOWLEDGEMENT_LIMIT = 1_024;
export const DEFAULT_CONFIGURED_DEEP_LINK_SCHEMES = ["https"] as const;
/** One bounded recent-history ceiling shared by provider selection and optional metadata enrichments. */
export const MAX_BACKGROUND_THREADS_PER_SOURCE = 200;

export type PriorityLevel = "focus" | "important";
export type ThreadContext = "design" | "engineering" | "life";
export type SourceState = "ready" | "disabled" | "not-installed" | "not-configured" | "error";

const RUNNING_STATUS_KEYS = new Set([
  "active",
  "busy",
  "inprogress",
  "processing",
  "running",
  "streaming",
  "working",
]);

export function isRunningThreadStatus(status: string): boolean {
  return RUNNING_STATUS_KEYS.has(status.toLowerCase().replace(/[^a-z]/gu, ""));
}

export function allDeckThreads(snapshot: DeckSnapshot): DeckThread[] {
  const unique = new Map<string, DeckThread>();
  for (const thread of [snapshot.current, ...snapshot.focus, ...snapshot.important, ...snapshot.available]) {
    if (thread && !unique.has(thread.id)) unique.set(thread.id, thread);
  }
  return [...unique.values()];
}

export function runningDeckThreads(snapshot: DeckSnapshot): DeckThread[] {
  return allDeckThreads(snapshot)
    .filter((thread) => isRunningThreadStatus(thread.status))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function reviewReadyDeckThreads(snapshot: DeckSnapshot): DeckThread[] {
  return allDeckThreads(snapshot)
    .filter((thread) => thread.review?.state === "ready" && !isRunningThreadStatus(thread.status))
    .sort((left, right) => (right.review?.updatedAt ?? 0) - (left.review?.updatedAt ?? 0));
}

export function normalizeDeckSelection(snapshot: DeckSnapshot): DeckSnapshot {
  const currentId = snapshot.current?.id ?? null;
  const markCurrent = (thread: DeckThread): DeckThread => ({
    ...thread,
    isCurrent: currentId !== null && thread.id === currentId,
  });
  return {
    ...snapshot,
    current: snapshot.current ? { ...snapshot.current, isCurrent: true } : null,
    focus: snapshot.focus.map(markCurrent),
    important: snapshot.important.map((thread) => ({ ...thread, isCurrent: false })),
    available: snapshot.available.map((thread) => ({ ...thread, isCurrent: false })),
  };
}

export type StoredEntry = {
  threadId: string;
  level: PriorityLevel;
  addedAt: string;
  context?: ThreadContext;
};

/** A private receipt for a successfully committed mutation. No provider metadata is retained. */
export type StoredMutationReceipt = {
  /** SHA-256 of the caller-supplied idempotency key; raw caller metadata is never persisted. */
  keyHash: string;
  fingerprint: string;
  revision: number;
};

/** Data-minimized local workflow state; neither receipt stores provider prose or destination text in plaintext. */
export type StoredReviewAcknowledgement = {
  /** SHA-256 of the canonical thread ID, used only to replace an older generation for that thread. */
  threadHash: string;
  /** SHA-256 of canonical thread ID, review timestamp, kind, destination type, and destination. */
  signalHash: string;
};

export type PriorityStore = {
  version: typeof STORE_VERSION;
  revision: number;
  currentFocusThreadId: string | null;
  entries: StoredEntry[];
  collapsed: Record<PriorityLevel, boolean>;
  sourcePreferences: Record<string, boolean>;
  idempotency: StoredMutationReceipt[];
  reviewAcknowledgements: StoredReviewAcknowledgement[];
};

export type ResumeCommand = {
  executable: string;
  args: string[];
  cwd?: string;
};

/**
 * Live provider evidence that a human-review destination is ready. This metadata is projected
 * from source adapters and deliberately never enters the persisted priority store.
 */
export type ReviewSignal = {
  state: "ready";
  kind: "result" | "diff" | "pull-request";
  updatedAt: number;
  destination:
    | { type: "thread"; deepLink: string }
    | { type: "url"; url: string };
  providerStatus: string;
  /** Server-projected exact identity used to bind an acknowledgement click to this evidence. */
  identity?: string;
};

export type AgentThread = {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  project: string;
  updatedAt: number;
  status: string;
  deepLink: string;
  /** The source-declared schemes that may be opened for this thread. */
  allowedDeepLinkSchemes?: string[];
  resumeCommand?: ResumeCommand;
  review?: ReviewSignal;
};

export type DeckThread = AgentThread & {
  level: PriorityLevel | null;
  isCurrent: boolean;
  context: ThreadContext | null;
};

export type ThreadSourceStatus = {
  id: string;
  name: string;
  kind: "builtin" | "configured";
  state: SourceState;
  enabled: boolean;
  threadCount: number;
  detail: string | null;
};

export type DeckSnapshot = {
  generatedAt: string;
  revision: number;
  current: DeckThread | null;
  focus: DeckThread[];
  important: DeckThread[];
  available: DeckThread[];
  collapsed: Record<PriorityLevel, boolean>;
  focusGuide: number;
  focusOverGuide: boolean;
  staleEntryCount: number;
  source: "gajendra-registry" | "fixture";
  sources: ThreadSourceStatus[];
  error: string | null;
};

export type CodexThread = {
  id: string;
  preview?: string;
  name?: string | null;
  cwd?: string;
  updatedAt?: number;
  recencyAt?: number | null;
  status?: { type?: string } | string;
  path?: string | null;
};

export type DeckMutation =
  | { type: "set-level"; threadId: string; level: PriorityLevel | null }
  | { type: "set-current"; threadId: string }
  | { type: "move"; threadId: string; direction: "up" | "down" }
  | {
    type: "move-before";
    threadId: string;
    level: PriorityLevel | null;
    /** Omit or use null to append. A non-null target must be in the requested lane. */
    beforeThreadId?: string | null;
    /** Omit to retain an existing context; null explicitly clears it. */
    context?: ThreadContext | null;
    /** Omit to retain current status; use true/false for an exact undo restoration. */
    isCurrent?: boolean;
    /**
     * Explicit post-mutation NOW selection for exact undo. Null is repaired to the first Focus
     * thread when one exists; a non-null value must be a post-mutation Focus thread.
     * When supplied, this takes precedence over the legacy isCurrent compatibility field.
     */
    currentThreadId?: string | null;
  }
  | { type: "set-context"; threadId: string; context: ThreadContext | null }
  | {
    type: "set-review-acknowledged";
    threadId: string;
    reviewUpdatedAt: number;
    reviewIdentity: string;
    acknowledged: boolean;
  }
  | { type: "set-collapsed"; level: PriorityLevel; collapsed: boolean }
  | { type: "set-source-enabled"; sourceId: string; enabled: boolean };

/**
 * New writers send this envelope. The optional concurrency fields deliberately remain optional so
 * legacy stdio/native callers can continue to serialize their existing mutation shape.
 */
export type DeckMutationRequest = {
  protocolVersion?: typeof MUTATION_PROTOCOL_VERSION;
  mutation: DeckMutation;
  expectedRevision?: number;
  idempotencyKey?: string;
};

export type MutationOutcome = "applied" | "replayed" | "conflict" | "rejected";

export type MutationErrorCode =
  | "stale-revision"
  | "idempotency-key-reused"
  | "unknown-thread"
  | "unknown-source"
  | "invalid-target"
  | "review-acknowledgement-limit"
  | "store-recovery-required"
  | "store-busy";

export type DeckMutationResult = {
  protocolVersion: typeof MUTATION_PROTOCOL_VERSION;
  outcome: MutationOutcome;
  revision: number;
  snapshot: DeckSnapshot;
  error?: { code: MutationErrorCode; message: string };
};

export function isDeckMutationResult(value: unknown): value is DeckMutationResult {
  return Boolean(value
    && typeof value === "object"
    && "outcome" in value
    && "snapshot" in value
    && "revision" in value);
}

/**
 * Do not normalize away whitespace or encoded scheme characters: accepting a rewritten value at
 * the execution boundary would make source review ambiguous.
 */
export function isPermittedDeepLink(value: string, allowedSchemes: readonly string[]): boolean {
  if (!value || value !== value.trim()) return false;
  const separator = value.indexOf(":");
  if (separator <= 0) return false;
  const rawScheme = value.slice(0, separator);
  if (!/^[a-z][a-z0-9+.-]*$/iu.test(rawScheme)) return false;
  let decodedScheme: string;
  try {
    decodedScheme = decodeURIComponent(rawScheme);
  } catch {
    return false;
  }
  if (decodedScheme !== rawScheme) return false;
  const scheme = rawScheme.toLowerCase();
  if (["javascript", "data", "file"].includes(scheme)) return false;
  if (!allowedSchemes.map((candidate) => candidate.toLowerCase()).includes(scheme)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === `${scheme}:`;
  } catch {
    return false;
  }
}

export const DEFAULT_SOURCE_PREFERENCES: Record<string, boolean> = {
  codex: true,
  claude: false,
  cursor: true,
  grok: false,
};

export const EMPTY_STORE: PriorityStore = {
  version: STORE_VERSION,
  revision: 0,
  currentFocusThreadId: null,
  entries: [],
  collapsed: { focus: false, important: false },
  sourcePreferences: { ...DEFAULT_SOURCE_PREFERENCES },
  idempotency: [],
  reviewAcknowledgements: [],
};
