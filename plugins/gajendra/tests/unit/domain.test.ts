import { describe, expect, it } from "vitest";

import {
  allDeckThreads,
  EMPTY_STORE,
  isRunningThreadStatus,
  normalizeDeckSelection,
  runningDeckThreads,
  type AgentThread,
  type PriorityStore,
  type ThreadSourceStatus,
} from "../../src/shared/contracts.js";
import { applyMutation, buildSnapshot, canonicalThreadId, normalizeStore } from "../../src/server/domain.js";
import { resolveRpcTimeout } from "../../src/server/codex-app-server.js";

const now = new Date("2026-08-12T12:00:00.000Z");
const sources: ThreadSourceStatus[] = [
  { id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: null },
];

describe("Gajendra domain", () => {
  it("keeps exactly one NOW thread inside Focus across sources", () => {
    let store = structuredClone(EMPTY_STORE);
    store = applyMutation(store, { type: "set-level", threadId: "codex:a", level: "focus" }, now);
    store = applyMutation(store, { type: "set-current", threadId: "claude:b" }, now);

    expect(store.currentFocusThreadId).toBe("claude:b");
    expect(store.entries.map(({ threadId, level }) => ({ threadId, level }))).toEqual([
      { threadId: "claude:b", level: "focus" },
      { threadId: "codex:a", level: "focus" },
    ]);
  });

  it("selects the next focus thread when NOW is demoted", () => {
    const initial: PriorityStore = state([
      { threadId: "codex:a", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:b", level: "focus", addedAt: now.toISOString() },
    ], "codex:a");
    const result = applyMutation(initial, { type: "set-level", threadId: "codex:a", level: "important" }, now);
    expect(result.currentFocusThreadId).toBe("cursor:b");
  });

  it("reorders within a tier without moving across sources or tiers", () => {
    const initial = state([
      { threadId: "codex:a", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:x", level: "important", addedAt: now.toISOString() },
      { threadId: "claude:b", level: "focus", addedAt: now.toISOString() },
    ], "codex:a");
    const result = applyMutation(initial, { type: "move", threadId: "claude:b", direction: "up" }, now);
    expect(result.entries.map((entry) => entry.threadId)).toEqual(["claude:b", "cursor:x", "codex:a"]);
  });

  it("migrates unqualified legacy IDs to Codex and repairs invalid state", () => {
    const result = normalizeStore({
      version: 1,
      currentFocusThreadId: "missing",
      entries: [
        { threadId: "a", level: "focus", addedAt: now.toISOString() },
        { threadId: "a", level: "important", addedAt: now.toISOString() },
      ],
      collapsed: { focus: 1, important: 0 },
    });
    expect(result.version).toBe(2);
    expect(result.currentFocusThreadId).toBe("codex:a");
    expect(result.entries).toHaveLength(1);
    expect(result.sourcePreferences).toMatchObject({ codex: true, claude: false, cursor: true, grok: false });
  });

  it("merges live metadata from multiple sources without persisting it", () => {
    const initial = state([
      { threadId: "codex:a", level: "focus", addedAt: now.toISOString() },
      { threadId: "claude:missing", level: "important", addedAt: now.toISOString() },
    ], "codex:a");
    const threads: AgentThread[] = [{
      id: "codex:a", sourceId: "codex", sourceName: "Codex", title: "Build Gajendra",
      project: "gajendra", updatedAt: 100, status: "active", deepLink: "codex://threads/a",
    }];
    const snapshot = buildSnapshot(initial, threads, sources);
    expect(snapshot.current).toMatchObject({ title: "Build Gajendra", sourceName: "Codex" });
    expect(snapshot.staleEntryCount).toBe(1);
    expect(snapshot.source).toBe("gajendra-registry");
  });

  it("persists source opt-in independently of thread priority", () => {
    const result = applyMutation(structuredClone(EMPTY_STORE), { type: "set-source-enabled", sourceId: "claude", enabled: true });
    expect(result.sourcePreferences.claude).toBe(true);
    expect(result.entries).toEqual([]);
  });

  it("assigns only bounded Gaja contexts and preserves them across priority changes", () => {
    let store = applyMutation(structuredClone(EMPTY_STORE), { type: "set-level", threadId: "codex:a", level: "focus" }, now);
    store = applyMutation(store, { type: "set-context", threadId: "codex:a", context: "engineering" }, now);
    store = applyMutation(store, { type: "set-current", threadId: "codex:a" }, now);
    store = applyMutation(store, { type: "set-level", threadId: "codex:a", level: "important" }, now);
    expect(store.entries[0]).toMatchObject({ threadId: "codex:a", level: "important", context: "engineering" });

    const unchanged = applyMutation(store, { type: "set-context", threadId: "codex:recent", context: "life" }, now);
    expect(unchanged.entries).toHaveLength(1);

    const normalized = normalizeStore({
      ...store,
      entries: [{ ...store.entries[0], context: "strategy", title: "must not persist", prompt: "private" }],
    });
    expect(normalized.entries[0]).toEqual({
      threadId: "codex:a",
      level: "important",
      addedAt: now.toISOString(),
    });
  });

  it("uses canonical source-qualified thread IDs", () => {
    expect(canonicalThreadId("cursor", "abc")).toBe("cursor:abc");
  });

  it("recognizes only explicit provider running states", () => {
    expect(["active", "running", "inProgress", "in-progress", "WORKING", "streaming"].every(isRunningThreadStatus)).toBe(true);
    expect(["idle", "notLoaded", "resumable", "completed", "unknown"].some(isRunningThreadStatus)).toBe(false);
  });

  it("derives Running across NOW, Focus, Important, and unprioritized threads without duplicates", () => {
    const initial = state([
      { threadId: "codex:now", level: "focus", addedAt: now.toISOString() },
      { threadId: "claude:focus", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:important", level: "important", addedAt: now.toISOString() },
    ], "codex:now");
    const threads: AgentThread[] = [
      agentThread("codex:now", "active", 400),
      agentThread("claude:focus", "running", 300),
      agentThread("cursor:important", "in-progress", 200),
      agentThread("codex:available", "working", 100),
      agentThread("codex:idle", "idle", 500),
    ];
    const snapshot = buildSnapshot(initial, threads, sources);

    expect(allDeckThreads(snapshot).map((thread) => thread.id)).toHaveLength(5);
    expect(runningDeckThreads(snapshot).map((thread) => thread.id)).toEqual([
      "codex:now",
      "claude:focus",
      "cursor:important",
      "codex:available",
    ]);
  });

  it("normalizes malformed snapshots to one current task", () => {
    const initial = state([
      { threadId: "codex:a", level: "focus", addedAt: now.toISOString() },
      { threadId: "codex:b", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:c", level: "important", addedAt: now.toISOString() },
    ], "codex:a");
    const malformed = buildSnapshot(initial, [
      agentThread("codex:a", "active", 300),
      agentThread("codex:b", "idle", 200),
      agentThread("cursor:c", "idle", 100),
    ], sources);
    malformed.focus[1]!.isCurrent = true;
    malformed.important[0]!.isCurrent = true;

    const normalized = normalizeDeckSelection(malformed);
    expect([...normalized.focus, ...normalized.important, ...normalized.available].filter((thread) => thread.isCurrent).map((thread) => thread.id)).toEqual(["codex:a"]);
    expect(normalized.current?.id).toBe("codex:a");
  });

  it("uses a bounded, configurable app-server request timeout with legacy compatibility", () => {
    expect(resolveRpcTimeout({})).toBe(15_000);
    expect(resolveRpcTimeout({ GAJENDRA_RPC_TIMEOUT_MS: "25000" })).toBe(25_000);
    expect(resolveRpcTimeout({ AADI_RPC_TIMEOUT_MS: "18000" })).toBe(18_000);
  });
});

function state(entries: PriorityStore["entries"], currentFocusThreadId: string | null): PriorityStore {
  return { ...structuredClone(EMPTY_STORE), entries, currentFocusThreadId };
}

function agentThread(id: string, status: string, updatedAt: number): AgentThread {
  const [sourceId = "codex"] = id.split(":");
  return {
    id,
    sourceId,
    sourceName: sourceId,
    title: id,
    project: "fixture",
    updatedAt,
    status,
    deepLink: `${sourceId}://threads/${id}`,
  };
}
