import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CodexAppServerClient,
  DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES,
  enrichCodexReviewSignals,
  enrichCodexRuntimeStatuses,
  heldCodexThreadIds,
  isCodexActivityEnrichmentEnabled,
  listOpenFiles,
  listBoundedCodexThreads,
  MAX_CODEX_APP_SERVER_MAX_LINE_BYTES,
  readCodexRolloutTail,
  resolveCodexAppServerStdoutLineLimit,
  rolloutTailShowsActiveTurn,
} from "../../src/server/codex-app-server.js";
import { EMPTY_STORE, type CodexThread } from "../../src/shared/contracts.js";
import { GajendraStoreRepository } from "../../src/server/store.js";

const syntheticThreadId = (index: number): string =>
  `00000000-0000-7000-8000-${String(index).padStart(12, "0")}`;

describe("Codex desktop runtime status", () => {
  it("keeps only open thread writer locks from the configured directory", () => {
    const directory = "/Users/example/.codex/thread-writer-locks";
    const activeId = syntheticThreadId(1);
    const output = [
      "p1679",
      `n${path.join(directory, `${activeId}.lock`)}`,
      `n${path.join(directory, ".coordination.lock")}`,
      `n/tmp/${syntheticThreadId(999)}.lock`,
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

  it("uses only explicit lifecycle markers and never treats hostile response content as activity", () => {
    const hostile = [
      JSON.stringify({ type: "response_item", payload: { type: "message", content: "private prompt and response" } }),
      JSON.stringify({ type: "inter_agent_communication_metadata", payload: { content: "private coordination" } }),
    ].join("\n");
    expect(rolloutTailShowsActiveTurn(hostile)).toBe(false);
    expect(rolloutTailShowsActiveTurn(JSON.stringify({ type: "event_msg", payload: { type: "turn_in_progress", content: "ignored" } }))).toBe(true);
    expect(JSON.stringify({ active: rolloutTailShowsActiveTurn(hostile) })).not.toContain("private");
  });

  it("stops Running on an aborted turn and resumes only when later lifecycle evidence arrives", () => {
    const events = [
      JSON.stringify({ type: "turn_context" }),
      JSON.stringify({ type: "event_msg", payload: { type: "token_count" } }),
      JSON.stringify({ type: "event_msg", payload: { type: "turn_aborted" } }),
    ];
    expect(rolloutTailShowsActiveTurn(events.join("\n"))).toBe(false);
    events.push(JSON.stringify({ type: "event_msg", payload: { type: "task_started" } }));
    expect(rolloutTailShowsActiveTurn(events.join("\n"))).toBe(true);
  });

  it("allows local activity enrichment to be explicitly disabled", () => {
    expect(isCodexActivityEnrichmentEnabled({})).toBe(true);
    expect(isCodexActivityEnrichmentEnabled({ GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off" })).toBe(false);
    expect(isCodexActivityEnrichmentEnabled({ GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: " false " })).toBe(false);
  });

  it("classifies only a completed newest metadata-only turn as live Ready for Review", async () => {
    const id = syntheticThreadId(201);
    const activeId = syntheticThreadId(202);
    const systemErrorId = syntheticThreadId(203);
    const calls: unknown[] = [];
    const result = await enrichCodexReviewSignals([
      { id, recencyAt: 20, status: "idle" },
      { id: activeId, recencyAt: 30, status: "active" },
      { id: systemErrorId, recencyAt: 40, status: "systemError" },
    ], async (params) => {
      calls.push(params);
      return {
        data: [{
          status: "completed",
          completedAt: 1_786_545_400,
          itemsView: "notLoaded",
          items: [],
          error: null,
        }],
        nextCursor: null,
      };
    });

    expect(calls).toEqual([{
      threadId: id,
      limit: 1,
      sortDirection: "desc",
      itemsView: "notLoaded",
    }]);
    expect(result).toEqual({
      availability: "available",
      threads: [
        expect.objectContaining({
          id,
          gajendraReview: {
            state: "ready",
            kind: "result",
            updatedAt: 1_786_545_400,
            destination: { type: "thread", deepLink: `codex://threads/${id}` },
            providerStatus: "completed",
          },
        }),
        expect.objectContaining({ id: activeId }),
        expect.objectContaining({ id: systemErrorId }),
      ],
    });
    expect(result.threads[1]).not.toHaveProperty("gajendraReview");
    expect(result.threads[2]).not.toHaveProperty("gajendraReview");
  });

  it("allows only documented idle/notLoaded thread states into Ready for Review", async () => {
    const idleId = syntheticThreadId(204);
    const notLoadedId = syntheticThreadId(205);
    const unknownId = syntheticThreadId(206);
    const missingId = syntheticThreadId(207);
    const malformedId = syntheticThreadId(208);
    const systemErrorId = syntheticThreadId(209);
    const requestedIds: string[] = [];
    const result = await enrichCodexReviewSignals([
      { id: idleId, status: "idle" },
      { id: notLoadedId, status: { type: "notLoaded" } },
      { id: unknownId, status: "unknown" },
      { id: missingId },
      { id: malformedId, status: { type: 17 } },
      { id: systemErrorId, status: "systemError" },
    ] as unknown as CodexThread[], async ({ threadId }) => {
      requestedIds.push(threadId);
      return { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null }] };
    });
    expect(requestedIds).toEqual([idleId, notLoadedId]);
    expect(result.threads[0]).toHaveProperty("gajendraReview.state", "ready");
    expect(result.threads[1]).toHaveProperty("gajendraReview.state", "ready");
    expect(result.threads.slice(2).every((thread) => !Object.hasOwn(thread, "gajendraReview"))).toBe(true);
  });

  it("keeps structurally valid non-ready turns out of Ready for Review", async () => {
    const id = syntheticThreadId(203);
    const base = [{ id, recencyAt: 20, status: "idle" }];
    const completed = {
      data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null }],
    };
    const initial = await enrichCodexReviewSignals(base, async () => completed);
    expect(initial.threads[0]).toHaveProperty("gajendraReview.state", "ready");

    const nonReadyPages: unknown[] = [
      { data: [] },
      { data: [{ status: "inProgress", completedAt: null, itemsView: "notLoaded", items: [], error: null }] },
      { data: [{ status: "active", completedAt: null, itemsView: "notLoaded", items: [], error: null }] },
      { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] },
      { data: [{ status: "failed", completedAt: null, itemsView: "notLoaded", items: [], error: { message: "private failure detail" } }] },
    ];
    for (const page of nonReadyPages) {
      const result = await enrichCodexReviewSignals(base, async () => page);
      expect(result.availability).toBe("available");
      expect(result.threads[0]).not.toHaveProperty("gajendraReview");
      expect(JSON.stringify(result)).not.toContain("private failure detail");
    }
  });

  it("keeps four valid siblings when one completed turn omits its timestamp", async () => {
    const validIds = Array.from({ length: 4 }, (_, index) => syntheticThreadId(214 + index));
    const legacyId = syntheticThreadId(218);
    const interruptedId = syntheticThreadId(219);
    const runningId = syntheticThreadId(220);
    const privateContent = "private legacy payload must not leak";
    const requestedIds: string[] = [];
    const nowMs = 1_786_545_500_000;
    const result = await enrichCodexReviewSignals([
      ...validIds.map((id, index) => ({ id, recencyAt: 100 - index, status: "idle" })),
      { id: legacyId, recencyAt: 95, status: "idle" },
      { id: interruptedId, recencyAt: 94, status: "idle" },
      { id: runningId, recencyAt: 93, status: "running" },
    ], async ({ threadId }) => {
      requestedIds.push(threadId);
      if (validIds.includes(threadId)) {
        return { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null }] };
      }
      if (threadId === legacyId) {
        return {
          data: [{
            status: "completed",
            completedAt: null,
            itemsView: "notLoaded",
            items: [],
            error: null,
            unexpectedProviderPayload: privateContent,
          }],
        };
      }
      if (threadId === interruptedId) {
        return { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] };
      }
      throw new Error("running candidates must not be queried");
    }, { now: () => nowMs });

    const reviewThreads = result.threads.filter((thread) => Object.hasOwn(thread, "gajendraReview"));
    expect(result.availability).toBe("available");
    expect(reviewThreads).toHaveLength(4);
    expect(reviewThreads.map((thread) => thread.id)).toEqual(expect.arrayContaining(validIds));
    expect(requestedIds).toEqual(expect.arrayContaining([...validIds, legacyId, interruptedId]));
    expect(requestedIds).toHaveLength(6);
    expect(requestedIds).not.toContain(runningId);
    for (const id of [legacyId, interruptedId, runningId]) {
      expect(result.threads.find((thread) => thread.id === id)).not.toHaveProperty("gajendraReview");
    }
    expect(JSON.stringify(result)).not.toContain(privateContent);
  });

  it("fails the whole batch when a null timestamp is paired with private items or an error", async () => {
    const validId = syntheticThreadId(221);
    const poisonedId = syntheticThreadId(222);
    const poisonedPages = [
      {
        secret: "private-null-timestamp-item",
        page: {
          data: [{
            status: "completed",
            completedAt: null,
            itemsView: "notLoaded",
            items: [{ content: "private-null-timestamp-item" }],
            error: null,
          }],
        },
      },
      {
        secret: "private-null-timestamp-error",
        page: {
          data: [{
            status: "completed",
            completedAt: null,
            itemsView: "notLoaded",
            items: [],
            error: { message: "private-null-timestamp-error" },
          }],
        },
      },
    ];

    for (const { secret, page } of poisonedPages) {
      const result = await enrichCodexReviewSignals([
        { id: validId, recencyAt: 2, status: "idle" },
        { id: poisonedId, recencyAt: 1, status: "idle" },
      ], async ({ threadId }) => threadId === validId
        ? { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null }] }
        : page);
      expect(result.availability).toBe("transient");
      expect(result.threads.every((thread) => !Object.hasOwn(thread, "gajendraReview"))).toBe(true);
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  it("fails an entire review batch closed when any turn summary is structurally invalid", async () => {
    const validId = syntheticThreadId(210);
    const invalidId = syntheticThreadId(211);
    const privateItem = "private-turn-content-must-not-leak-from-a-batch";
    const result = await enrichCodexReviewSignals([
      { id: validId, recencyAt: 2, status: "idle" },
      { id: invalidId, recencyAt: 1, status: "idle" },
    ], async ({ threadId }) => threadId === validId
      ? { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null }] }
      : { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [{ content: privateItem }], error: null }] },
    );
    expect(result).toMatchObject({ availability: "transient" });
    expect(result.threads.every((thread) => !Object.hasOwn(thread, "gajendraReview"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain(privateItem);
  });

  it("rejects malformed, millisecond, unrenderable, and future completion timestamps", async () => {
    const id = syntheticThreadId(212);
    const nowMs = 1_786_545_500_000;
    const base = [{ id, recencyAt: 20, status: "idle" }];
    const timestampPage = (completedAt: unknown) => ({
      data: [{ status: "completed", completedAt, itemsView: "notLoaded", items: [], error: null }],
    });
    const invalidTimestamps: unknown[] = [
      "not-a-timestamp",
      1_786_545_400_000,
      1_786_545_501,
      8_640_000_000_001,
    ];
    for (const completedAt of invalidTimestamps) {
      const result = await enrichCodexReviewSignals(base, async () => timestampPage(completedAt), { now: () => nowMs });
      expect(result.availability).toBe("transient");
      expect(result.threads[0]).not.toHaveProperty("gajendraReview");
    }

    const unrenderableResult = await enrichCodexReviewSignals(
      base,
      async () => timestampPage(8_640_000_000_001),
      { now: () => 8_640_000_000_002_000 },
    );
    expect(unrenderableResult.availability).toBe("transient");
    expect(unrenderableResult.threads[0]).not.toHaveProperty("gajendraReview");

    const valid = await enrichCodexReviewSignals(base, async () => timestampPage(1_786_545_400), { now: () => nowMs });
    expect(valid.threads[0]).toHaveProperty("gajendraReview.updatedAt", 1_786_545_400);
  });

  it("treats malformed turn-page shape as invalid metadata evidence", async () => {
    const id = syntheticThreadId(213);
    const base = [{ id, recencyAt: 20, status: "idle" }];
    const malformedPages: unknown[] = [
      { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "summary", items: [], error: null }] },
      { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: "malformed", error: null }] },
      { data: [{ status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [] }] },
      { data: [
        { status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null },
        { status: "completed", completedAt: 1_786_545_400, itemsView: "notLoaded", items: [], error: null },
      ] },
      { malformed: true },
    ];
    for (const page of malformedPages) {
      const result = await enrichCodexReviewSignals(base, async () => page);
      expect(result.availability).toBe("transient");
      expect(result.threads[0]).not.toHaveProperty("gajendraReview");
    }
  });

  it("requires zero not-loaded items and never returns hostile turn content", async () => {
    const id = syntheticThreadId(204);
    const secret = "private-turn-content-must-not-leak";
    const result = await enrichCodexReviewSignals([{
      id,
      status: "idle",
      unexpectedProviderPayload: secret,
    }] as unknown as CodexThread[], async () => ({
      data: [{
        status: "completed",
        completedAt: 1_786_545_400,
        itemsView: "notLoaded",
        items: [{ content: secret }],
        error: null,
      }],
    }));
    expect(result.threads[0]).not.toHaveProperty("gajendraReview");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("fails closed on the shared review deadline before launching additional work", async () => {
    const threads = Array.from({ length: 9 }, (_, index) => ({
      id: syntheticThreadId(220 + index),
      recencyAt: 100 - index,
      status: "idle",
    }));
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const result = await enrichCodexReviewSignals(threads, async () => {
      calls += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise(() => undefined);
    }, { maxConcurrency: 2, deadlineMs: 25 });
    expect(calls).toBe(1);
    expect(peak).toBe(1);
    expect(result).toEqual({ availability: "transient", threads });
  });

  it("uses a small bounded review worker pool after the optional method probe", async () => {
    const threads = Array.from({ length: 7 }, (_, index) => ({
      id: syntheticThreadId(240 + index),
      recencyAt: 100 - index,
      status: "idle",
    }));
    let inFlight = 0;
    let peak = 0;
    let calls = 0;
    const result = await enrichCodexReviewSignals(threads, async () => {
      calls += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(10);
      inFlight -= 1;
      return { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] };
    }, { maxConcurrency: 2, deadlineMs: 500 });
    expect(calls).toBe(threads.length);
    expect(peak).toBe(2);
    expect(result).toEqual({ availability: "available", threads });
  });

  it("hard-clamps review workers and deadline apart from activity-tail tuning", async () => {
    const threads = Array.from({ length: 9 }, (_, index) => ({
      id: syntheticThreadId(250 + index),
      recencyAt: 100 - index,
      status: "idle",
    }));
    let inFlight = 0;
    let peak = 0;
    const pooled = await enrichCodexReviewSignals(threads, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await delay(10);
      inFlight -= 1;
      return { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] };
    }, { maxConcurrency: 99, deadlineMs: 99_999 });
    expect(peak).toBe(4);
    expect(pooled).toEqual({ availability: "available", threads });

    let clock = 0;
    let calls = 0;
    const deadline = await enrichCodexReviewSignals(threads, async () => {
      calls += 1;
      clock = 5_000;
      return { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] };
    }, { maxConcurrency: 99, deadlineMs: 99_999, now: () => clock });
    expect(calls).toBe(1);
    expect(deadline).toEqual({ availability: "transient", threads });
  });

  it("stops a transient experimental endpoint after the first metadata probe without treating it as unsupported", async () => {
    const threads = Array.from({ length: 6 }, (_, index) => ({ id: syntheticThreadId(260 + index), status: "idle" }));
    let calls = 0;
    const result = await enrichCodexReviewSignals(threads, async () => {
      calls += 1;
      throw new Error("method not found");
    }, { maxConcurrency: 4, deadlineMs: 500 });
    expect(calls).toBe(1);
    expect(result).toEqual({ availability: "transient", threads });
  });

  it("inspects at most the shared 200 newest Codex candidates", async () => {
    const threads = Array.from({ length: 240 }, (_, index) => ({
      id: syntheticThreadId(300 + index),
      recencyAt: 240 - index,
      status: "idle",
    }));
    const requestedIds: string[] = [];
    const result = await enrichCodexReviewSignals(threads, async ({ threadId }) => {
      requestedIds.push(threadId);
      return { data: [{ status: "interrupted", completedAt: null, itemsView: "notLoaded", items: [], error: null }] };
    });
    expect(requestedIds).toHaveLength(200);
    expect(requestedIds).toEqual(threads.slice(0, 200).map((thread) => thread.id));
    expect(result.threads.every((thread) => !Object.hasOwn(thread, "gajendraReview"))).toBe(true);
  });

  it("uses experimental turn metadata when supported and falls back without failing Codex listing", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-review-protocol-"));
    const fakeCodex = path.join(directory, "fake-codex");
    const id = syntheticThreadId(601);
    try {
      await writeFile(fakeCodex, `#!${process.execPath}
const fs = require("node:fs");
const readline = require("node:readline");
const logPath = process.env.GAJENDRA_TEST_REVIEW_LOG;
const threadId = process.env.GAJENDRA_TEST_REVIEW_THREAD_ID;
const startsPath = process.env.GAJENDRA_TEST_REVIEW_STARTS;
const turnsPath = process.env.GAJENDRA_TEST_REVIEW_TURNS;
let starts = 0;
try { starts = Number(fs.readFileSync(startsPath, "utf8")) || 0; } catch {}
fs.writeFileSync(startsPath, String(starts + 1));
let initialized = false;
function record(request) { fs.appendFileSync(logPath, JSON.stringify({ pid: process.pid, ...request }) + "\\n"); }
function response(request, result, error) {
  process.stdout.write(JSON.stringify(error ? { id: request.id, error } : { id: request.id, result }) + "\\n");
}
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  record(request);
  if (typeof request.id !== "number") return;
  if (request.method === "initialize") {
    if (initialized) {
      response(request, null, { code: -32000, message: "second initialize is forbidden" });
    } else if (request.params?.capabilities?.experimentalApi && process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-capability" && starts === 0) {
      response(request, null, { code: -32602, message: "unsupported experimental capability" });
    } else if (request.params?.capabilities?.experimentalApi && starts === 0 && (process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-unknown-experimental-capability" || process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-unrecognized-experimental-capability")) {
      response(request, null, { code: -32602, message: process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-unknown-experimental-capability" ? "Unknown experimental capability" : "Unrecognized experimental capability" });
    } else if (request.params?.capabilities?.experimentalApi && process.env.GAJENDRA_TEST_REVIEW_MODE === "transient-initialize-then-supported" && starts === 0) {
      response(request, null, { code: -32602, message: "Unknown internal capability failure; retry later" });
    } else if (process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-other-initialize") {
      response(request, null, { code: -32000, message: "server initialization unavailable" });
    } else response(request, {});
    initialized = true;
    return;
  }
  if (request.method === "thread/list") {
    response(request, { data: [{ id: threadId, name: "Safe metadata title", status: "idle", recencyAt: 2 }], nextCursor: null });
    return;
  }
  if (request.method === "thread/turns/list") {
    if (process.env.GAJENDRA_TEST_REVIEW_MODE === "reject-method") {
      response(request, null, { code: -32601, message: "private experimental method failure" });
    } else if (process.env.GAJENDRA_TEST_REVIEW_MODE === "transient-method-then-supported") {
      let turns = 0;
      try { turns = Number(fs.readFileSync(turnsPath, "utf8")) || 0; } catch {}
      fs.writeFileSync(turnsPath, String(turns + 1));
      if (turns === 0) response(request, null, { code: -32000, message: "Unknown internal capability failure; retry later" });
      else response(request, { data: [{ status: "completed", completedAt: 1786545400, itemsView: "notLoaded", items: [], error: null }], nextCursor: null });
    } else if (process.env.GAJENDRA_TEST_REVIEW_MODE === "timeout-then-supported") {
      let turns = 0;
      try { turns = Number(fs.readFileSync(turnsPath, "utf8")) || 0; } catch {}
      fs.writeFileSync(turnsPath, String(turns + 1));
      if (turns > 0) response(request, { data: [{ status: "completed", completedAt: 1786545400, itemsView: "notLoaded", items: [], error: null }], nextCursor: null });
    } else {
      response(request, { data: [{ status: "completed", completedAt: 1786545400, itemsView: "notLoaded", items: [], error: null }], nextCursor: null });
    }
    return;
  }
  response(request, {});
});
`);
      await chmod(fakeCodex, 0o700);

      const run = async (mode: "supported" | "reject-capability" | "reject-unknown-experimental-capability" | "reject-unrecognized-experimental-capability" | "reject-method" | "timeout-then-supported" | "transient-initialize-then-supported" | "transient-method-then-supported"): Promise<{
        threads: Awaited<ReturnType<CodexAppServerClient["listThreads"]>>;
        retryThreads: Awaited<ReturnType<CodexAppServerClient["listThreads"]>> | null;
        requests: Array<Record<string, unknown>>;
        starts: number;
      }> => {
        const logPath = path.join(directory, `${mode}.jsonl`);
        const startsPath = path.join(directory, `${mode}-starts`);
        const turnsPath = path.join(directory, `${mode}-turns`);
        // Keep the deliberate turn-metadata timeout comfortably above process startup under
        // aggregate test load. The fake still withholds only the first turns response, so this
        // exercises transient (not unsupported) retry semantics without racing initialize.
        const client = new CodexAppServerClient(2_000, {
          ...process.env,
          GAJENDRA_CODEX_BIN: fakeCodex,
          GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off",
          GAJENDRA_TEST_REVIEW_LOG: logPath,
          GAJENDRA_TEST_REVIEW_THREAD_ID: id,
          GAJENDRA_TEST_REVIEW_MODE: mode,
          GAJENDRA_TEST_REVIEW_STARTS: startsPath,
          GAJENDRA_TEST_REVIEW_TURNS: turnsPath,
        });
        try {
          let threads: Awaited<ReturnType<CodexAppServerClient["listThreads"]>>;
          if (mode === "transient-initialize-then-supported") {
            await expect(client.listThreads()).rejects.toThrow("Unknown internal capability failure; retry later");
            threads = await client.listThreads();
          } else {
            threads = await client.listThreads();
          }
          let retryThreads: Awaited<ReturnType<CodexAppServerClient["listThreads"]>> | null = null;
          // A cached unavailable endpoint must not keep trying on subsequent visible refreshes.
          if (mode === "reject-method") await expect(client.listThreads()).resolves.toEqual(threads);
          if (mode === "timeout-then-supported" || mode === "transient-method-then-supported") retryThreads = await client.listThreads();
          const requests = (await readFile(logPath, "utf8")).trim().split(/\r?\n/u)
            .filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
          return { threads, retryThreads, requests, starts: Number(await readFile(startsPath, "utf8")) };
        } finally {
          await client.close().catch(() => undefined);
        }
      };

      // These fake app-server cases have independent state files and child processes. Running
      // them together keeps the intentionally withheld 2 s response from accumulating with
      // unrelated fallback teardown, while preserving every protocol deadline and assertion.
      const [
        supported,
        capabilityFallback,
        explicitCapabilityFallbacks,
        methodFallback,
        transientInitialize,
        transientMethod,
        transient,
      ] = await Promise.all([
        run("supported"),
        run("reject-capability"),
        Promise.all([
          run("reject-unknown-experimental-capability"),
          run("reject-unrecognized-experimental-capability"),
        ]),
        run("reject-method"),
        run("transient-initialize-then-supported"),
        run("transient-method-then-supported"),
        run("timeout-then-supported"),
      ]);
      expect(supported.threads[0]).toMatchObject({
        id,
        gajendraReview: { destination: { type: "thread", deepLink: `codex://threads/${id}` }, providerStatus: "completed" },
      });
      const supportedInitialize = supported.requests.find((request) => request.method === "initialize");
      expect(supportedInitialize).toMatchObject({ params: { capabilities: { experimentalApi: true, requestAttestation: false } } });
      expect(supported.requests).toContainEqual(expect.objectContaining({
        method: "thread/turns/list",
        params: { threadId: id, limit: 1, sortDirection: "desc", itemsView: "notLoaded" },
      }));

      expect(capabilityFallback.threads).toEqual([expect.objectContaining({ id })]);
      expect(capabilityFallback.threads[0]).not.toHaveProperty("gajendraReview");
      expect(capabilityFallback.requests.filter((request) => request.method === "initialize")).toHaveLength(2);
      expect(capabilityFallback.starts).toBe(2);
      const fallbackInitializes = capabilityFallback.requests.filter((request) => request.method === "initialize");
      expect(new Set(fallbackInitializes.map((request) => request.pid))).toHaveLength(2);
      expect(fallbackInitializes).toEqual([
        expect.objectContaining({ params: expect.objectContaining({ capabilities: { experimentalApi: true, requestAttestation: false } }) }),
        expect.objectContaining({ params: expect.objectContaining({ capabilities: null }) }),
      ]);
      expect(capabilityFallback.requests.some((request) => request.method === "thread/turns/list")).toBe(false);

      for (const explicitCapabilityFallback of explicitCapabilityFallbacks) {
        expect(explicitCapabilityFallback.threads[0]).not.toHaveProperty("gajendraReview");
        expect(explicitCapabilityFallback.starts).toBe(2);
        expect(explicitCapabilityFallback.requests.filter((request) => request.method === "initialize")).toEqual([
          expect.objectContaining({ params: expect.objectContaining({ capabilities: { experimentalApi: true, requestAttestation: false } }) }),
          expect.objectContaining({ params: expect.objectContaining({ capabilities: null }) }),
        ]);
      }

      expect(methodFallback.threads[0]).not.toHaveProperty("gajendraReview");
      expect(methodFallback.requests.filter((request) => request.method === "thread/turns/list")).toHaveLength(1);
      expect(JSON.stringify(methodFallback.threads)).not.toContain("private experimental method failure");

      expect(transientInitialize.threads[0]).toMatchObject({ gajendraReview: { state: "ready" } });
      expect(transientInitialize.starts).toBe(2);
      const transientInitializes = transientInitialize.requests.filter((request) => request.method === "initialize");
      expect(transientInitializes).toHaveLength(2);
      expect(transientInitializes).toEqual([
        expect.objectContaining({ params: expect.objectContaining({ capabilities: { experimentalApi: true, requestAttestation: false } }) }),
        expect.objectContaining({ params: expect.objectContaining({ capabilities: { experimentalApi: true, requestAttestation: false } }) }),
      ]);

      expect(transientMethod.threads[0]).not.toHaveProperty("gajendraReview");
      expect(transientMethod.retryThreads?.[0]).toMatchObject({ gajendraReview: { state: "ready", providerStatus: "completed" } });
      expect(transientMethod.requests.filter((request) => request.method === "thread/turns/list")).toHaveLength(2);
      expect(transientMethod.starts).toBe(1);

      expect(transient.threads[0]).not.toHaveProperty("gajendraReview");
      expect(transient.retryThreads?.[0]).toMatchObject({ gajendraReview: { state: "ready", providerStatus: "completed" } });
      expect(transient.requests.filter((request) => request.method === "thread/turns/list")).toHaveLength(2);
      expect(transient.starts).toBe(1);

      const otherLogPath = path.join(directory, "reject-other-initialize.jsonl");
      const otherStartsPath = path.join(directory, "reject-other-initialize-starts");
      const other = new CodexAppServerClient(2_000, {
        ...process.env,
        GAJENDRA_CODEX_BIN: fakeCodex,
        GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off",
        GAJENDRA_TEST_REVIEW_LOG: otherLogPath,
        GAJENDRA_TEST_REVIEW_THREAD_ID: id,
        GAJENDRA_TEST_REVIEW_MODE: "reject-other-initialize",
        GAJENDRA_TEST_REVIEW_STARTS: otherStartsPath,
        GAJENDRA_TEST_REVIEW_TURNS: path.join(directory, "reject-other-initialize-turns"),
      });
      try {
        await expect(other.listThreads()).rejects.toThrow("server initialization unavailable");
        expect(await readFile(otherStartsPath, "utf8")).toBe("1");
      } finally {
        await other.close().catch(() => undefined);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);

  it("recovers omitted interactive roots only from metadata and held active lifecycle evidence", async () => {
    const directory = "/private/synthetic-codex";
    const sessions = path.join(directory, "sessions");
    const ids = Array.from({ length: 9 }, (_, i) => syntheticThreadId(800 + i));
    const base = [{ id: ids[0]!, status: "active" }];
    const calls: unknown[] = [];
    const tails: string[] = [];
    const result = await enrichCodexRuntimeStatuses(base, { CODEX_HOME: directory }, {
      listOpenFiles: async () => lockOutput(path.join(directory, "thread-writer-locks"), ids),
      resolveSessionsDirectory: async () => sessions,
      readThread: async (params) => {
        calls.push(params);
        const index = ids.indexOf(params.threadId);
        return { thread: {
          id: index === 8 ? syntheticThreadId(999) : params.threadId,
          name: "Safe task", path: path.join(sessions, `${params.threadId}.jsonl`),
          source: index === 3 ? { subAgent: "review" } : "vscode",
          parentThreadId: index === 4 ? ids[0] : null,
          ephemeral: index === 5, canAcceptDirectInput: index !== 6,
          turns: index === 7 ? [{ private: "never-retain-turns" }] : [],
          privateField: "never-retain-extra", status: "notLoaded",
        } };
      },
      readTail: async (file) => {
        tails.push(file);
        return { text: JSON.stringify({ type: "event_msg", payload: {
          type: file.includes(ids[2]!) ? "task_complete" : "turn_in_progress",
        } }), truncated: false };
      },
    });
    expect(result.map((thread) => thread.id)).toEqual(ids.slice(0, 2));
    expect(result[1]?.status).toEqual({ type: "active" });
    expect(calls).toEqual(ids.slice(1).map((threadId) => ({ threadId, includeTurns: false })));
    expect(tails).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("never-retain");
  });

  it("bounds omitted-task metadata reads and drops recovery on deadline or unsafe paths", async () => {
    const directory = "/private/synthetic-codex";
    const sessions = path.join(directory, "sessions");
    const ids = Array.from({ length: 205 }, (_, i) => syntheticThreadId(1000 + i));
    let calls = 0;
    let inFlight = 0;
    let peak = 0;
    const discovery = {
      listOpenFiles: async () => lockOutput(path.join(directory, "thread-writer-locks"), ids),
      resolveSessionsDirectory: async () => sessions,
    };
    const result = await enrichCodexRuntimeStatuses([], { CODEX_HOME: directory }, {
      ...discovery, maxConcurrency: 3,
      readThread: async ({ threadId }) => {
        calls += 1; inFlight += 1; peak = Math.max(peak, inFlight);
        await delay(1); inFlight -= 1;
        return { thread: { id: threadId, path: "/outside/sessions.jsonl", source: "vscode", ephemeral: false, turns: [] } };
      },
      readTail: async () => { throw new Error("unconfined path"); },
    });
    expect(result).toEqual([]);
    expect(calls).toBe(200);
    expect(peak).toBeLessThanOrEqual(3);
    const base = [{ id: ids[0]!, status: "notLoaded", path: path.join(sessions, `${ids[0]}.jsonl`) }];
    let stalledCalls = 0;
    await expect(enrichCodexRuntimeStatuses(base, { CODEX_HOME: directory }, {
      ...discovery, maxConcurrency: 2, deadlineMs: 20,
      readTail: async () => ({ text: JSON.stringify({ type: "turn_context" }), truncated: false }),
      readThread: async () => { stalledCalls += 1; return new Promise(() => undefined); },
    })).resolves.toEqual([{ ...base[0], status: { type: "active" } }]);
    expect(stalledCalls).toBe(2);
    let cappedCalls = 0;
    const full = Array.from({ length: 2_000 }, (_, i) => ({ id: syntheticThreadId(3000 + i), status: "active" }));
    await expect(enrichCodexRuntimeStatuses(full, { CODEX_HOME: directory }, {
      ...discovery, readThread: async () => { cappedCalls += 1; return {}; },
    })).resolves.toEqual(full);
    expect(cappedCalls).toBe(0);
  });

  it("uses a small bounded rollout worker pool and abandons a whole timed-out enrichment", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-enrichment-"));
    try {
      const lockDirectory = path.join(directory, "thread-writer-locks");
      const sessionsDirectory = path.join(directory, "sessions");
      const ids = Array.from({ length: 9 }, (_, index) => syntheticThreadId(index + 1));
      const threads = ids.map((id) => ({ id, path: path.join(sessionsDirectory, `${id}.jsonl`), status: "idle" }));
      let inFlight = 0;
      let peak = 0;
      let calls = 0;
      const enriched = await enrichCodexRuntimeStatuses(threads, { CODEX_HOME: directory }, {
        maxConcurrency: 3,
        deadlineMs: 500,
        listOpenFiles: async () => lockOutput(lockDirectory, ids),
        resolveSessionsDirectory: async () => sessionsDirectory,
        readTail: async () => {
          calls += 1;
          inFlight += 1;
          peak = Math.max(peak, inFlight);
          await delay(10);
          inFlight -= 1;
          return { text: JSON.stringify({ type: "event_msg", payload: { type: "turn_in_progress" } }), truncated: false };
        },
      });
      expect(calls).toBe(ids.length);
      expect(peak).toBeLessThanOrEqual(3);
      expect(enriched.every((thread) => typeof thread.status === "object" && thread.status.type === "active")).toBe(true);

      let stalledCalls = 0;
      const base = await enrichCodexRuntimeStatuses(threads, { CODEX_HOME: directory }, {
        maxConcurrency: 2,
        deadlineMs: 20,
        listOpenFiles: async () => lockOutput(lockDirectory, ids),
        resolveSessionsDirectory: async () => sessionsDirectory,
        readTail: async () => {
          stalledCalls += 1;
          return new Promise(() => undefined);
        },
      });
      expect(stalledCalls).toBe(2);
      expect(base).toEqual(threads);

      const failed = await enrichCodexRuntimeStatuses(threads.slice(0, 2), { CODEX_HOME: directory }, {
        listOpenFiles: async () => lockOutput(lockDirectory, ids.slice(0, 2)),
        resolveSessionsDirectory: async () => sessionsDirectory,
        readTail: async (filePath) => {
          if (filePath.includes(ids[0]!)) throw new Error("hostile rollout cannot be read");
          return { text: JSON.stringify({ type: "event_msg", payload: { type: "turn_in_progress" } }), truncated: false };
        },
      });
      expect(failed).toEqual([
        expect.objectContaining({ id: ids[0], status: "idle" }),
        expect.objectContaining({ id: ids[1], status: { type: "active" } }),
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps hostile rollout content out of enrichment output and persisted priority state", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-hostile-rollout-"));
    try {
      const sessions = path.join(directory, "sessions");
      const lockDirectory = path.join(directory, "thread-writer-locks");
      const id = syntheticThreadId(101);
      const rollout = path.join(sessions, "2026", `${id}.jsonl`);
      const hostile = "private-rollout-content-must-not-escape";
      await mkdir(path.dirname(rollout), { recursive: true });
      await writeFile(rollout, [
        JSON.stringify({ type: "response_item", payload: { type: "message", content: hostile } }),
        "x".repeat(300 * 1024),
        JSON.stringify({ type: "event_msg", payload: { type: "turn_in_progress" } }),
      ].join("\n"));
      const tail = await readCodexRolloutTail(rollout, sessions);
      expect(Buffer.byteLength(tail.text)).toBeLessThanOrEqual(256 * 1024);
      expect(tail.text).not.toContain(hostile);
      const [enriched] = await enrichCodexRuntimeStatuses([
        { id, name: "Safe Codex title", path: rollout, status: "idle" },
      ], { CODEX_HOME: directory }, {
        listOpenFiles: async () => lockOutput(lockDirectory, [id]),
      });
      expect(enriched).toMatchObject({ id, status: { type: "active" } });
      expect(JSON.stringify(enriched)).not.toContain(hostile);

      const repository = new GajendraStoreRepository(path.join(directory, "store"));
      await repository.write({
        ...structuredClone(EMPTY_STORE),
        currentFocusThreadId: `codex:${id}`,
        entries: [{ threadId: `codex:${id}`, level: "focus", addedAt: "2026-08-18T00:00:00.000Z" }],
      });
      const persisted = await readFile(repository.filePath, "utf8");
      expect(persisted).not.toContain(hostile);
      expect(persisted).not.toContain("response_item");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("does not invoke discovery or any rollout read when the enrichment kill switch is off", async () => {
    let discoveryCalls = 0;
    const threads = [{ id: syntheticThreadId(102), path: "/private/never-read.jsonl", status: "idle" }];
    await expect(enrichCodexRuntimeStatuses(threads, { GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off" }, {
      listOpenFiles: async () => {
        discoveryCalls += 1;
        throw new Error("must not run");
      },
    })).resolves.toBe(threads);
    expect(discoveryCalls).toBe(0);
  });

  it("bounds an unterminated Codex app-server JSON-RPC frame, resets, and permits a clean retry", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-rpc-frame-"));
    const fakeCodex = path.join(directory, "fake-codex");
    const statePath = path.join(directory, "starts");
    const parentPidPath = path.join(directory, "overflow-parent.pid");
    const descendantPidPath = path.join(directory, "overflow-descendant.pid");
    const descendantReadyPath = path.join(directory, "overflow-descendant-ready");
    const descendant = "const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(process.env.GAJENDRA_TEST_RPC_DESCENDANT_READY_PATH, 'ready'); setInterval(() => {}, 1_000);";
    let client: CodexAppServerClient | null = null;
    try {
      await writeFile(fakeCodex, `#!${process.execPath}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const statePath = process.env.GAJENDRA_TEST_RPC_STATE_PATH;
let starts = 0;
try { starts = Number(fs.readFileSync(statePath, "utf8")) || 0; } catch {}
fs.writeFileSync(statePath, String(starts + 1));
if (starts === 0) {
  fs.writeFileSync(process.env.GAJENDRA_TEST_RPC_PARENT_PID_PATH, String(process.pid));
  process.on("SIGTERM", () => {});
  const child = spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
  fs.writeFileSync(process.env.GAJENDRA_TEST_RPC_DESCENDANT_PID_PATH, String(child.pid));
  const ready = setInterval(() => {
    if (!fs.existsSync(process.env.GAJENDRA_TEST_RPC_DESCENDANT_READY_PATH)) return;
    clearInterval(ready);
    process.stdout.write("x".repeat(Number(process.env.GAJENDRA_TEST_RPC_BYTES)));
    setInterval(() => {}, 1_000);
  }, 5);
} else {
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    const request = JSON.parse(line);
    if (typeof request.id !== "number") return;
    const result = request.method === "thread/list" ? { data: [], nextCursor: null } : {};
    process.stdout.write(JSON.stringify({ id: request.id, result }) + "\\n");
  });
}
`);
      await chmod(fakeCodex, 0o700);
      client = new CodexAppServerClient(5_000, {
        ...process.env,
        GAJENDRA_CODEX_BIN: fakeCodex,
        GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES: "64",
        GAJENDRA_TEST_RPC_BYTES: "65",
        GAJENDRA_TEST_RPC_STATE_PATH: statePath,
        GAJENDRA_TEST_RPC_PARENT_PID_PATH: parentPidPath,
        GAJENDRA_TEST_RPC_DESCENDANT_PID_PATH: descendantPidPath,
        GAJENDRA_TEST_RPC_DESCENDANT_READY_PATH: descendantReadyPath,
      });
      const startedAt = Date.now();
      const error = await client.listThreads().then(
        () => new Error("The over-limit child unexpectedly returned threads."),
        (reason: unknown) => reason,
      );
      const [parentPid, descendantPid] = (await Promise.all([
        readFileWhenAvailable(parentPidPath),
        readFileWhenAvailable(descendantPidPath),
      ])).map(Number);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Codex app-server protocol output exceeded the safe limit.");
      expect((error as Error).message).not.toContain("x".repeat(65));
      expect(Date.now() - startedAt).toBeLessThan(3_000);
      // Retry is gated on old-child close, so a descendant retaining inherited stdout/stderr
      // cannot overlap the fresh app-server process.
      await expect(client.listThreads()).resolves.toEqual([]);
      expect(await readFile(statePath, "utf8")).toBe("2");
      expect(() => process.kill(parentPid!, 0)).toThrow();
      await expectProcessTerminated(descendantPid!);
      await client.close();
    } finally {
      await client?.close().catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts a near-default Codex frame but rejects default-plus-one and over-hard-limit frames without output leaks", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-rpc-sized-frame-"));
    const fakeCodex = path.join(directory, "fake-codex");
    const { GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES: _ignoredLimit, ...baseEnvironment } = process.env;
    try {
      await writeFile(fakeCodex, `#!${process.execPath}
const readline = require("node:readline");
function writeResponse(request) {
  const result = request.method === "thread/list"
    ? { data: [], nextCursor: null, padding: "" }
    : {};
  const response = { id: request.id, result };
  if (request.method === "thread/list") {
    const targetBytes = Number(process.env.GAJENDRA_TEST_RPC_RESPONSE_BYTES);
    result.padding = "x".repeat(Math.max(0, targetBytes - Buffer.byteLength(JSON.stringify(response))));
  }
  process.stdout.write(JSON.stringify(response) + "\\n");
}
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (typeof request.id === "number") writeResponse(request);
});
`);
      await chmod(fakeCodex, 0o700);

      expect(resolveCodexAppServerStdoutLineLimit({})).toBe(DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES);
      expect(resolveCodexAppServerStdoutLineLimit({
        GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES: String(MAX_CODEX_APP_SERVER_MAX_LINE_BYTES + 1),
      })).toBe(MAX_CODEX_APP_SERVER_MAX_LINE_BYTES);

      const successfulClient = new CodexAppServerClient(3_000, {
        ...baseEnvironment,
        GAJENDRA_CODEX_BIN: fakeCodex,
        GAJENDRA_TEST_RPC_RESPONSE_BYTES: String(DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES - 1),
      });
      try {
        const threads = await successfulClient.listThreads();
        expect(threads).toEqual([]);
        expect(JSON.stringify(threads)).not.toContain("x".repeat(65));
      } finally {
        await successfulClient.close().catch(() => undefined);
      }

      for (const scenario of [
        { responseBytes: DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES + 1, limit: undefined },
        { responseBytes: MAX_CODEX_APP_SERVER_MAX_LINE_BYTES + 1, limit: MAX_CODEX_APP_SERVER_MAX_LINE_BYTES + 32 },
      ]) {
        const client = new CodexAppServerClient(3_000, {
          ...baseEnvironment,
          GAJENDRA_CODEX_BIN: fakeCodex,
          GAJENDRA_TEST_RPC_RESPONSE_BYTES: String(scenario.responseBytes),
          ...(scenario.limit === undefined
            ? {}
            : { GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES: String(scenario.limit) }),
        });
        try {
          const error = await client.listThreads().then(
            () => new Error("The over-limit app-server frame unexpectedly returned threads."),
            (reason: unknown) => reason,
          );
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("Codex app-server protocol output exceeded the safe limit.");
          expect((error as Error).message).not.toContain("x".repeat(65));
        } finally {
          await client.close().catch(() => undefined);
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);

  it("awaits primary app-server group teardown before close returns", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-app-server-close-"));
    const fakeCodex = path.join(directory, "fake-codex");
    const parentPidPath = path.join(directory, "close-parent.pid");
    const descendantPidPath = path.join(directory, "close-descendant.pid");
    const descendant = "const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(process.env.GAJENDRA_TEST_CLOSE_DESCENDANT_PID_PATH, String(process.pid)); setInterval(() => {}, 1_000);";
    let client: CodexAppServerClient | null = null;
    try {
      await writeFile(fakeCodex, `#!${process.execPath}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
fs.writeFileSync(process.env.GAJENDRA_TEST_CLOSE_PARENT_PID_PATH, String(process.pid));
process.on("SIGTERM", () => {});
spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (typeof request.id !== "number") return;
  const result = request.method === "thread/list" ? { data: [], nextCursor: null } : {};
  process.stdout.write(JSON.stringify({ id: request.id, result }) + "\\n");
});
`);
      await chmod(fakeCodex, 0o700);
      client = new CodexAppServerClient(5_000, {
        ...process.env,
        GAJENDRA_CODEX_BIN: fakeCodex,
        GAJENDRA_TEST_CLOSE_PARENT_PID_PATH: parentPidPath,
        GAJENDRA_TEST_CLOSE_DESCENDANT_PID_PATH: descendantPidPath,
      });
      await expect(client.listThreads()).resolves.toEqual([]);
      const [parentPid, descendantPid] = (await Promise.all([
        readFileWhenAvailable(parentPidPath),
        readFileWhenAvailable(descendantPidPath),
      ])).map(Number);
      const startedAt = Date.now();
      await client.close();
      expect(Date.now() - startedAt).toBeLessThan(2_000);
      // close() resolves only after the lifecycle has observed close or the bounded local-pipe
      // watchdog has completed; neither resilient process remains runnable at this boundary.
      // Linux PID 1 may retain the killed orphan briefly as a zombie, for which kill(pid, 0)
      // succeeds even though it cannot execute or retain pipes.
      expect(() => process.kill(parentPid!, 0)).toThrow();
      await expectProcessTerminated(descendantPid!);
    } finally {
      await client?.close().catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("cancels an overflow-queued app-server retry when close begins before teardown completes", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-app-server-close-race-"));
    const fakeCodex = path.join(directory, "fake-codex");
    const statePath = path.join(directory, "starts");
    const parentPidPath = path.join(directory, "race-parent.pid");
    const descendantPidPath = path.join(directory, "race-descendant.pid");
    const descendant = "const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(process.env.GAJENDRA_TEST_RACE_DESCENDANT_PID_PATH, String(process.pid)); setInterval(() => {}, 1_000);";
    let client: CodexAppServerClient | null = null;
    try {
      await writeFile(fakeCodex, `#!${process.execPath}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const statePath = process.env.GAJENDRA_TEST_RACE_STATE_PATH;
let starts = 0;
try { starts = Number(fs.readFileSync(statePath, "utf8")) || 0; } catch {}
fs.writeFileSync(statePath, String(starts + 1));
if (starts === 0) {
  fs.writeFileSync(process.env.GAJENDRA_TEST_RACE_PARENT_PID_PATH, String(process.pid));
  process.on("SIGTERM", () => {});
  spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
  const ready = setInterval(() => {
    if (!fs.existsSync(process.env.GAJENDRA_TEST_RACE_DESCENDANT_PID_PATH)) return;
    clearInterval(ready);
    process.stdout.write("x".repeat(65));
    setInterval(() => {}, 1_000);
  }, 5);
} else {
  readline.createInterface({ input: process.stdin }).on("line", (line) => {
    const request = JSON.parse(line);
    if (typeof request.id !== "number") return;
    const result = request.method === "thread/list" ? { data: [], nextCursor: null } : {};
    process.stdout.write(JSON.stringify({ id: request.id, result }) + "\\n");
  });
}
`);
      await chmod(fakeCodex, 0o700);
      client = new CodexAppServerClient(5_000, {
        ...process.env,
        GAJENDRA_CODEX_BIN: fakeCodex,
        GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES: "64",
        GAJENDRA_TEST_RACE_STATE_PATH: statePath,
        GAJENDRA_TEST_RACE_PARENT_PID_PATH: parentPidPath,
        GAJENDRA_TEST_RACE_DESCENDANT_PID_PATH: descendantPidPath,
      });
      const overflowStartedAt = Date.now();
      const overflow = client.listThreads().then(
        () => new Error("The over-limit child unexpectedly returned threads."),
        (reason: unknown) => reason,
      );
      const [parentPid, descendantPid] = (await Promise.all([
        readFileWhenAvailable(parentPidPath),
        readFileWhenAvailable(descendantPidPath),
      ])).map(Number);
      const overflowError = await overflow;
      expect((overflowError as Error).message).toBe("Codex app-server protocol output exceeded the safe limit.");
      expect(Date.now() - overflowStartedAt).toBeLessThan(3_000);
      // Let the rejected initial ready promise clear before installing the retry behind teardown.
      await Promise.resolve();
      const retry = client.listThreads().then(
        () => new Error("A terminal close must not start a queued app-server retry."),
        (reason: unknown) => reason,
      );
      await client.close();
      const retryError = await retry;
      expect(retryError).toBeInstanceOf(Error);
      expect((retryError as Error).message).toBe("Codex app-server client is closed.");
      expect(await readFile(statePath, "utf8")).toBe("1");
      expect(() => process.kill(parentPid!, 0)).toThrow();
      await expectProcessTerminated(descendantPid!);
    } finally {
      await client?.close().catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("TERM/KILL bounds lsof discovery, drains output, and never exposes a resistant child's stderr", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-lsof-timeout-"));
    const fakeLsof = path.join(directory, "fake-lsof");
    const parentPidPath = path.join(directory, "fake-lsof-parent.pid");
    const descendantPidPath = path.join(directory, "fake-lsof-descendant.pid");
    const privateStderr = "private-lsof-stderr-must-not-escape";
    const descendant = "process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000);";
    try {
      await writeFile(fakeLsof, `#!${process.execPath}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
fs.writeFileSync(process.env.GAJENDRA_TEST_LSOF_PARENT_PID_PATH, String(process.pid));
process.on("SIGTERM", () => {});
const child = spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
fs.writeFileSync(process.env.GAJENDRA_TEST_LSOF_DESCENDANT_PID_PATH, String(child.pid));
process.stderr.write(${JSON.stringify(privateStderr)});
process.stdout.write("n/private/lock.lock\\n");
setInterval(() => {}, 1_000);
`);
      await chmod(fakeLsof, 0o700);
      const startedAt = Date.now();
      // Consume both outcomes immediately: a slow fake executable must not turn the PID-read
      // readiness failure into an unrelated unhandled rejection from the timed command.
      const completion = listOpenFiles(directory, {
        ...process.env,
        GAJENDRA_LSOF_BIN: fakeLsof,
        GAJENDRA_TEST_LSOF_PARENT_PID_PATH: parentPidPath,
        GAJENDRA_TEST_LSOF_DESCENDANT_PID_PATH: descendantPidPath,
      }, { timeoutMs: 2_000, killGraceMs: 25, closeGraceMs: 25, outputLimitBytes: 32 }).then(
        () => new Error("The TERM-resistant lsof child unexpectedly completed."),
        (reason: unknown) => reason,
      );
      const [parentPid, descendantPid] = (await Promise.all([
        readFileWhenAvailable(parentPidPath, 3_000),
        readFileWhenAvailable(descendantPidPath, 3_000),
      ])).map(Number);
      const error = await completion;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("lsof timed out after 2000ms.");
      expect((error as Error).message).not.toContain(privateStderr);
      expect(Date.now() - startedAt).toBeLessThan(3_000);
      expect(() => process.kill(parentPid!, 0)).toThrow();
      await expectProcessTerminated(descendantPid!);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed after lsof exits while a TERM-resistant descendant retains inherited pipes", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-lsof-inherited-pipe-"));
    const fakeLsof = path.join(directory, "fake-lsof");
    const parentPidPath = path.join(directory, "fake-lsof-parent.pid");
    const descendantPidPath = path.join(directory, "fake-lsof-descendant.pid");
    const descendantReadyPath = path.join(directory, "fake-lsof-descendant-ready");
    const descendant = "const fs = require('node:fs'); process.on('SIGTERM', () => {}); fs.writeFileSync(process.env.GAJENDRA_TEST_LSOF_DESCENDANT_READY_PATH, 'ready'); setInterval(() => {}, 1_000);";
    try {
      await writeFile(fakeLsof, `#!${process.execPath}
const fs = require("node:fs");
const { spawn } = require("node:child_process");
fs.writeFileSync(process.env.GAJENDRA_TEST_LSOF_PARENT_PID_PATH, String(process.pid));
const child = spawn(process.execPath, ["-e", ${JSON.stringify(descendant)}], { stdio: ["ignore", "inherit", "inherit"], env: process.env });
fs.writeFileSync(process.env.GAJENDRA_TEST_LSOF_DESCENDANT_PID_PATH, String(child.pid));
const ready = setInterval(() => {
  if (!fs.existsSync(process.env.GAJENDRA_TEST_LSOF_DESCENDANT_READY_PATH)) return;
  clearInterval(ready);
  process.exit(0);
}, 1);
`);
      await chmod(fakeLsof, 0o700);
      const startedAt = Date.now();
      // Give the synthetic descendant enough startup budget under aggregate hosted load. The
      // tighter assertion below still proves this parent-exit watchdog path settles promptly.
      const completion = listOpenFiles(directory, {
        ...process.env,
        GAJENDRA_LSOF_BIN: fakeLsof,
        GAJENDRA_TEST_LSOF_PARENT_PID_PATH: parentPidPath,
        GAJENDRA_TEST_LSOF_DESCENDANT_PID_PATH: descendantPidPath,
        GAJENDRA_TEST_LSOF_DESCENDANT_READY_PATH: descendantReadyPath,
      }, { timeoutMs: 5_000, killGraceMs: 25, closeGraceMs: 100, outputLimitBytes: 32 }).then(
        () => new Error("The inherited-pipe lsof fixture unexpectedly completed."),
        (reason: unknown) => reason,
      );
      const [parentPid, descendantPid] = (await Promise.all([
        readFileWhenAvailable(parentPidPath, 3_000),
        readFileWhenAvailable(descendantPidPath, 3_000),
      ])).map(Number);
      const error = await completion;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("lsof did not close its output streams.");
      // This outer measurement includes fixture startup under aggregate CI load. Keep it aligned
      // with the explicit readiness budget above; the exact watchdog branch and process-death
      // assertions below prove the bounded product cleanup rather than scheduler speed.
      expect(Date.now() - startedAt).toBeLessThan(3_000);
      // This is immediately after the watchdog's rejection, not merely after scheduling KILL.
      // Linux may retain an orphaned descendant briefly as a non-running zombie until PID 1
      // reaps it, so distinguish that state from a process that can still execute.
      expect(() => process.kill(parentPid!, 0)).toThrow();
      await expectProcessTerminated(descendantPid!);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("caps lsof stdout before retaining an over-limit TERM-resistant child", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-lsof-output-cap-"));
    const fakeLsof = path.join(directory, "fake-lsof");
    try {
      await writeFile(fakeLsof, `#!${process.execPath}
process.on("SIGTERM", () => {});
process.stdout.write("x".repeat(33));
setInterval(() => {}, 1_000);
`);
      await chmod(fakeLsof, 0o700);
      const command = listOpenFiles(directory, {
        ...process.env,
        GAJENDRA_LSOF_BIN: fakeLsof,
      }, { timeoutMs: 2_000, killGraceMs: 25, outputLimitBytes: 32 });
      const error = await command.then(
        () => new Error("The over-limit lsof child unexpectedly completed."),
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("lsof exceeded the safe output limit.");
      expect((error as Error).message).not.toContain("x".repeat(33));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("caps Codex listing pages, rows, and total elapsed time", async () => {
    let pages = 0;
    await expect(listBoundedCodexThreads(async () => {
      pages += 1;
      return { data: [{ id: `thread-${pages}` }], nextCursor: `cursor-${pages}` };
    }, { maxPages: 2, maxRows: 10 })).rejects.toThrow("page limit");
    expect(pages).toBe(2);

    await expect(listBoundedCodexThreads(async () => ({
      data: [{ id: "thread-1" }, { id: "thread-2" }],
      nextCursor: "more",
    }), { maxPages: 3, maxRows: 2 })).rejects.toThrow("row limit");

    let now = 0;
    await expect(listBoundedCodexThreads(async () => {
      now = 11;
      return { data: [{ id: "thread-1" }], nextCursor: null };
    }, { maxPages: 2, maxRows: 2, deadlineMs: 10, now: () => now })).rejects.toThrow("total listing deadline");

    await expect(listBoundedCodexThreads(
      async () => new Promise(() => undefined),
      { maxPages: 2, maxRows: 2, deadlineMs: 20 },
    )).rejects.toThrow("total listing deadline");
  });

  it("rejects rollout symlinks that escape the real Codex sessions directory", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-codex-rollout-"));
    try {
      const sessions = path.join(directory, "sessions");
      const outside = path.join(directory, "outside.jsonl");
      const escaped = path.join(sessions, "escaped.jsonl");
      await mkdir(sessions, { recursive: true });
      await writeFile(outside, JSON.stringify({ type: "event_msg", payload: { type: "turn_in_progress" } }));
      await symlink(outside, escaped);

      await expect(readCodexRolloutTail(escaped, sessions)).rejects.toThrow("outside the sessions directory");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

function lockOutput(lockDirectory: string, ids: string[]): string {
  return ids.map((id) => `n${path.join(lockDirectory, `${id}.lock`)}`).join("\n");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Hosted aggregate runs can delay synthetic child startup beyond the local 1.5s observation
// window. This remains below every fixture's 5s request budget and does not change product timeouts.
async function readFileWhenAvailable(filePath: string, timeoutMs = 3_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
}

async function expectProcessTerminated(pid: number, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }

    if (process.platform === "linux") {
      try {
        const stat = await readFile(`/proc/${pid}/stat`, "utf8");
        const commandEnd = stat.lastIndexOf(")");
        if (commandEnd >= 0 && stat.slice(commandEnd + 2).startsWith("Z")) return;
      } catch {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error(`Process ${pid} remained runnable after ${timeoutMs}ms.`);
}
