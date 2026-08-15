export const STORE_VERSION = 2 as const;
export const FOCUS_GUIDE = 5;

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

export type PriorityStore = {
  version: typeof STORE_VERSION;
  currentFocusThreadId: string | null;
  entries: StoredEntry[];
  collapsed: Record<PriorityLevel, boolean>;
  sourcePreferences: Record<string, boolean>;
};

export type ResumeCommand = {
  executable: string;
  args: string[];
  cwd?: string;
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
  resumeCommand?: ResumeCommand;
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
  | { type: "set-context"; threadId: string; context: ThreadContext | null }
  | { type: "set-collapsed"; level: PriorityLevel; collapsed: boolean }
  | { type: "set-source-enabled"; sourceId: string; enabled: boolean };

export const DEFAULT_SOURCE_PREFERENCES: Record<string, boolean> = {
  codex: true,
  claude: false,
  cursor: true,
  grok: false,
};

export const EMPTY_STORE: PriorityStore = {
  version: STORE_VERSION,
  currentFocusThreadId: null,
  entries: [],
  collapsed: { focus: false, important: false },
  sourcePreferences: { ...DEFAULT_SOURCE_PREFERENCES },
};
