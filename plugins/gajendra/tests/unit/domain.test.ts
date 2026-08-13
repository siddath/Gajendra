import { describe, expect, it } from "vitest";

import { EMPTY_STORE, type AgentThread, type PriorityStore, type ThreadSourceStatus } from "../../src/shared/contracts.js";
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
    expect(result.sourcePreferences).toMatchObject({ codex: true, claude: false, cursor: true });
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

  it("uses canonical source-qualified thread IDs", () => {
    expect(canonicalThreadId("cursor", "abc")).toBe("cursor:abc");
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
