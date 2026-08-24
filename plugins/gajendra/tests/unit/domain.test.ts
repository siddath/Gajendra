import { describe, expect, it } from "vitest";

import {
  allDeckThreads,
  EMPTY_STORE,
  isPermittedDeepLink,
  isRunningThreadStatus,
  normalizeDeckSelection,
  reviewReadyDeckThreads,
  runningDeckThreads,
  type AgentThread,
  type PriorityStore,
  type ThreadSourceStatus,
} from "../../src/shared/contracts.js";
import { applyMutation, buildSnapshot, canonicalThreadId, normalizeStore } from "../../src/server/domain.js";
import {
  clampCodexRpcTimeout,
  CODEX_PROVIDER_COLLECTION_ENVELOPE_MS,
  resolveRpcTimeout,
} from "../../src/server/codex-app-server.js";
import { DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS } from "../../src/server/service.js";

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

  it("keeps NOW in Focus when a direct level change attempts to demote it", () => {
    const initial: PriorityStore = state([
      { threadId: "codex:a", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:b", level: "focus", addedAt: now.toISOString() },
    ], "codex:a");
    const result = applyMutation(initial, { type: "set-level", threadId: "codex:a", level: "important" }, now);
    expect(result.currentFocusThreadId).toBe("codex:a");
    expect(result.entries).toEqual(initial.entries);
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
    expect(result.version).toBe(3);
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

  it("assigns only bounded Gajendra contexts and preserves them across priority changes", () => {
    let store = applyMutation(structuredClone(EMPTY_STORE), { type: "set-level", threadId: "codex:a", level: "focus" }, now);
    store = applyMutation(store, { type: "set-context", threadId: "codex:a", context: "engineering" }, now);
    store = applyMutation(store, { type: "set-current", threadId: "codex:a" }, now);
    store = applyMutation(store, { type: "set-level", threadId: "codex:a", level: "important" }, now);
    expect(store.entries[0]).toMatchObject({ threadId: "codex:a", level: "focus", context: "engineering" });

    const unchanged = applyMutation(store, { type: "set-context", threadId: "codex:recent", context: "life" }, now);
    expect(unchanged.entries).toHaveLength(1);

    const normalized = normalizeStore({
      ...store,
      entries: [{ ...store.entries[0], context: "strategy", title: "must not persist", prompt: "private" }],
    });
    expect(normalized.entries[0]).toEqual({
      threadId: "codex:a",
      level: "focus",
      addedAt: now.toISOString(),
    });
  });

  it("moves a thread atomically before a target, retains or overrides context, and repairs NOW", () => {
    const initial = state([
      { threadId: "codex:now", level: "focus", addedAt: now.toISOString(), context: "design" },
      { threadId: "codex:focus", level: "focus", addedAt: now.toISOString() },
      { threadId: "cursor:important", level: "important", addedAt: now.toISOString(), context: "life" },
    ], "codex:now");

    const crossLane = applyMutation(initial, {
      type: "move-before",
      threadId: "cursor:important",
      level: "focus",
      beforeThreadId: "codex:focus",
      context: "engineering",
      isCurrent: true,
    }, now);
    expect(crossLane.entries.map((entry) => ({ id: entry.threadId, level: entry.level, context: entry.context }))).toEqual([
      { id: "codex:now", level: "focus", context: "design" },
      { id: "cursor:important", level: "focus", context: "engineering" },
      { id: "codex:focus", level: "focus", context: undefined },
    ]);
    expect(crossLane.currentFocusThreadId).toBe("cursor:important");

    const append = applyMutation(crossLane, {
      type: "move-before",
      threadId: "codex:now",
      level: "focus",
      beforeThreadId: null,
      isCurrent: false,
    }, now);
    expect(append.entries.filter((entry) => entry.level === "focus").map((entry) => entry.threadId)).toEqual([
      "cursor:important", "codex:focus", "codex:now",
    ]);
    expect(append.currentFocusThreadId).toBe("cursor:important");

    const blockedRemoval = applyMutation(append, {
      type: "move-before",
      threadId: "cursor:important",
      level: null,
    }, now);
    expect(blockedRemoval).toEqual(append);

    const removed = applyMutation(append, {
      type: "move-before",
      threadId: "cursor:important",
      level: null,
      currentThreadId: "codex:focus",
    }, now);
    expect(removed.currentFocusThreadId).toBe("codex:focus");
    expect(removed.entries.map((entry) => entry.threadId)).not.toContain("cursor:important");
  });

  it("rejects unsafe and ambiguously encoded deep-link schemes at the shared execution boundary", () => {
    expect(isPermittedDeepLink("https://example.test/thread", ["https"])).toBe(true);
    expect(isPermittedDeepLink("my-agent://thread/1", ["my-agent"])).toBe(true);
    for (const unsafe of [
      "javascript:alert(1)",
      "data:text/html,boom",
      "file:///private/secret",
      " JavaScript:alert(1)",
      "javascript%3Aalert(1)",
      "jav%61script:alert(1)",
      "unknown://thread/1",
    ]) {
      expect(isPermittedDeepLink(unsafe, ["https", "my-agent"])).toBe(false);
    }
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

  it("derives review-ready work by provider timestamp while Running takes precedence", () => {
    const initial = state([
      { threadId: "codex:now", level: "focus", addedAt: now.toISOString() },
      { threadId: "claude:important", level: "important", addedAt: now.toISOString() },
    ], "codex:now");
    const focusReady = agentThread("codex:now", "idle", 400);
    focusReady.review = {
      state: "ready",
      kind: "diff",
      updatedAt: 200,
      destination: { type: "url", url: "https://example.test/review/now" },
      providerStatus: "FINISHED",
    };
    const importantReady = agentThread("claude:important", "idle", 300);
    importantReady.review = {
      state: "ready",
      kind: "result",
      updatedAt: 300,
      destination: { type: "thread", deepLink: "claude://threads/important" },
      providerStatus: "READY",
    };
    const staleRunningReady = agentThread("cursor:running", "active", 500);
    staleRunningReady.review = {
      state: "ready",
      kind: "pull-request",
      updatedAt: 500,
      destination: { type: "url", url: "https://example.test/review/running" },
      providerStatus: "FINISHED",
    };
    const snapshot = buildSnapshot(initial, [focusReady, importantReady, staleRunningReady], sources);

    expect(reviewReadyDeckThreads(snapshot).map((thread) => thread.id)).toEqual([
      "claude:important",
      "codex:now",
    ]);
    expect(runningDeckThreads(snapshot).map((thread) => thread.id)).toEqual(["cursor:running"]);
    expect(JSON.stringify(initial)).not.toContain("review");
    expect(JSON.stringify(initial)).not.toContain("FINISHED");
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
    expect(resolveRpcTimeout({ GAJENDRA_RPC_TIMEOUT_MS: "12000" })).toBe(12_000);
    expect(resolveRpcTimeout({ GAJENDRA_RPC_TIMEOUT_MS: "25000" })).toBe(15_000);
    expect(resolveRpcTimeout({ AADI_RPC_TIMEOUT_MS: "18000" })).toBe(15_000);
    expect(resolveRpcTimeout({ PRIORITY_DECK_RPC_TIMEOUT_MS: "17000" })).toBe(15_000);
    expect(clampCodexRpcTimeout(5_000)).toBe(5_000);
    expect(clampCodexRpcTimeout(25_000)).toBe(15_000);
  });

  it("derives the source-generation envelope from accepted provider bounds", () => {
    expect(CODEX_PROVIDER_COLLECTION_ENVELOPE_MS).toBe(60_750);
    expect(DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS).toBe(70_000);
    expect(DEFAULT_GAJENDRA_GENERATION_DEADLINE_MS).toBeGreaterThan(CODEX_PROVIDER_COLLECTION_ENVELOPE_MS + 5_000);
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
