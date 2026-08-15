import path from "node:path";

import { describe, expect, it } from "vitest";

import { heldCodexThreadIds, rolloutTailShowsActiveTurn } from "../../src/server/codex-app-server.js";

describe("Codex desktop runtime status", () => {
  it("keeps only open thread writer locks from the configured directory", () => {
    const directory = "/Users/example/.codex/thread-writer-locks";
    const activeId = "019ffec4-b839-70e1-9fe3-dea04e6aee33";
    const output = [
      "p1679",
      `n${path.join(directory, `${activeId}.lock`)}`,
      `n${path.join(directory, ".coordination.lock")}`,
      "n/tmp/019ffeda-e986-7770-9dc4-5c814ce81717.lock",
    ].join("\n");

    expect([...heldCodexThreadIds(output, directory)]).toEqual([activeId]);
  });

  it("treats lifecycle activity after an incomplete turn as running", () => {
    const tail = [
      JSON.stringify({ type: "turn_context", payload: { cwd: "/private/project" } }),
      JSON.stringify({ type: "response_item", payload: { type: "reasoning", content: "not retained" } }),
      JSON.stringify({ type: "event_msg", payload: { type: "token_count" } }),
    ].join("\n");

    expect(rolloutTailShowsActiveTurn(tail)).toBe(true);
  });

  it("treats task_complete as idle and ignores a partial leading line", () => {
    const completed = [
      "partial private payload",
      JSON.stringify({ type: "response_item", payload: { type: "message" } }),
      JSON.stringify({ type: "event_msg", payload: { type: "task_complete" } }),
    ].join("\n");

    expect(rolloutTailShowsActiveTurn(completed, true)).toBe(false);
    expect(rolloutTailShowsActiveTurn(JSON.stringify({ type: "session_meta", payload: {} }))).toBe(false);
  });
});
