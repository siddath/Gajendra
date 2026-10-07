import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { GajendraService } from "../plugins/gajendra/src/server/service.js";
import { GajendraStoreRepository } from "../plugins/gajendra/src/server/store.js";
import { ThreadMetadataCache } from "../plugins/gajendra/src/server/metadata-cache.js";
import { hashReviewAcknowledgement } from "../plugins/gajendra/src/server/review-acknowledgements.js";
import type { SourceCollection } from "../plugins/gajendra/src/server/thread-sources.js";
import type { DeckMutation } from "../plugins/gajendra/src/shared/contracts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, ".artifacts/evals/report.json");
const dataset = JSON.parse(await readFile(path.join(root, "evals/scenarios.json"), "utf8")) as {
  version: number; cases: { id: string; intent: string; acceptance: string }[];
};
const results: { id: string; status: string; durationMs: number; evidence?: unknown; error?: string }[] = [];
const round = (n: number) => Math.round(n * 100) / 100;
const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]!;
const runFile = promisify(execFile);
const temp = await mkdtemp(path.join(os.tmpdir(), "gajendra-evals-"));
const priorConfig = process.env.GAJENDRA_SOURCES_CONFIG;
process.env.GAJENDRA_SOURCES_CONFIG = path.join(temp, "sources.json");
await writeFile(process.env.GAJENDRA_SOURCES_CONFIG, '{"version":1,"sources":[]}', { mode: 0o600 });

async function fixture(name: string) {
  const dir = path.join(temp, name);
  const store = new GajendraStoreRepository(dir, []);
  const env = { GAJENDRA_DATA_DIR: dir, GAJENDRA_SOURCES_CONFIG: process.env.GAJENDRA_SOURCES_CONFIG,
    CODEX_HOME: path.join(temp, "synthetic-account") };
  const cache = new ThreadMetadataCache(env);
  const threads: SourceCollection["threads"] = ["one", "next"].map(id => ({
    id: `codex:${id}`, sourceId: "codex", sourceName: "Codex", title: `Synthetic eval ${id}`,
    project: "Synthetic", status: "idle", updatedAt: 100, deepLink: `codex://threads/${id}`,
    allowedDeepLinkSchemes: ["codex"],
  }));
  threads[0]!.review = { state: "ready", kind: "result", updatedAt: 100,
    providerStatus: "completed", destination: { type: "thread", deepLink: "codex://threads/one" } };
  const collection: SourceCollection = { threads, sources: [{ id: "codex", name: "Codex", kind: "builtin",
    enabled: true, state: "ready", threadCount: 2, detail: null }], error: null };
  let scans = 0;
  const source = { collect: async () => { scans++; return structuredClone(collection); }, close: async () => {} };
  // Freeze only the catalog's age clock: noisy CI scheduling must not expire this warm scenario.
  const service = new GajendraService(store, source, { sharedCatalog: true, metadataCache: cache, now: () => 1_000 });
  const mutate = async (mutation: DeckMutation) => {
    const result = await service.mutate({ mutation, expectedRevision: (await store.read()).revision });
    assert.equal(result.outcome, "applied", `${mutation.type}: ${result.error?.code ?? result.outcome}`); return result.snapshot;
  };
  return { dir, env, store, cache, service, collection, mutate, scans: () => scans };
}

const cases: Record<string, () => Promise<unknown>> = {
  "prepared-work": async () => {
    const f = await fixture("prepared-work");
    try {
      await f.service.snapshot();
      const reads: number[] = [], writes: number[] = [];
      for (let i = 0; i < 7; i++) {
        let at = performance.now();
        const view = await f.service.readSnapshot(); reads.push(performance.now() - at);
        assert.equal(view.revision, i);
        at = performance.now();
        await f.mutate({ type: "set-collapsed", level: "focus", collapsed: i % 2 === 0 });
        writes.push(performance.now() - at);
      }
      assert.equal(f.scans(), 1, "prepared reads and priority-only writes must not list providers again");
      assert.equal((await f.service.readSnapshot()).revision, 7);
      return { providerCollections: f.scans(), operations: { reads: 8, writes: 7 },
        serviceReadMs: { median: round(median(reads)), samples: reads.map(round) },
        serviceWriteMs: { median: round(median(writes)), samples: writes.map(round) } };
    } finally { await f.service.close(); }
  },
  "concurrent-intent": async () => {
    const f = await fixture("concurrent-intent");
    try {
      await f.service.snapshot();
      const request = { mutation: { type: "set-current" as const, threadId: "codex:one" }, expectedRevision: 0, idempotencyKey: "eval-now" };
      assert.equal((await f.service.mutate(request)).outcome, "applied");
      assert.equal((await f.service.mutate(request)).outcome, "replayed");
      assert.equal((await f.service.mutate({ ...request, idempotencyKey: "eval-stale", mutation: { type: "set-current", threadId: "codex:next" } })).outcome, "conflict");
      const view = await f.service.readSnapshot();
      assert.equal(view.current?.id, "codex:one"); assert.equal(view.revision, 1);
      assert.equal(view.focus.filter(t => t.isCurrent).length, 1);
      return { winner: "codex:one", revision: view.revision, replay: "preserved", staleWrite: "rejected" };
    } finally { await f.service.close(); }
  },
  "response-review": async () => {
    const f = await fixture("response-review");
    try {
      const first = await f.service.snapshot(); assert.equal(first.product?.readyForReview.length, 1);
      assert.equal((await f.service.readSnapshot()).product?.readyForReview.length, 1, "opening is not acknowledgement");
      const review = f.collection.threads[0]!.review!;
      const mutation = { type: "set-review-acknowledged" as const, threadId: "codex:one", acknowledged: true,
        reviewUpdatedAt: review.updatedAt, reviewIdentity: hashReviewAcknowledgement("codex:one", review) };
      assert.equal((await f.mutate(mutation)).product?.readyForReview.length, 0);
      assert.equal(f.scans(), 2, "review must obtain fresh evidence");
      assert.equal((await f.mutate({ ...mutation, acknowledged: false })).product?.readyForReview.length, 1);
      await f.mutate(mutation);
      f.collection.threads[0]!.review = { ...review, updatedAt: 101 };
      assert.equal((await f.service.snapshot()).product?.readyForReview.length, 1, "a later response must reappear");
      const stale = await f.service.mutate({ mutation }); assert.equal(stale.outcome, "rejected");
      return { openDoesNotAcknowledge: true, undoRestores: true, newResponseVisible: true, staleEvidence: "rejected" };
    } finally { await f.service.close(); }
  },
  "explicit-lifecycle": async () => {
    const f = await fixture("explicit-lifecycle");
    try {
      await f.service.snapshot(); await f.mutate({ type: "set-current", threadId: "codex:one" });
      await f.mutate({ type: "set-level", threadId: "codex:next", level: "focus" });
      const finished = await f.mutate({ type: "set-work-completed", threadId: "codex:one", completed: true });
      assert.equal(finished.current, null); assert.ok(finished.product?.history.some(t => t.id === "codex:one"));
      assert.equal(finished.product?.readyForReview.length, 0, "explicit Finish clears the review queue");
      assert.equal(finished.product?.history.find(t => t.id === "codex:one")?.review?.state, "ready", "Finish is not review acknowledgement");
      f.collection.threads[0]!.review!.updatedAt += 1;
      assert.equal((await f.service.snapshot()).product?.readyForReview.length, 0, "a closing reply cannot resurrect finished work");
      const reopened = await f.mutate({ type: "set-work-completed", threadId: "codex:one", completed: false });
      assert.equal(reopened.current, null, "reopening does not select NOW");
      assert.equal(reopened.product?.readyForReview.length, 1, "Reopen restores pending response review");
      await f.mutate({ type: "set-current", threadId: "codex:one" });
      const occupied = await f.service.mutate({ mutation: { type: "link-continuation", threadId: "codex:one", currentThreadId: "codex:next" } });
      assert.equal(occupied.outcome, "rejected", "continuation must not overwrite an already prioritized target");
      await f.mutate({ type: "set-level", threadId: "codex:next", level: null });
      const linked = await f.mutate({ type: "link-continuation", threadId: "codex:one", currentThreadId: "codex:next" });
      assert.equal(linked.current?.id, "codex:next"); assert.ok(linked.product?.history.some(t => t.id === "codex:one"));
      return { finishClearsNow: true, pendingReviewPreserved: true, continuation: "codex:next" };
    } finally { await f.service.close(); }
  },
  "hook-shared-scope": async () => {
    const home = path.join(temp, "hook-home");
    const shared = process.platform === "darwin" ? path.join(home, "Library/Application Support/Gajendra")
      : path.join(home, ".config/gajendra");
    const pluginData = path.join(temp, "hook-plugin-data");
    const store = new GajendraStoreRepository(shared, []);
    await store.read();
    const before = await store.read();
    const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: undefined, GAJENDRA_DATA_DIR: undefined,
      PLUGIN_DATA: pluginData, PLUGIN_ROOT: path.join(root, "plugins/gajendra"), GAJENDRA_NODE_BIN: process.execPath,
      GAJENDRA_METADATA_CACHE: undefined };
    const hook = path.join(root, "plugins/gajendra/hooks/lifecycle-event.sh");
    await new Promise<void>((resolve, reject) => {
      const child = execFile("/bin/sh", [hook], { env, timeout: 5_000 }, (error, stdout, stderr) => {
        if (error) return reject(error);
        try { assert.equal(stdout, "{}\n"); assert.equal(stderr, ""); resolve(); } catch (failure) { reject(failure); }
      });
      child.stdin!.end(JSON.stringify({ session_id: "synthetic", hook_event_name: "Stop", prompt: "PRIVATE_NOT_AN_INSTRUCTION" }));
    });
    const marker = JSON.parse(await readFile(path.join(shared, "metadata-cache/lifecycle.v1.json"), "utf8"));
    assert.deepEqual(Object.keys(marker).sort(), ["activityRevision", "version"]);
    const service = new GajendraService(store, { collect: async () => { throw new Error("hook must not scan"); }, close: async () => {} });
    try {
      assert.equal((await service.sync()).activityRevision, marker.activityRevision);
      assert.deepEqual(await store.read(), before, "hooks never finish work or change priority state");
      assert.equal(await stat(pluginData).catch(() => null), null);
      return { sharedEpochVisible: true, priorityStateUnchanged: true, hostPluginDataIgnored: true };
    } finally { await service.close(); }
  },
  "private-restart": async () => {
    const f = await fixture("private-restart");
    try {
      f.collection.threads[0]!.resumeCommand = { executable: "synthetic-command-never-executed", args: ["private-command-marker"] };
      await f.service.snapshot(); await f.mutate({ type: "set-current", threadId: "codex:one" });
      const saved = await f.cache.load((await f.store.read()).sourcePreferences);
      assert.ok(saved); assert.equal(saved.collection.threads[0]?.status, "cached");
      assert.ok(saved.collection.threads.every(t => !t.review && !t.resumeCommand));
      assert.equal(await new ThreadMetadataCache({ ...f.env, CODEX_HOME: path.join(temp, "other-account") }).load((await f.store.read()).sourcePreferences), null);
      const durable = await readFile(f.store.filePath, "utf8"); assert.ok(!durable.includes("Synthetic eval"));
      const cachedBytes = await readFile(path.join(f.dir, "metadata-cache/threads.v1.json"), "utf8");
      assert.ok(!/resumeCommand|synthetic-command-never-executed|private-command-marker/.test(cachedBytes));
      assert.equal((await stat(path.join(f.dir, "metadata-cache/threads.v1.json"))).mode & 0o777, 0o600);
      return { cacheActivity: "neutral", accountIsolation: true, durableTitles: false, cacheMode: "0600" };
    } finally { await f.service.close(); }
  },
  "cross-client": async () => {
    await runFile(process.execPath, [path.join(root, "scripts/verify-product-sync.mjs")], { cwd: root, timeout: 90_000, maxBuffer: 1024 * 1024 });
    return { clients: ["MCP stdio", "native CLI"], sharedRevisionAndLifecycle: true };
  },
};

try {
  assert.equal(dataset.version, 1);
  assert.deepEqual(dataset.cases.map(c => c.id).sort(), Object.keys(cases).sort(), "every declared eval needs exactly one implementation");
  for (const test of dataset.cases) {
    const at = performance.now();
    try { results.push({ id: test.id, status: "passed", durationMs: 0, evidence: await cases[test.id]!() }); }
    catch (error) { results.push({ id: test.id, status: "failed", durationMs: round(performance.now() - at), error: error instanceof Error ? error.message : String(error) }); }
    // Record elapsed time after the scenario has settled.
    results.at(-1)!.durationMs = round(performance.now() - at);
    console.log(`${results.at(-1)!.status.toUpperCase()}: ${test.id}`);
  }
} finally {
  if (priorConfig === undefined) delete process.env.GAJENDRA_SOURCES_CONFIG; else process.env.GAJENDRA_SOURCES_CONFIG = priorConfig;
  await rm(temp, { recursive: true, force: true });
  await mkdir(path.dirname(output), { recursive: true });
  const revision = (await runFile("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
  const dirty = (await runFile("git", ["status", "--porcelain"], { cwd: root })).stdout.trim().length > 0;
  const digest = createHash("sha256").update(await readFile(path.join(root, "plugins/gajendra/dist/server.mjs"))).digest("hex");
  const suiteDigest = createHash("sha256").update(await readFile(fileURLToPath(import.meta.url))).update(JSON.stringify(dataset)).digest("hex");
  const passed = results.length === dataset.cases.length && results.length > 0 && results.every(r => r.status === "passed");
  await writeFile(output, JSON.stringify({ suite: "gajendra-product-evals-v1", status: passed ? "passed" : "failed", revision, dirty,
    serverSha256: digest, suiteSha256: suiteDigest, timestamp: new Date().toISOString(), runtime: process.version, platform: `${process.platform}-${process.arch}`,
    scope: "Synthetic service scenarios plus compiled MCP/CLI journey. Service timings exclude process startup, providers and UI rendering; no LLM routing is evaluated.",
    criteria: dataset.cases, results }, null, 2) + "\n");
  if (!passed) process.exitCode = 1;
}
