import {
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
  type ThreadSourceStatus,
} from "../shared/contracts.js";

export function canonicalThreadId(sourceId: string, threadId: string): string {
  return `${sourceId}:${threadId}`;
}

export function normalizeStore(value: unknown): PriorityStore {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_STORE);
  const candidate = value as Partial<PriorityStore>;
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
        .filter(isStoredEntry)
        .map((entry) => ({ ...entry, threadId: normalizeLegacyThreadId(entry.threadId) }))
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
    currentFocusThreadId: current,
    entries,
    collapsed: {
      focus: Boolean(candidate.collapsed?.focus),
      important: Boolean(candidate.collapsed?.important),
    },
    sourcePreferences: normalizeSourcePreferences(candidate.sourcePreferences),
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

  const index = next.entries.findIndex((entry) => entry.threadId === mutation.threadId);

  if (mutation.type === "set-level") {
    if (index >= 0) next.entries.splice(index, 1);
    if (mutation.level) {
      next.entries.push({ threadId: mutation.threadId, level: mutation.level, addedAt: now.toISOString() });
    }
    if (mutation.level === "focus" && !next.currentFocusThreadId) next.currentFocusThreadId = mutation.threadId;
    if (mutation.level !== "focus" && next.currentFocusThreadId === mutation.threadId) {
      next.currentFocusThreadId = next.entries.find((entry) => entry.level === "focus")?.threadId ?? null;
    }
    return next;
  }

  if (mutation.type === "set-current") {
    if (index >= 0) next.entries.splice(index, 1);
    next.entries.unshift({ threadId: mutation.threadId, level: "focus", addedAt: now.toISOString() });
    next.currentFocusThreadId = mutation.threadId;
    return next;
  }

  if (index < 0) return next;
  const entry = next.entries[index];
  if (!entry) return next;
  const levelIndexes = next.entries
    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate }) => candidate.level === entry.level)
    .map(({ candidateIndex }) => candidateIndex);
  const position = levelIndexes.indexOf(index);
  const swapPosition = mutation.direction === "up" ? position - 1 : position + 1;
  const swapIndex = levelIndexes[swapPosition];
  if (swapIndex === undefined) return next;
  const swapped = next.entries[swapIndex];
  if (!swapped) return next;
  next.entries[index] = swapped;
  next.entries[swapIndex] = entry;
  return next;
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
    return thread ? { ...thread, level: entry.level, isCurrent: normalized.currentFocusThreadId === entry.threadId } : null;
  };
  const focus = normalized.entries.filter((entry) => entry.level === "focus").map(resolve).filter(isPresent);
  const important = normalized.entries.filter((entry) => entry.level === "important").map(resolve).filter(isPresent);
  const available = threads
    .filter((thread) => !entriesById.has(thread.id))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((thread) => ({ ...thread, level: null, isCurrent: false }));

  return {
    generatedAt: new Date().toISOString(),
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
