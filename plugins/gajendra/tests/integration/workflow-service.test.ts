import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_WORKFLOW_RECORDS, EMPTY_STORE, type AgentThread, type DeckMutation } from "../../src/shared/contracts.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";
import { ThreadMetadataCache } from "../../src/server/metadata-cache.js";
import { runCompanionCommand } from "../../src/server/index.js";
import { hashReviewAcknowledgement } from "../../src/server/review-acknowledgements.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const thread = (id: string, overrides: Partial<AgentThread> = {}): AgentThread => ({
  id: `codex:${id}`, sourceId: "codex", sourceName: "Codex", title: `Synthetic ${id}`, project: "Synthetic",
  updatedAt: 1, status: "idle", deepLink: `codex://threads/${id}`, allowedDeepLinkSchemes: ["codex"], ...overrides,
});
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gajendra-workflow-")); dirs.push(dir);
  let fail = false; let scans = 0;
  const threads = [thread("old", { review: { state: "ready", kind: "result", updatedAt: 1,
    providerStatus: "completed", destination: { type: "thread", deepLink: "codex://threads/old" } } }),
    thread("next"), thread("third"), thread("running", { status: "active" }),
    thread("waiting", { status: "waiting" }), thread("input", { attention: "needs-input" })];
  const source = { collect: async () => { scans += 1; if (fail) throw new Error("provider offline"); return {
    threads, sources: [{ id: "codex", name: "Codex", kind: "builtin" as const, state: "ready" as const,
      enabled: true, threadCount: threads.length, detail: null }], error: null,
  }; }, close: async () => {} };
  const create = () => new GajendraService(new GajendraStoreRepository(dir), source);
  const service = create();
  const mutate = (mutation: DeckMutation) => service.mutate({ mutation });
  return { dir, threads, source, service, create, mutate, setFailure: (value: boolean) => { fail = value; }, scans: () => scans };
}

describe("explicit work lifecycle and exact chat continuity", () => {
  it("retains reviewed open priorities in History across restart without claiming Finish or cached review evidence", async () => {
    const f = await fixture();
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    await f.mutate({ type: "set-context", threadId: "codex:old", context: "engineering" });
    await f.mutate({ type: "set-level", threadId: "codex:next", level: "focus" });
    const repository = new GajendraStoreRepository(f.dir);
    const before = await repository.read();
    const ready = f.threads[0]!;
    const mutation = { type: "set-review-acknowledged" as const, threadId: ready.id,
      reviewUpdatedAt: ready.review!.updatedAt, reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review!), acknowledged: true };
    const applied = await f.service.mutate({ expectedRevision: before.revision, idempotencyKey: "review-once", mutation });
    expect(applied.outcome).toBe("applied");
    const restarted = f.create();
    const snapshot = await restarted.snapshot();
    expect(snapshot.current).toMatchObject({ id: ready.id, isCurrent: true, reviewAcknowledged: true, workState: "open", context: "engineering" });
    expect(snapshot.product?.history.map(t => t.id)).toContain(ready.id);
    expect(snapshot.product?.continue.map(t => t.id)).toEqual([ready.id, "codex:next"]);
    expect(snapshot.product?.readyForReview).toEqual([]);
    const after = await repository.read();
    expect({ ...after, revision: before.revision, idempotency: before.idempotency, reviewAcknowledgements: before.reviewAcknowledgements }).toEqual(before);
    expect(after.reviewAcknowledgements).toEqual([{ threadHash: expect.stringMatching(/^[a-f0-9]{64}$/u), signalHash: mutation.reviewIdentity }]);

    const cachedService = new GajendraService(repository, f.source, { metadataCache: new ThreadMetadataCache({ GAJENDRA_DATA_DIR: f.dir }) });
    await cachedService.snapshot();
    expect((await cachedService.cachedSnapshot())?.current?.reviewAcknowledged).toBeUndefined();
    const restored = await restarted.mutate({ expectedRevision: after.revision, mutation: { ...mutation, acknowledged: false } });
    expect(restored.snapshot.current?.reviewAcknowledged).toBeUndefined();
    expect(restored.snapshot.product?.history.map(t => t.id)).not.toContain(ready.id);
    expect(restored.snapshot.product?.readyForReview.map(t => t.id)).toEqual([ready.id]);
  });

  it("replays an ambiguous post-write acknowledgement without hiding newer evidence or losing concurrent priorities", async () => {
    const f = await fixture();
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    const before = await f.service.snapshot();
    const ready = f.threads[0]!;
    const request = { expectedRevision: before.revision, idempotencyKey: "review-ambiguous", mutation: {
      type: "set-review-acknowledged" as const, threadId: ready.id, reviewUpdatedAt: ready.review!.updatedAt,
      reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review!), acknowledged: true,
    } };
    const failing = new GajendraService(new GajendraStoreRepository(f.dir, [], {
      onPrimaryWritten: () => { throw new Error("synthetic lost response after commit"); },
    }), f.source);
    await expect(failing.mutate(request)).rejects.toThrow("synthetic lost response after commit");
    const committed = await new GajendraStoreRepository(f.dir).read();
    expect(committed.revision).toBe(before.revision + 1);
    expect(committed.reviewAcknowledgements[0]?.signalHash).toBe(request.mutation.reviewIdentity);
    expect((await f.create().snapshot()).current?.reviewAcknowledged).toBe(true);

    ready.review = { ...ready.review!, updatedAt: ready.review!.updatedAt + 1 };
    await f.mutate({ type: "set-level", threadId: "codex:next", level: "important" });
    const replay = await f.create().mutate(request);
    expect(replay.outcome).toBe("replayed");
    expect(replay.snapshot.current?.id).toBe(ready.id);
    expect(replay.snapshot.current?.reviewAcknowledged).toBeUndefined();
    expect(replay.snapshot.product?.readyForReview.map(t => t.id)).toEqual([ready.id]);
    expect(replay.snapshot.important.map(t => t.id)).toEqual(["codex:next"]);
    const afterReplay = await new GajendraStoreRepository(f.dir).read();
    expect(afterReplay.reviewAcknowledgements).toEqual(committed.reviewAcknowledgements);
    expect(afterReplay.revision).toBe(committed.revision + 1);
    const stale = await f.create().mutate({ ...request, idempotencyKey: "review-stale" });
    expect(stale.outcome).toBe("conflict");
    const obsolete = await f.create().mutate({ ...request, expectedRevision: afterReplay.revision, idempotencyKey: "review-obsolete" });
    expect(obsolete).toMatchObject({ outcome: "rejected", error: { code: "invalid-target" } });
    expect(await new GajendraStoreRepository(f.dir).read()).toEqual(afterReplay);
  });

  it("finishes NOW durably without promoting another; retains review/history and reopens atomically", async () => {
    const f = await fixture();
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    await f.mutate({ type: "set-level", threadId: "codex:next", level: "focus" });
    const before = await f.service.snapshot();
    const request = { expectedRevision: before.revision, idempotencyKey: "finish", mutation: {
      type: "set-work-completed" as const, threadId: "codex:old", completed: true,
    } };
    const finished = await f.service.mutate(request);
    expect(finished.outcome).toBe("applied"); expect(finished.snapshot.current).toBeNull();
    expect(finished.snapshot.product?.continue.map(t => t.id)).toEqual(["codex:next"]);
    expect(finished.snapshot.product?.readyForReview.map(t => t.id)).toEqual(["codex:old"]);
    expect(finished.snapshot.product?.history.find(t => t.id === "codex:old")?.workState).toBe("completed");
    const restarted = f.create(); const durable = await restarted.snapshot();
    expect(durable.current).toBeNull(); expect(durable.product?.continue.map(t => t.id)).toEqual(["codex:next"]);
    expect((await restarted.mutate({ expectedRevision: before.revision,
      mutation: { type: "set-work-completed", threadId: "codex:old", completed: false } })).outcome).toBe("conflict");
    expect((await restarted.mutate(request)).outcome).toBe("replayed");
    const reopened = await restarted.mutate({ expectedRevision: durable.revision,
      mutation: { type: "set-work-completed", threadId: "codex:old", completed: false, currentThreadId: "codex:old" } });
    expect(reopened.snapshot.current?.id).toBe("codex:old");
    expect(reopened.snapshot.product?.continue.map(t => t.id)).toEqual(["codex:old", "codex:next"]);
    const persisted = await readFile(path.join(f.dir, "gajendra.v2.json"), "utf8");
    expect(persisted).not.toContain("Synthetic"); expect(persisted).not.toContain("codex://");
  });

  it("transfers priority/context/NOW along exact IDs with restart, undo and cycle/namespace rejection", async () => {
    const f = await fixture();
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    await f.mutate({ type: "set-context", threadId: "codex:old", context: "engineering" });
    const linked = await f.mutate({ type: "link-continuation", threadId: "codex:old", currentThreadId: "codex:next" });
    expect(linked.snapshot.current).toMatchObject({ id: "codex:next", context: "engineering", predecessorThreadIds: ["codex:old"] });
    expect(linked.snapshot.product?.history.find(t => t.id === "codex:old")).toMatchObject({ currentThreadId: "codex:next", continuationThreadId: "codex:next" });
    expect(linked.snapshot.product?.readyForReview.map(t => t.id)).toEqual(["codex:old"]);
    await f.mutate({ type: "link-continuation", threadId: "codex:next", currentThreadId: "codex:third" });
    expect((await f.create().snapshot()).current).toMatchObject({ id: "codex:third", predecessorThreadIds: ["codex:old", "codex:next"] });
    const before = await f.service.sync();
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:third", currentThreadId: "codex:old" })).error?.code).toBe("invalid-continuation");
    expect(await f.service.sync()).toEqual(before);
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:old", currentThreadId: null })).outcome).toBe("rejected");
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:next", currentThreadId: null })).snapshot.current?.id).toBe("codex:next");
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:old", currentThreadId: null })).snapshot.current?.id).toBe("codex:old");
    f.threads.push(thread("bad", { id: "claude:wrong-namespace" }));
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:old", currentThreadId: "claude:wrong-namespace" })).error?.code).toBe("invalid-continuation");
  });

  it("keeps evidence independent of age/finish; waiting is not input; provider failure never resets workflow", async () => {
    const f = await fixture(); const snapshot = await f.service.snapshot();
    expect(snapshot.product?.readyForReview.map(t => t.id)).toEqual(["codex:old"]);
    expect(snapshot.product?.needsInput.map(t => t.id)).toEqual(["codex:input"]);
    expect(snapshot.product?.running.map(t => t.id)).toEqual(["codex:running"]);
    expect(snapshot.product?.history.map(t => t.id)).toContain("codex:waiting");
    await f.mutate({ type: "set-work-completed", threadId: "codex:old", completed: true });
    f.setFailure(true);
    const failed = await f.service.snapshot(); expect(failed.product?.readyForReview).toEqual([]); expect(failed.error).toBeTruthy();
    expect((await f.mutate({ type: "set-work-completed", threadId: "codex:old", completed: false })).error?.code).toBe("unknown-thread");
    f.setFailure(false); const restored = await f.create().snapshot();
    expect(restored.product?.history.find(t => t.id === "codex:old")?.workState).toBe("completed");
    expect(restored.product?.readyForReview.map(t => t.id)).toEqual(["codex:old"]);
  });

  it("syncs without provider discovery and projects current workflow into neutral cached metadata", async () => {
    const f = await fixture(); const cache = new ThreadMetadataCache({ GAJENDRA_DATA_DIR: f.dir });
    const service = new GajendraService(new GajendraStoreRepository(f.dir), f.source, { metadataCache: cache });
    await service.snapshot(); const scans = f.scans();
    expect(await runCompanionCommand("sync", "", service)).toEqual({ revision: 0 }); expect(f.scans()).toBe(scans);
    await f.mutate({ type: "set-work-completed", threadId: "codex:old", completed: true });
    const cached = await service.cachedSnapshot();
    expect(cached?.product?.running).toEqual([]); expect(cached?.product?.readyForReview).toEqual([]); expect(cached?.product?.needsInput).toEqual([]);
    expect(cached?.product?.history.find(t => t.id === "codex:old")?.workState).toBe("completed");
  });

  it("rejects capacity overflow and conflicting targets without losing prior records", async () => {
    const f = await fixture();
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    await f.mutate({ type: "set-level", threadId: "codex:next", level: "important" });
    expect((await f.mutate({ type: "link-continuation", threadId: "codex:old", currentThreadId: "codex:next" })).error?.code).toBe("invalid-continuation");
    const store = new GajendraStoreRepository(f.dir);
    const state = await store.read();
    await store.write({ ...state, completedThreadIds: Array.from({ length: MAX_WORKFLOW_RECORDS }, (_, i) => `codex:done-${i}`) });
    const before = await store.read();
    expect((await f.mutate({ type: "set-work-completed", threadId: "codex:old", completed: true })).error?.code).toBe("workflow-limit");
    expect(await store.read()).toEqual(before);
    expect((await f.service.snapshot()).current?.id).toBe("codex:old");
  });

  it("reads old v3 state and recovers malformed continuity from the valid private backup", async () => {
    const f = await fixture(); const storePath = path.join(f.dir, "gajendra.v2.json");
    await writeFile(storePath, JSON.stringify(EMPTY_STORE), { mode: 0o600 }); expect((await f.create().snapshot()).revision).toBe(0);
    await f.mutate({ type: "set-current", threadId: "codex:old" });
    const valid = JSON.parse(await readFile(storePath, "utf8"));
    await writeFile(storePath, JSON.stringify({ ...valid, continuations: [
      { predecessorThreadId: "codex:old", currentThreadId: "codex:next" }, { predecessorThreadId: "codex:next", currentThreadId: "codex:old" },
    ] }), { mode: 0o600 });
    const recovered = await f.create().snapshot(); expect(recovered.current?.id).toBe("codex:old"); expect(recovered.current?.continuationThreadId).toBeNull();
  });
});
