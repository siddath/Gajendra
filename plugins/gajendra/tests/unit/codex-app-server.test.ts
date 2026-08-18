import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CodexAppServerClient,
  DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES,
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
import { EMPTY_STORE } from "../../src/shared/contracts.js";
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

  it("allows local activity enrichment to be explicitly disabled", () => {
    expect(isCodexActivityEnrichmentEnabled({})).toBe(true);
    expect(isCodexActivityEnrichmentEnabled({ GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off" })).toBe(false);
    expect(isCodexActivityEnrichmentEnabled({ GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: " false " })).toBe(false);
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
      expect(() => process.kill(descendantPid!, 0)).toThrow();
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
  });

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
      // watchdog has completed; neither resilient process remains alive at this boundary.
      expect(() => process.kill(parentPid!, 0)).toThrow();
      expect(() => process.kill(descendantPid!, 0)).toThrow();
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
      expect(() => process.kill(descendantPid!, 0)).toThrow();
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
      expect(() => process.kill(descendantPid!, 0)).toThrow();
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
