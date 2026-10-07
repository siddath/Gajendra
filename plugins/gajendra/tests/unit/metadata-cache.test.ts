import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { cacheScope, CodexReviewCache, ThreadMetadataCache } from "../../src/server/metadata-cache.js";
import { enrichCodexReviewSignals } from "../../src/server/codex-app-server.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";
import type { SourceCollection } from "../../src/server/thread-sources.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function environment() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-cache-"));
  directories.push(directory);
  return { GAJENDRA_DATA_DIR: directory, CODEX_HOME: path.join(directory, "codex") };
}
const turn = { data: [{ status: "completed", completedAt: 100, itemsView: "notLoaded", items: [], error: null }] };

it("scopes relative configuration and provider paths by their resolved location", async () => {
  const env = { GAJENDRA_SOURCES_CONFIG: "relative/sources.json", CODEX_HOME: "relative/codex",
    GAJENDRA_CODEX_BIN: "./relative/bin/codex", GAJENDRA_CLAUDE_CONFIG_DIR: "relative/claude",
    GAJENDRA_CLAUDE_BIN: "relative/bin/claude", GAJENDRA_CURSOR_BIN: "relative/bin/cursor",
    GAJENDRA_GROK_CONFIG_DIR: "relative/grok", GAJENDRA_GROK_BIN: "relative/bin/grok" };
  const absolute = Object.fromEntries(Object.entries(env).map(([key, value]) => [key, path.resolve(value)]));
  expect(await cacheScope(env)).toBe(await cacheScope(absolute));
  for (const key of Object.keys(env)) {
    expect(await cacheScope({ ...absolute, [key]: path.resolve("different-working-directory", env[key as keyof typeof env]) }))
      .not.toBe(await cacheScope(env));
  }
  // A bare Codex command is PATH-resolved, unlike an explicit ./codex executable path.
  expect(await cacheScope({ GAJENDRA_CODEX_BIN: "codex" })).not.toBe(await cacheScope({ GAJENDRA_CODEX_BIN: "./codex" }));
  expect(await cacheScope({ GAJENDRA_CODEX_BIN: "codex", PATH: "/first-provider/bin" }))
    .not.toBe(await cacheScope({ GAJENDRA_CODEX_BIN: "codex", PATH: "/second-provider/bin" }));
  expect(await cacheScope({ GAJENDRA_CODEX_BIN: "/codex/bin", PATH: "/first-provider/bin" }))
    .toBe(await cacheScope({ GAJENDRA_CODEX_BIN: "/codex/bin", PATH: "/second-provider/bin" }));
});

it("isolates cwd-relative catalogs while absolute and home-relative catalogs share across callers", async () => {
  const env = { ...await environment(), GAJENDRA_SOURCES_CONFIG: "" };
  env.GAJENDRA_SOURCES_CONFIG = path.join(env.GAJENDRA_DATA_DIR, "sources.json");
  const cwd = process.cwd();
  const other = path.join(env.GAJENDRA_DATA_DIR, "different-caller");
  for (const catalog of ["catalog.json", path.join(env.GAJENDRA_DATA_DIR, "catalog.json"), "~/catalog.json"]) {
    await writeFile(env.GAJENDRA_SOURCES_CONFIG, JSON.stringify({ version: 1,
      sources: [{ id: "synthetic", name: "Synthetic", catalog, enabled: true }] }));
    const first = await cacheScope(env);
    const currentDirectory = vi.spyOn(process, "cwd").mockReturnValue(other);
    try {
      const second = await cacheScope(env);
      expect(second === first).toBe(catalog !== "catalog.json");
    } finally { currentDirectory.mockRestore(); }
    expect(process.cwd()).toBe(cwd);
  }
});

it("reuses unchanged completion metadata across processes and reads only changed threads", async () => {
  const env = await environment();
  const threads = ["a", "b"].map(id => ({ id, name: "PRIVATE TITLE", updatedAt: 100, status: "idle" }));
  const first = new CodexReviewCache(env);
  const entries = await first.load();
  let calls: string[] = [];
  const request = async ({ threadId }: { threadId: string }) => { calls.push(threadId); return turn; };
  await enrichCodexReviewSignals(threads, request, { cache: entries, now: () => 200_000 });
  expect(calls).toEqual(["a", "b"]);
  await first.save(entries);
  const persisted = await readFile(path.join(env.GAJENDRA_DATA_DIR, "metadata-cache/codex-reviews.v1.json"), "utf8");
  expect(persisted).not.toContain("PRIVATE TITLE");
  expect(persisted).not.toContain("items");
  const next = await new CodexReviewCache(env).load();
  calls = [];
  const unchanged = await enrichCodexReviewSignals(threads, request, { cache: next, now: () => 201_000 });
  expect(calls).toEqual([]);
  expect(unchanged.threads.every(thread => thread.gajendraReview?.updatedAt === 100)).toBe(true);
  await enrichCodexReviewSignals([{ ...threads[0]!, updatedAt: 101 }, threads[1]!], request, { cache: next, now: () => 202_000 });
  expect(calls).toEqual(["a"]);
  calls = [];
  await enrichCodexReviewSignals(threads, request, { cache: next, now: () => 600_000 });
  expect(calls).toHaveLength(2);
  const active = await enrichCodexReviewSignals([{ ...threads[0]!, status: "active" }], request, { cache: next, now: () => 601_000 });
  expect(active.threads[0]!.gajendraReview).toBeUndefined();
});

it("never retains a stale completion after a changed thread returns invalid metadata", async () => {
  const cache = new Map();
  const thread = { id: "a", updatedAt: 100, status: "idle" };
  await enrichCodexReviewSignals([thread], async () => turn, { cache, now: () => 200_000 });
  const result = await enrichCodexReviewSignals([{ ...thread, updatedAt: 101 }], async () => ({ data: [{ items: ["PRIVATE CONTENT"] }] }), { cache, now: () => 201_000 });
  expect(result.availability).toBe("transient");
  expect(result.threads[0]!.gajendraReview).toBeUndefined();
});

it("renders cached metadata with current priorities, without provider calls or persisted commands", async () => {
  const env = await environment();
  const cache = new ThreadMetadataCache(env, () => 200_000);
  const collection: SourceCollection = { threads: [{ id: "codex:a", sourceId: "codex", sourceName: "Codex", title: "Sample chat", project: "Fixture", updatedAt: 100, status: "active", deepLink: "codex://threads/a", allowedDeepLinkSchemes: ["codex"], resumeCommand: { executable: "PRIVATE COMMAND", args: [] }, review: { state: "ready", kind: "result", updatedAt: 100, providerStatus: "completed", destination: { type: "thread", deepLink: "codex://threads/a" } } }], sources: [{ id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: "PRIVATE DIAGNOSTIC" }], error: null };
  await cache.save({}, collection);
  const cachePath = path.join(env.GAJENDRA_DATA_DIR, "metadata-cache/threads.v1.json");
  const raw = await readFile(cachePath, "utf8");
  expect(raw).not.toMatch(/PRIVATE|resumeCommand|review|detail/u);
  expect((await stat(cachePath)).mode & 0o777).toBe(0o600);
  let calls = 0;
  const store = new GajendraStoreRepository(env.GAJENDRA_DATA_DIR);
  const service = new GajendraService(store, { collect: async () => { calls++; return collection; }, close: async () => {} }, { metadataCache: cache });
  await service.mutate({ type: "set-level", threadId: "codex:a", level: "important" });
  await service.mutate({ type: "set-level", threadId: "codex:a", level: null });
  calls = 0;
  const snapshot = await service.cachedSnapshot();
  expect(calls).toBe(0);
  expect(snapshot?.revision).toBe(2);
  expect(snapshot?.focus).toEqual([]);
  expect(snapshot?.available[0]?.status).toBe("cached");
  expect(snapshot?.available[0]?.review).toBeUndefined();
  expect(snapshot?.cachedAt).toBe("1970-01-01T00:03:20.000Z");
  expect(await cache.load({ codex: false })).toBeNull();
  expect(await new ThreadMetadataCache({ ...env, CODEX_HOME: "/different-account" }, () => 200_000).load({})).toBeNull();
  expect(await new ThreadMetadataCache(env, () => 200_000 + 86_400_001).load({})).toBeNull();
  expect(await new ThreadMetadataCache({ ...env, GAJENDRA_METADATA_CACHE: "off" }, () => 200_000).load({})).toBeNull();
  const unavailable = new GajendraService(store, {
    collect: async () => ({ threads: [], sources: [], error: "Source unavailable" }), close: async () => {},
  }, { metadataCache: cache });
  const fallback = await unavailable.snapshot();
  expect(fallback.cachedAt).toBe(snapshot?.cachedAt);
  expect(fallback.error).toBe("Source unavailable");
  expect(fallback.available.map(thread => thread.id)).toEqual(["codex:a"]);
  const partial = new GajendraService(store, {
    collect: async () => ({ threads: [], sources: [{ ...collection.sources[0]!, state: "error", threadCount: 0 }], error: null }),
    close: async () => {},
  }, { metadataCache: cache });
  const partialSnapshot = await partial.snapshot();
  expect(partialSnapshot.available[0]?.status).toBe("cached");
  expect(partialSnapshot.sources[0]?.state).toBe("error");
  expect(partialSnapshot.cachedAt).toBe(snapshot?.cachedAt);
  await writeFile(cachePath, "corrupt cache", { mode: 0o600 });
  expect(await service.cachedSnapshot()).toBeNull();
  expect((await store.read()).revision).toBe(2);
});

it("requests fresh completion evidence for review acknowledgement even when a cache exists", async () => {
  const env = await environment();
  const forceRequests: boolean[] = [];
  const service = new GajendraService(new GajendraStoreRepository(env.GAJENDRA_DATA_DIR), {
    collect: async (_preferences, force = false) => { forceRequests.push(force); return { threads: [], sources: [], error: null }; },
    close: async () => {},
  });
  await service.mutate({ type: "set-review-acknowledged", threadId: "codex:missing", reviewUpdatedAt: 100,
    reviewIdentity: "0".repeat(64), acknowledged: true });
  expect(forceRequests).toEqual([true]);
});
