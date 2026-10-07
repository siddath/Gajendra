#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, chmod, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "plugins/gajendra/dist/server.mjs");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gajendra-product-sync-"));
const dataDir = path.join(tempRoot, "data");
const catalogPath = path.join(tempRoot, "catalog.json");
const sourcesPath = path.join(tempRoot, "sources.json");
const storePath = path.join(dataDir, "gajendra.v2.json");
const ids = {
  predecessor: "synthetic:predecessor",
  successor: "synthetic:successor",
  review: "synthetic:aged-review",
};
let client;
let transport;

async function cli(command, mutation) {
  const args = command === "snapshot" ? ["--snapshot-json"] : ["--mutate-json"];
  const result = await runBounded(process.execPath, [serverPath, ...args], {
    env: processEnv,
    input: mutation === undefined ? undefined : `${JSON.stringify(mutation)}\n`,
  });
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`CLI returned invalid JSON (${command}): ${result.stderr.slice(0, 500)}`);
  }
}

const processEnv = {
  PATH: process.env.PATH ?? "",
  GAJENDRA_DATA_DIR: dataDir,
  GAJENDRA_SOURCES_CONFIG: sourcesPath,
  GAJENDRA_CODEX_BIN: path.join(tempRoot, "disabled-codex"),
  GAJENDRA_METADATA_CACHE: "off",
};

function thread(id, title, updatedAt, extras = {}) {
  return { id, title, project: "synthetic", updatedAt, status: "idle", deepLink: `https://example.invalid/${id}`, ...extras };
}

function productThread(snapshot, id, lane) {
  return snapshot.product?.[lane]?.find((candidate) => candidate.id === id);
}

async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.equal(result.isError, undefined, `${name} returned a protocol error`);
  assert.ok(result.structuredContent, `${name} returned no structured content`);
  return result.structuredContent;
}

function assertRevision(result, revision, label) {
  assert.equal(result.revision, revision, `${label} revision`);
}

async function run() {
  await mkdir(dataDir, { mode: 0o700 });
  await chmod(tempRoot, 0o700);
  const agedAt = "2020-01-02T03:04:05Z";
  await writeFile(catalogPath, JSON.stringify({
    version: 1,
    threads: [
      thread("predecessor", "Synthetic predecessor", "2026-10-01T12:00:00Z"),
      thread("successor", "Synthetic successor", "2026-10-02T12:00:00Z"),
      thread("aged-review", "Synthetic old review", agedAt, {
        review: {
          state: "ready",
          kind: "pull-request",
          updatedAt: agedAt,
          destination: { type: "url", url: "https://example.invalid/review/aged-review" },
          providerStatus: "Synthetic completed",
        },
      }),
    ],
  }), { mode: 0o600 });
  await writeFile(sourcesPath, JSON.stringify({
    version: 1,
    sources: [{ id: "synthetic", name: "Synthetic", catalog: catalogPath, enabled: true, deepLinkSchemes: ["https"] }],
  }), { mode: 0o600 });
  await writeFile(storePath, JSON.stringify({
    version: 3,
    revision: 0,
    currentFocusThreadId: null,
    entries: [],
    collapsed: { focus: false, important: false },
    sourcePreferences: { codex: false, claude: false, cursor: false, grok: false, synthetic: true },
    idempotency: [],
    reviewAcknowledgements: [],
  }), { mode: 0o600 });

  transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath, "--stdio"],
    env: processEnv,
    stderr: "pipe",
  });
  client = new Client({ name: "gajendra-product-sync-verifier", version: "1.0.0" });
  await client.connect(transport);

  let snapshot = await call("gajendra_open", { refresh: true });
  assertRevision(snapshot, 0, "initial MCP snapshot");
  assert.ok(productThread(snapshot, ids.review, "readyForReview"), "an old explicit review signal should remain visible");

  const pluginWrite = await call("gajendra_set_level", {
    threadId: ids.predecessor, level: "focus", expectedRevision: snapshot.revision, idempotencyKey: "plugin-focus",
  });
  assert.equal(pluginWrite.outcome, "applied");
  assertRevision(pluginWrite, 1, "plugin mutation");
  let nativeSnapshot = await cli("snapshot");
  assertRevision(nativeSnapshot, 1, "native snapshot after plugin mutation");
  assert.ok(nativeSnapshot.focus.some((candidate) => candidate.id === ids.predecessor), "native CLI must see plugin Focus state");

  const nativeWrite = await cli("mutate", {
    protocolVersion: 1,
    mutation: { type: "set-current", threadId: ids.predecessor },
    expectedRevision: 1,
    idempotencyKey: "native-now",
  });
  assert.equal(nativeWrite.outcome, "applied");
  assertRevision(nativeWrite, 2, "native mutation");
  assertRevision(await call("gajendra_sync"), 2, "MCP sync after native mutation");
  snapshot = await call("gajendra_open", { refresh: true });
  assertRevision(snapshot, 2, "MCP snapshot after native mutation");
  assert.equal(snapshot.current?.id, ids.predecessor, "MCP must see native NOW state");

  const winningWrite = await call("gajendra_set_context", {
    threadId: ids.predecessor, context: "engineering", expectedRevision: 2, idempotencyKey: "winning-context",
  });
  assert.equal(winningWrite.outcome, "applied");
  assertRevision(winningWrite, 3, "winning mutation");
  const staleWrite = await cli("mutate", {
    protocolVersion: 1,
    mutation: { type: "set-context", threadId: ids.predecessor, context: "life" },
    expectedRevision: 2,
    idempotencyKey: "stale-context",
  });
  assert.equal(staleWrite.outcome, "conflict", "a concurrent stale mutation must be rejected");
  assertRevision(staleWrite, 3, "stale conflict");
  nativeSnapshot = await cli("snapshot");
  assert.equal(nativeSnapshot.focus.find((candidate) => candidate.id === ids.predecessor)?.context, "engineering", "stale CLI state must not replace the winner");

  const finished = await call("gajendra_set_work_completed", {
    threadId: ids.predecessor, completed: true, expectedRevision: 3, idempotencyKey: "finish-work",
  });
  assert.equal(finished.outcome, "applied");
  assertRevision(finished, 4, "finish mutation");
  assert.equal(finished.snapshot.current, null, "finishing NOW should clear NOW");
  assert.ok(productThread(finished.snapshot, ids.predecessor, "history"), "finished work should move to History");

  const reopened = await cli("mutate", {
    protocolVersion: 1,
    mutation: { type: "set-work-completed", threadId: ids.predecessor, completed: false, currentThreadId: ids.predecessor },
    expectedRevision: 4,
    idempotencyKey: "reopen-work",
  });
  assert.equal(reopened.outcome, "applied");
  assertRevision(reopened, 5, "reopen mutation");
  assert.equal(reopened.snapshot.current?.id, ids.predecessor, "native reopen should restore the requested NOW item");
  assert.ok(productThread(reopened.snapshot, ids.predecessor, "continue"), "reopened work should return to Continue");

  const linked = await call("gajendra_link_continuation", {
    threadId: ids.predecessor, currentThreadId: ids.successor, expectedRevision: 5, idempotencyKey: "link-successor",
  });
  assert.equal(linked.outcome, "applied");
  assertRevision(linked, 6, "link continuation");
  nativeSnapshot = await cli("snapshot");
  assertRevision(nativeSnapshot, 6, "native snapshot after continuation link");
  assert.equal(nativeSnapshot.current?.id, ids.successor, "continuation should transfer NOW to the exact successor");
  assert.ok(productThread(nativeSnapshot, ids.predecessor, "history"), "predecessor should remain in History");
  assert.ok(productThread(nativeSnapshot, ids.successor, "continue"), "successor should become current Continue work");

  const unlinked = await cli("mutate", {
    protocolVersion: 1,
    mutation: { type: "link-continuation", threadId: ids.predecessor, currentThreadId: null },
    expectedRevision: 6,
    idempotencyKey: "unlink-successor",
  });
  assert.equal(unlinked.outcome, "applied");
  assertRevision(unlinked, 7, "unlink continuation");
  assert.equal(unlinked.snapshot.current?.id, ids.predecessor, "unlink should transfer NOW back to the exact predecessor");
  snapshot = await call("gajendra_open", { refresh: true });
  assertRevision(snapshot, 7, "MCP snapshot after unlink");
  assert.equal(snapshot.current?.id, ids.predecessor, "MCP must see the native unlink");
  assert.ok(productThread(snapshot, ids.review, "readyForReview"), "the aged review signal should still be available after workflow mutations");

  console.log("PASS: MCP and native CLI share one revisioned store; stale writes preserve the winner; lifecycle, continuation, unlink, and aged-review flows are visible cross-client.");
}

function runBounded(command, args, { env, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 250).unref();
      reject(new Error(`Timed out running ${path.basename(command)} ${args.at(-1)}`));
    }, 15_000);
    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) {
        child.kill("SIGKILL");
        reject(new Error("CLI output exceeded the verifier's 4 MiB bound."));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => {
      if (Buffer.concat(stderr).length < 8 * 1024) stderr.push(chunk);
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
      else reject(new Error(`CLI exited with ${signal ?? code}: ${Buffer.concat(stderr).toString("utf8").slice(0, 500)}`));
    });
    if (input === undefined) child.stdin.end();
    else child.stdin.end(input);
  });
}

let failed;
try {
  await run();
} catch (error) {
  failed = error;
} finally {
  if (client) await client.close().catch(() => {});
  else if (transport) await transport.close().catch(() => {});
  await rm(tempRoot, { recursive: true, force: true });
}

if (failed) {
  console.error(`FAIL: ${failed instanceof Error ? failed.message : String(failed)}`);
  process.exitCode = 1;
}
