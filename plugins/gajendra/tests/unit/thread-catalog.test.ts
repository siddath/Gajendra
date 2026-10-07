import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { ThreadCatalog } from "../../src/server/thread-catalog.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";
import { ThreadMetadataCache } from "../../src/server/metadata-cache.js";
import { hashReviewAcknowledgement } from "../../src/server/review-acknowledgements.js";
import type { SourceCollection } from "../../src/server/thread-sources.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function directory() { const dir = await mkdtemp(path.join(os.tmpdir(), "gajendra-catalog-")); dirs.push(dir); return dir; }
const collection: SourceCollection = { threads: [{ id: "codex:one", sourceId: "codex", sourceName: "Codex",
  title: "Synthetic", project: "Synthetic", updatedAt: 10, status: "idle", deepLink: "codex://threads/one",
  allowedDeepLinkSchemes: ["codex"], review: { state: "ready", kind: "result", updatedAt: 10, providerStatus: "completed",
    destination: { type: "thread", deepLink: "codex://threads/one" } } }],
  sources: [{ id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: 1, detail: null }], error: null };

it("coalesces concurrent refreshes and serves warm reads without provider work", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let calls = 0;
  const catalog = new ThreadCatalog(async () => { calls++; await gate; return collection; }, async () => undefined, "/missing");
  const first = catalog.get({}, true); const second = catalog.get({}, true);
  await new Promise(resolve => setTimeout(resolve, 10)); release();
  await Promise.all([first, second]);
  expect(calls).toBe(1);
  expect(await catalog.get({}, false)).toEqual(collection); expect(calls).toBe(1);
  expect(catalog.revision).toBe(1);
});

it("invalidates on activity, preferences, config replacement and expiry", async () => {
  const config = path.join(await directory(), "sources.json"); await writeFile(config, "{}");
  let epoch = "one", now = 100;
  const catalog = new ThreadCatalog(async () => collection, async () => epoch, config, () => now, 30);
  await catalog.get({}, true); expect(await catalog.peek({})).toBeDefined();
  expect(await catalog.peek({ codex: false })).toBeUndefined();
  epoch = "two"; expect(await catalog.peek({})).toBeUndefined();
  await catalog.get({}, true); await writeFile(config, '{"sources":[]}');
  expect(await catalog.peek({})).toBeUndefined();
  await catalog.get({}, true); now = 131; expect(await catalog.peek({})).toBeUndefined();
});

it("never publishes collection invalidated while its provider read was pending", async () => {
  let epoch = "before"; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const catalog = new ThreadCatalog(async () => { await gate; return collection; }, async () => epoch, "/missing");
  const pending = catalog.get({}, true); await new Promise(resolve => setTimeout(resolve, 10));
  epoch = "after"; release(); await pending;
  expect(await catalog.peek({})).toBeUndefined(); expect(catalog.revision).toBe(0);
});

it("does not reuse in-flight pre-click evidence for review acknowledgement", async () => {
  const force: boolean[] = []; let release!: () => void;
  let started!: () => void; const entered = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const catalog = new ThreadCatalog(async (_preferences, review) => { force.push(review); started(); await gate; return collection; }, async () => undefined, "/missing");
  const read = catalog.get({}, true); await entered;
  const review = catalog.get({}, true, true);
  await new Promise(resolve => setTimeout(resolve, 10)); release(); await Promise.all([read, review]);
  expect(force).toEqual([false, true]);
});

it("commits local changes without rediscovery and rebases warm reads on external revisions", async () => {
  const dir = await directory(); const store = new GajendraStoreRepository(dir); let calls = 0;
  const service = new GajendraService(store, { collect: async () => { calls++; return collection; }, close: async () => {} }, { sharedCatalog: true });
  await service.snapshot();
  const request = { expectedRevision: 0, idempotencyKey: "one", mutation: { type: "set-current" as const, threadId: "codex:one" } };
  expect((await service.mutate(request)).outcome).toBe("applied");
  expect((await service.mutate(request)).outcome).toBe("replayed");
  expect((await service.mutate({ ...request, idempotencyKey: "stale" })).outcome).toBe("conflict");
  await store.transaction(state => ({ value: null, next: { ...state, revision: state.revision + 1, collapsed: { focus: true, important: false } } }));
  const read = await service.readSnapshot(); expect(read.revision).toBe(2); expect(read.collapsed.focus).toBe(true);
  expect(read.current?.id).toBe("codex:one"); expect(calls).toBe(1);
  await service.mutate({ mutation: { type: "set-review-acknowledged", threadId: "codex:one", acknowledged: true,
    reviewUpdatedAt: 10, reviewIdentity: hashReviewAcknowledgement("codex:one", collection.threads[0]!.review!) } });
  expect(calls).toBe(2);
});

it("can change a known local priority offline after restart without persisting live evidence", async () => {
  const dir = await directory(); const cache = new ThreadMetadataCache({ GAJENDRA_DATA_DIR: dir });
  await cache.save((await new GajendraStoreRepository(dir).read()).sourcePreferences, collection);
  let calls = 0;
  const service = new GajendraService(new GajendraStoreRepository(dir), { collect: async () => { calls++; throw new Error("offline"); }, close: async () => {} }, { metadataCache: cache, sharedCatalog: true });
  const result = await service.mutate({ type: "set-level", threadId: "codex:one", level: "important" });
  expect(result.outcome).toBe("applied"); expect(result.snapshot.important[0]?.status).toBe("cached");
  expect(result.snapshot.cachedAt).toBeDefined(); expect(result.snapshot.product?.readyForReview).toEqual([]); expect(calls).toBe(0);
});

it("returns the restart cache while refresh is pending and preserves a write committed during refresh", async () => {
  const dir = await directory(); const store = new GajendraStoreRepository(dir);
  const cache = new ThreadMetadataCache({ GAJENDRA_DATA_DIR: dir });
  await cache.save((await store.read()).sourcePreferences, collection);
  let release!: () => void, calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const service = new GajendraService(store, { collect: async () => { calls++; await gate; return collection; }, close: async () => {} }, { metadataCache: cache, sharedCatalog: true });
  const initial = await service.readSnapshot();
  expect(initial.cachedAt).toBeDefined();
  const changed = await service.mutate({ type: "set-current", threadId: "codex:one" });
  expect(changed.outcome).toBe("applied");
  release();
  for (let i = 0; i < 100 && !(await service.sync()).catalogRevision; i++) await new Promise(resolve => setTimeout(resolve, 1));
  const ready = await service.readSnapshot();
  expect(ready.cachedAt).toBeUndefined(); expect(ready.current?.id).toBe("codex:one");
  expect(ready.revision).toBe(changed.revision); expect(calls).toBe(1);
  await service.close();
});

it("rejects disk catalog from a replaced source configuration and a racing old save", async () => {
  const dir = await directory(); const config = path.join(dir, "sources.json");
  await writeFile(config, "{}");
  const cache = new ThreadMetadataCache({ GAJENDRA_DATA_DIR: dir, GAJENDRA_SOURCES_CONFIG: config });
  const before = await cache.configuration(); await cache.save({}, collection, before);
  expect(await cache.load({})).not.toBeNull();
  await writeFile(config, '{"sources":[]}');
  expect(await cache.load({})).toBeNull();
  await cache.save({}, collection, before);
  expect(await cache.load({})).toBeNull();
});

it("retains live review metadata but never retains executable resume commands in the read cache", async () => {
  const live = { ...collection, threads: [{ ...collection.threads[0]!, resumeCommand: { executable: "/safe/cli", args: ["resume", "one"] } }] };
  const catalog = new ThreadCatalog(async () => live, async () => undefined, "/missing");
  const fresh = await catalog.get({}, true);
  expect(fresh.threads[0]?.resumeCommand).toBeDefined();
  const cached = await catalog.get({}, false);
  expect(cached.threads[0]?.resumeCommand).toBeUndefined();
  expect(cached.threads[0]?.review).toEqual(live.threads[0]?.review);
});
