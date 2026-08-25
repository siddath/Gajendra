import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import type { AgentThread, DeckMutationRequest, SourceState, ThreadSourceStatus } from "../../src/shared/contracts.js";
import { GajendraService } from "../../src/server/service.js";
import { GajendraStoreRepository } from "../../src/server/store.js";
import { hashReviewAcknowledgement } from "../../src/server/review-acknowledgements.js";

const temporaryDirectories: string[] = [];
const viteNode = createRequire(import.meta.url).resolve("vite-node/vite-node.mjs");
const processWorker = fileURLToPath(new URL("../fixtures/mutation-process-worker.ts", import.meta.url));
const faultWorker = fileURLToPath(new URL("../fixtures/move-before-fault-worker.ts", import.meta.url));
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const runFile = promisify(execFile);

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("Gajendra mutation service", () => {
  it("serializes independent service instances without silently losing priority changes", async () => {
    const directory = await temporaryDirectory();
    const services = Array.from({ length: 12 }, () => createService(directory));
    const results = await Promise.all(services.map((service, index) => service.mutate({
      protocolVersion: 1,
      idempotencyKey: `parallel-${index}`,
      mutation: { type: "set-level", threadId: `codex:thread-${index}`, level: "focus" },
    })));

    expect(results.every((result) => result.outcome === "applied")).toBe(true);
    const snapshot = await services[0]!.snapshot();
    expect(snapshot.revision).toBe(12);
    expect(snapshot.focus.map((thread) => thread.id).sort()).toEqual(
      Array.from({ length: 12 }, (_, index) => `codex:thread-${index}`).sort(),
    );
  });

  it("serializes 40 independent Node processes through the private data-directory lock", async () => {
    const directory = await temporaryDirectory();
    const results = await Promise.all(Array.from({ length: 40 }, async (_, index) => {
      const { stdout } = await runFile(process.execPath, [viteNode, processWorker], {
        cwd: packageRoot,
        env: {
          ...process.env,
          GAJENDRA_DATA_DIR: directory,
          GAJENDRA_PROCESS_INDEX: String(index),
        },
        timeout: 30_000,
        maxBuffer: 16 * 1024,
      });
      return JSON.parse(stdout.trim().split(/\r?\n/u).at(-1) ?? "{}") as { outcome?: string };
    }));

    expect(results).toEqual(Array.from({ length: 40 }, () => expect.objectContaining({ outcome: "applied" })));
    const state = await new GajendraStoreRepository(directory).read();
    expect(state.revision).toBe(40);
    expect(state.idempotency).toHaveLength(40);
    expect(state.entries.map((entry) => entry.threadId).sort()).toEqual(
      Array.from({ length: 40 }, (_, index) => `codex:thread-${index}`).sort(),
    );
  }, 60_000);

  it("returns typed conflict, replay, and key-reuse rejection without overwriting state", async () => {
    const directory = await temporaryDirectory();
    const service = createService(directory);
    const callerSuppliedKey = "untrusted MCP free text must not persist";
    const request: DeckMutationRequest = {
      protocolVersion: 1,
      expectedRevision: 0,
      idempotencyKey: callerSuppliedKey,
      mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" },
    };

    const applied = await service.mutate(request);
    expect(applied).toMatchObject({ outcome: "applied", revision: 1 });
    const replayed = await service.mutate(request);
    expect(replayed).toMatchObject({ outcome: "replayed", revision: 1 });

    const stale = await service.mutate({
      protocolVersion: 1,
      expectedRevision: 0,
      mutation: { type: "set-current", threadId: "codex:thread-1" },
    });
    expect(stale).toMatchObject({ outcome: "conflict", revision: 1, error: { code: "stale-revision" } });

    const reused = await service.mutate({
      protocolVersion: 1,
      idempotencyKey: callerSuppliedKey,
      mutation: { type: "set-level", threadId: "codex:thread-1", level: "important" },
    });
    expect(reused).toMatchObject({ outcome: "rejected", revision: 1, error: { code: "idempotency-key-reused" } });
    expect((await service.snapshot()).focus.map((thread) => thread.id)).toEqual(["codex:thread-0"]);
    const persisted = await readFile(path.join(directory, "gajendra.v2.json"), "utf8");
    expect(persisted).not.toContain(callerSuppliedKey);
    expect(persisted).toMatch(/"keyHash": "[a-f0-9]{64}"/u);
  });

  it("rejects unknown thread/source/target IDs and commits an atomic cross-lane move-before", async () => {
    const directory = await temporaryDirectory();
    const service = createService(directory);
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } });
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-1", level: "focus" } });
    await service.mutate({ mutation: { type: "set-level", threadId: "claude:thread-a", level: "important" } });

    const moved = await service.mutate({
      protocolVersion: 1,
      expectedRevision: 3,
      idempotencyKey: "cross-lane",
      mutation: {
        type: "move-before",
        threadId: "claude:thread-a",
        level: "focus",
        beforeThreadId: "codex:thread-1",
        context: "engineering",
        isCurrent: true,
      },
    });
    expect(moved).toMatchObject({ outcome: "applied", revision: 4 });
    expect(moved.snapshot.focus.map((thread) => ({ id: thread.id, context: thread.context, isCurrent: thread.isCurrent }))).toEqual([
      { id: "codex:thread-0", context: null, isCurrent: false },
      { id: "claude:thread-a", context: "engineering", isCurrent: true },
      { id: "codex:thread-1", context: null, isCurrent: false },
    ]);

    await expectRejected(service, { type: "set-level", threadId: "codex:missing", level: "focus" }, "unknown-thread");
    await expectRejected(service, { type: "set-source-enabled", sourceId: "unknown", enabled: true }, "unknown-source");
    await expectRejected(service, {
      type: "set-level", threadId: "claude:thread-a", level: "important",
    }, "invalid-target");
    await expectRejected(service, {
      type: "move-before", threadId: "claude:thread-a", level: "important",
    }, "invalid-target");
    await expectRejected(service, {
      type: "move-before", threadId: "codex:thread-0", level: "important", beforeThreadId: "claude:thread-a",
    }, "invalid-target");
    await expectRejected(service, {
      type: "move-before", threadId: "codex:thread-0", level: "important", currentThreadId: "codex:thread-0",
    }, "invalid-target");
  });

  it("applies a keyed move-before exactly once and replays its full atomic result", async () => {
    const directory = await temporaryDirectory();
    const service = createService(directory);
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } });
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-1", level: "focus" } });
    await service.mutate({ mutation: { type: "set-level", threadId: "claude:thread-a", level: "important" } });
    const request: DeckMutationRequest = {
      protocolVersion: 1,
      idempotencyKey: "move-before-once",
      mutation: {
        type: "move-before",
        threadId: "claude:thread-a",
        level: "focus",
        beforeThreadId: "codex:thread-1",
        context: "design",
        currentThreadId: "claude:thread-a",
      },
    };

    const applied = await service.mutate(request);
    const replayed = await service.mutate(request);
    expect(applied).toMatchObject({ outcome: "applied", revision: 4, snapshot: { current: { id: "claude:thread-a" } } });
    expect(replayed).toMatchObject({ outcome: "replayed", revision: 4, snapshot: { current: { id: "claude:thread-a" } } });
    const persisted = await new GajendraStoreRepository(directory).read();
    expect(persisted.revision).toBe(4);
    expect(persisted.idempotency).toHaveLength(1);
    expect(persisted.entries.map((entry) => [entry.threadId, entry.level, entry.context ?? null])).toEqual([
      ["codex:thread-0", "focus", null],
      ["claude:thread-a", "focus", "design"],
      ["codex:thread-1", "focus", null],
    ]);
    expect(persisted.currentFocusThreadId).toBe("claude:thread-a");
  });

  it("survives a process loss after an atomic move-before primary write without a half state", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { lockTimeoutMs: 50, staleLockMs: 50 });
    await repository.write({
      version: 3,
      revision: 0,
      currentFocusThreadId: "codex:thread-1",
      entries: [
        { threadId: "codex:thread-0", level: "focus", addedAt: "2026-08-18T00:00:00.000Z" },
        { threadId: "codex:thread-1", level: "focus", addedAt: "2026-08-18T00:00:01.000Z" },
        { threadId: "claude:thread-a", level: "important", addedAt: "2026-08-18T00:00:02.000Z", context: "life" },
      ],
      collapsed: { focus: false, important: false },
      sourcePreferences: { codex: true, claude: true },
      idempotency: [],
      reviewAcknowledgements: [],
    });
    await expect(runFile(process.execPath, [viteNode, faultWorker], {
      cwd: packageRoot,
      env: { ...process.env, GAJENDRA_DATA_DIR: directory },
      timeout: 10_000,
    })).rejects.toMatchObject({ code: 86 });

    const raw = JSON.parse(await readFile(repository.filePath, "utf8")) as {
      currentFocusThreadId: string | null;
      entries: Array<{ threadId: string; level: string; context?: string }>;
    };
    const observed = {
      currentFocusThreadId: raw.currentFocusThreadId,
      entries: raw.entries.map((entry) => [entry.threadId, entry.level, entry.context ?? null]),
    };
    expect([
      {
        currentFocusThreadId: "codex:thread-1",
        entries: [
          ["codex:thread-0", "focus", null],
          ["codex:thread-1", "focus", null],
          ["claude:thread-a", "important", "life"],
        ],
      },
      {
        currentFocusThreadId: "claude:thread-a",
        entries: [
          ["claude:thread-a", "focus", "design"],
          ["codex:thread-0", "focus", null],
          ["codex:thread-1", "focus", null],
        ],
      },
    ]).toContainEqual(observed);

    // The terminated writer cannot release its directory lock. Wait for this exact lock directory
    // to cross the existing 50ms stale threshold before asserting eventual safe reclaim; this is
    // not a 50ms scheduler-SLA assertion.
    await waitForLockToBecomeStale(repository.lockPath, 50);
    const nextWriter = new GajendraStoreRepository(directory, [], {
      lockTimeoutMs: 50,
      staleLockMs: 50,
    });
    await nextWriter.transaction(async (current) => ({
      value: undefined,
      next: { ...current, revision: current.revision + 1, collapsed: { ...current.collapsed, focus: true } },
    }));
    const recovered = await nextWriter.read();
    expect(recovered).toMatchObject({ revision: 2, collapsed: { focus: true } });
    expect(recovered.entries.map((entry) => [entry.threadId, entry.level, entry.context ?? null])).toEqual(observed.entries);
    expect(recovered.currentFocusThreadId).toBe(observed.currentFocusThreadId);
  }, 15_000);

  it("recollects when a move-before target disappears and leaves the priority store unchanged", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    await repository.write({
      version: 3,
      revision: 0,
      currentFocusThreadId: "codex:thread-0",
      entries: [
        { threadId: "codex:thread-0", level: "focus", addedAt: "2026-08-18T00:00:00.000Z" },
        { threadId: "codex:thread-1", level: "focus", addedAt: "2026-08-18T00:00:01.000Z" },
      ],
      collapsed: { focus: false, important: false },
      sourcePreferences: { codex: true, "disappearing-target": false },
      idempotency: [],
      reviewAcknowledgements: [],
    });
    let collections = 0;
    const service = new GajendraService(repository, {
      collect: async () => {
        collections += 1;
        if (collections === 1) {
          await repository.transaction(async (current) => ({
            value: undefined,
            next: {
              ...current,
              revision: current.revision + 1,
              sourcePreferences: { ...current.sourcePreferences, "disappearing-target": true },
            },
          }));
          return collectionForIds(["codex:thread-0", "codex:thread-1"]);
        }
        return collectionForIds(["codex:thread-0"]);
      },
      close: async () => undefined,
    });

    const result = await service.mutate({ mutation: {
      type: "move-before", threadId: "codex:thread-0", level: "focus", beforeThreadId: "codex:thread-1",
    } });
    expect(collections).toBe(2);
    expect(result).toMatchObject({ outcome: "rejected", revision: 1, error: { code: "invalid-target" } });
    const after = await repository.read();
    expect(after.revision).toBe(1);
    expect(after.currentFocusThreadId).toBe("codex:thread-0");
    expect(after.entries).toEqual([
      { threadId: "codex:thread-0", level: "focus", addedAt: "2026-08-18T00:00:00.000Z" },
      { threadId: "codex:thread-1", level: "focus", addedAt: "2026-08-18T00:00:01.000Z" },
    ]);
  });

  it("restores an arbitrary non-first NOW thread, lane, order, and context in one inverse move-before", async () => {
    const directory = await temporaryDirectory();
    const service = createService(directory);
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } });
    await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-1", level: "focus" } });
    await service.mutate({ mutation: { type: "set-current", threadId: "codex:thread-1" } });
    await service.mutate({ mutation: {
      type: "move-before", threadId: "codex:thread-0", level: "focus", beforeThreadId: "codex:thread-1",
    } });
    await service.mutate({ mutation: {
      type: "move-before", threadId: "claude:thread-a", level: "important", context: "life",
    } });
    const beforeMakeNow = await service.snapshot();
    expect(beforeMakeNow.focus.map((thread) => [thread.id, thread.isCurrent])).toEqual([
      ["codex:thread-0", false], ["codex:thread-1", true],
    ]);

    await expect(service.mutate({ mutation: {
      type: "move-before",
      threadId: "claude:thread-a",
      level: "focus",
      beforeThreadId: "codex:thread-0",
      context: "engineering",
      currentThreadId: "claude:thread-a",
    } })).resolves.toMatchObject({ outcome: "applied", snapshot: { current: { id: "claude:thread-a" } } });

    const restored = await service.mutate({ mutation: {
      type: "move-before",
      threadId: "claude:thread-a",
      level: "important",
      beforeThreadId: null,
      context: "life",
      currentThreadId: "codex:thread-1",
    } });
    expect(restored).toMatchObject({ outcome: "applied", snapshot: {
      current: { id: "codex:thread-1" },
      focus: [
        { id: "codex:thread-0", isCurrent: false },
        { id: "codex:thread-1", isCurrent: true },
      ],
      important: [{ id: "claude:thread-a", context: "life", isCurrent: false }],
    } });
  });

  it("recollects after a concurrent source toggle and returns the post-toggle registry", async () => {
    const directory = await temporaryDirectory();
    const contender = createService(directory);
    let collections = 0;
    const racingService = new GajendraService(new GajendraStoreRepository(directory), {
      collect: async (preferences) => {
        collections += 1;
        if (collections === 1) {
          await contender.mutate({ mutation: { type: "set-source-enabled", sourceId: "codex", enabled: false } });
        }
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    });

    await expect(racingService.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } }))
      .resolves.toMatchObject({ outcome: "rejected", error: { code: "unknown-thread" } });
    expect(collections).toBe(2);

    const snapshots: Array<Record<string, boolean>> = [];
    const toggleService = new GajendraService(new GajendraStoreRepository(await temporaryDirectory()), {
      collect: async (preferences) => {
        snapshots.push({ ...preferences });
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    });
    const toggled = await toggleService.mutate({ mutation: { type: "set-source-enabled", sourceId: "codex", enabled: false } });
    expect(toggled.snapshot.sources).toContainEqual(expect.objectContaining({ id: "codex", enabled: false, state: "disabled" }));
    expect(snapshots.at(-1)?.codex).toBe(false);
  });

  it("retries a snapshot collection across a concurrent source toggle so source rows and revision match", async () => {
    const directory = await temporaryDirectory();
    const contender = createService(directory);
    let collections = 0;
    const racingService = new GajendraService(new GajendraStoreRepository(directory), {
      collect: async (preferences) => {
        collections += 1;
        if (collections === 1) {
          await contender.mutate({ mutation: { type: "set-source-enabled", sourceId: "codex", enabled: false } });
        }
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    });

    const snapshot = await racingService.snapshot();
    expect(collections).toBe(2);
    expect(snapshot).toMatchObject({
      revision: 1,
      sources: [expect.objectContaining({ id: "codex", enabled: false, state: "disabled" })],
    });
  });

  it("lets a bounded source refresh use the stale-lock window instead of the lock timeout", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { lockTimeoutMs: 50, staleLockMs: 1_000 });
    const collection = collectionForIds(["codex:slow-ready"]);
    collection.threads[0] = {
      ...collection.threads[0]!,
      review: {
        state: "ready",
        kind: "result",
        updatedAt: 1_786_545_400,
        destination: { type: "thread", deepLink: "codex://threads/slow-ready" },
        providerStatus: "completed",
      },
    };
    let collections = 0;
    const service = new GajendraService(repository, {
      collect: async () => {
        collections += 1;
        await delay(150);
        return collection;
      },
      close: async () => undefined,
    });

    const snapshot = await service.snapshot();
    expect(collections).toBe(1);
    expect(snapshot.error).toBeNull();
    expect(snapshot.available.map((thread) => thread.id)).toEqual(["codex:slow-ready"]);
    expect(snapshot.available[0]?.review?.state).toBe("ready");
  });

  it("keeps valid data beyond the legacy 30-second fallback without waiting tens of seconds", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { lockTimeoutMs: 5_000, staleLockMs: 30_000 });
    const collection = collectionForIds(["codex:derived-envelope"]);
    let clock = 0;
    const service = new GajendraService(repository, {
      collect: async () => {
        // Simulate a provider returning after the old 30s stale-lock-derived deadline. The
        // injected clock advances the full interval without making the test wait tens of seconds.
        clock = 31_000;
        return collection;
      },
      close: async () => undefined,
    }, { now: () => clock });

    const snapshot = await service.snapshot();
    expect(snapshot.error).toBeNull();
    expect(snapshot.available.map((thread) => thread.id)).toEqual(["codex:derived-envelope"]);
  });

  it("keeps a live Codex review projection out of persistence and discards it on a changed source generation", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const contender = new GajendraService(repository, {
      collect: async (preferences) => preferenceCollection(preferences),
      close: async () => undefined,
    });
    let collections = 0;
    const service = new GajendraService(repository, {
      collect: async (preferences) => {
        collections += 1;
        if (collections === 1) {
          await contender.mutate({ mutation: { type: "set-source-enabled", sourceId: "codex", enabled: false } });
          const collection = preferenceCollection(preferences);
          return {
            ...collection,
            threads: collection.threads.map((candidate) => ({
              ...candidate,
              review: {
                state: "ready" as const,
                kind: "result" as const,
                updatedAt: 1_786_545_400,
                destination: { type: "thread" as const, deepLink: "codex://threads/thread-0" },
                providerStatus: "completed",
              },
            })),
          };
        }
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    });

    const snapshot = await service.snapshot();
    expect(collections).toBe(2);
    expect(snapshot).toMatchObject({
      revision: 1,
      sources: [expect.objectContaining({ id: "codex", enabled: false, state: "disabled" })],
      focus: [],
      important: [],
      available: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain("completed");
    const persisted = await readFile(path.join(directory, "gajendra.v2.json"), "utf8");
    expect(persisted).not.toContain("gajendraReview");
    expect(persisted).not.toContain("completed");
  });

  it("acknowledges only the exact current non-Running review and supports a reversible restore", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const ready = thread("codex:thread-0", "codex");
    ready.review = {
      state: "ready",
      kind: "result",
      updatedAt: 1_787_630_400,
      destination: { type: "thread", deepLink: ready.deepLink },
      providerStatus: "COMPLETED",
    };
    const service = new GajendraService(repository, {
      collect: async () => ({ threads: [ready], sources: collectionForIds([ready.id]).sources, error: null }),
      close: async () => undefined,
    });

    await expectRejected(service, {
      type: "set-review-acknowledged",
      threadId: ready.id,
      reviewUpdatedAt: ready.review.updatedAt - 1,
      reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review),
      acknowledged: true,
    }, "invalid-target");
    const renderedIdentity = hashReviewAcknowledgement(ready.id, ready.review);
    ready.review = {
      ...ready.review,
      destination: { type: "thread", deepLink: `${ready.deepLink}/corrected` },
    };
    await expectRejected(service, {
      type: "set-review-acknowledged",
      threadId: ready.id,
      reviewUpdatedAt: ready.review.updatedAt,
      reviewIdentity: renderedIdentity,
      acknowledged: true,
    }, "invalid-target");
    const acknowledged = await service.mutate({
      expectedRevision: 0,
      mutation: {
        type: "set-review-acknowledged",
        threadId: ready.id,
        reviewUpdatedAt: ready.review.updatedAt,
        reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review),
        acknowledged: true,
      },
    });
    expect(acknowledged).toMatchObject({ outcome: "applied", revision: 1 });
    expect(acknowledged.snapshot.available[0]?.review).toBeUndefined();
    expect((await repository.read()).entries).toEqual([]);

    const restored = await service.mutate({
      expectedRevision: 1,
      mutation: {
        type: "set-review-acknowledged",
        threadId: ready.id,
        reviewUpdatedAt: ready.review.updatedAt,
        reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review),
        acknowledged: false,
      },
    });
    expect(restored.snapshot.available[0]?.review?.state).toBe("ready");

    ready.status = "running";
    await expectRejected(service, {
      type: "set-review-acknowledged",
      threadId: ready.id,
      reviewUpdatedAt: ready.review.updatedAt,
      reviewIdentity: hashReviewAcknowledgement(ready.id, ready.review),
      acknowledged: true,
    }, "invalid-target");
  });

  it("rejects review acknowledgement capacity overflow without evicting handled work", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { reviewAcknowledgementLimit: 1 });
    const readyThreads = [thread("codex:thread-0", "codex"), thread("codex:thread-1", "codex")];
    readyThreads.forEach((candidate, index) => {
      candidate.review = {
        state: "ready",
        kind: "result",
        updatedAt: 1_787_630_400 + index,
        destination: { type: "thread", deepLink: candidate.deepLink },
        providerStatus: "COMPLETED",
      };
    });
    const service = new GajendraService(repository, {
      collect: async () => ({ threads: readyThreads, sources: collectionForIds(readyThreads.map((thread) => thread.id)).sources, error: null }),
      close: async () => undefined,
    });
    const first = readyThreads[0]!;
    const second = readyThreads[1]!;
    await service.mutate({ mutation: {
      type: "set-review-acknowledged", threadId: first.id, reviewUpdatedAt: first.review!.updatedAt,
      reviewIdentity: hashReviewAcknowledgement(first.id, first.review!), acknowledged: true,
    } });
    first.review = { ...first.review!, updatedAt: first.review!.updatedAt + 10 };
    const replacement = await service.mutate({ mutation: {
      type: "set-review-acknowledged", threadId: first.id, reviewUpdatedAt: first.review.updatedAt,
      reviewIdentity: hashReviewAcknowledgement(first.id, first.review), acknowledged: true,
    } });
    expect(replacement).toMatchObject({ outcome: "applied" });
    expect((await repository.read()).reviewAcknowledgements).toHaveLength(1);
    const restarted = new GajendraService(new GajendraStoreRepository(directory, [], { reviewAcknowledgementLimit: 1 }), {
      collect: async () => ({ threads: readyThreads, sources: collectionForIds(readyThreads.map((thread) => thread.id)).sources, error: null }),
      close: async () => undefined,
    });
    expect((await restarted.snapshot()).available.find((thread) => thread.id === first.id)?.review).toBeUndefined();
    await expectRejected(service, {
      type: "set-review-acknowledged", threadId: second.id, reviewUpdatedAt: second.review!.updatedAt,
      reviewIdentity: hashReviewAcknowledgement(second.id, second.review!), acknowledged: true,
    }, "review-acknowledgement-limit");
    const state = await repository.read();
    expect(state.reviewAcknowledgements).toHaveLength(1);
    const snapshot = await service.snapshot();
    expect(snapshot.available.find((thread) => thread.id === first.id)?.review).toBeUndefined();
    expect(snapshot.available.find((thread) => thread.id === second.id)?.review?.state).toBe("ready");
  });

  it("derives a priority-only concurrent generation from the transaction without recollecting sources", async () => {
    const directory = await temporaryDirectory();
    const contender = createService(directory);
    let collections = 0;
    const racingService = new GajendraService(new GajendraStoreRepository(directory), {
      collect: async (preferences) => {
        collections += 1;
        if (collections === 1) {
          await contender.mutate({ mutation: { type: "set-collapsed", level: "focus", collapsed: true } });
        }
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    });

    const result = await racingService.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } });
    expect(collections).toBe(1);
    expect(result).toMatchObject({ outcome: "applied", revision: 2, snapshot: { collapsed: { focus: true } } });
  });

  it("bounds sustained source-generation churn and returns only a fresh typed busy fallback", async () => {
    const directory = await temporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    let collections = 0;
    const churningSources = {
      collect: async (preferences: Record<string, boolean>) => {
        collections += 1;
        await delay(5);
        await repository.transaction(async (current) => ({
          value: undefined,
          next: {
            ...current,
            revision: current.revision + 1,
            sourcePreferences: { ...current.sourcePreferences, codex: !current.sourcePreferences.codex },
          },
        }));
        return preferenceCollection(preferences);
      },
      close: async () => undefined,
    };
    const service = new GajendraService(repository, churningSources, {
      generationDeadlineMs: 100,
      maxGenerationRetries: 1,
    });

    const result = await service.mutate({ mutation: { type: "set-level", threadId: "codex:thread-0", level: "focus" } });
    expect(collections).toBe(2);
    expect(result).toMatchObject({
      outcome: "rejected",
      error: { code: "store-busy" },
      snapshot: { error: expect.stringContaining("changed repeatedly"), focus: [], important: [], available: [] },
    });
    const afterMutation = await repository.read();
    expect(afterMutation.entries).toEqual([]);
    expect(result.revision).toBe(afterMutation.revision);

    const collectionsBeforeSnapshot = collections;
    const snapshot = await service.snapshot();
    // The absolute deadline may stop the snapshot before or after its one permitted retry.
    // Prove the upper bound and authoritative fallback instead of requiring scheduler timing to
    // produce exactly two more provider collections.
    expect(collections).toBeGreaterThanOrEqual(collectionsBeforeSnapshot);
    expect(collections).toBeLessThanOrEqual(collectionsBeforeSnapshot + 2);
    expect(snapshot).toMatchObject({ error: expect.stringContaining("changed repeatedly"), focus: [], important: [], available: [] });
    expect(snapshot.revision).toBe((await repository.read()).revision);
  });
});

async function expectRejected(service: GajendraService, mutation: DeckMutationRequest["mutation"], code: string): Promise<void> {
  await expect(service.mutate({ protocolVersion: 1, mutation })).resolves.toMatchObject({
    outcome: "rejected",
    error: { code },
  });
}

function createService(directory: string): GajendraService {
  return new GajendraService(new GajendraStoreRepository(directory), {
    collect: async () => collection(),
    close: async () => undefined,
  });
}

function collection(): { threads: AgentThread[]; sources: ThreadSourceStatus[]; error: null } {
  const source = (id: string, name: string, state: SourceState = "ready"): ThreadSourceStatus => ({
    id, name, kind: "builtin", state, enabled: true, threadCount: id === "codex" ? 12 : 1, detail: null,
  });
  const threads: AgentThread[] = [
    ...Array.from({ length: 12 }, (_, index) => thread(`codex:thread-${index}`, "codex")),
    thread("claude:thread-a", "claude"),
  ];
  return { threads, sources: [source("codex", "Codex"), source("claude", "Claude Code")], error: null };
}

function preferenceCollection(preferences: Record<string, boolean>): { threads: AgentThread[]; sources: ThreadSourceStatus[]; error: null } {
  const enabled = preferences.codex ?? true;
  return {
    threads: enabled ? [thread("codex:thread-0", "codex")] : [],
    sources: [{
      id: "codex",
      name: "Codex",
      kind: "builtin",
      state: enabled ? "ready" : "disabled",
      enabled,
      threadCount: enabled ? 1 : 0,
      detail: null,
    }],
    error: null,
  };
}

function collectionForIds(ids: string[]): { threads: AgentThread[]; sources: ThreadSourceStatus[]; error: null } {
  return {
    threads: ids.map((id) => thread(id, "codex")),
    sources: [{ id: "codex", name: "Codex", kind: "builtin", state: "ready", enabled: true, threadCount: ids.length, detail: null }],
    error: null,
  };
}

function thread(id: string, sourceId: string): AgentThread {
  return {
    id,
    sourceId,
    sourceName: sourceId,
    title: id,
    project: "fixture",
    updatedAt: 1,
    status: "idle",
    deepLink: `gajendra://thread/${id}`,
    allowedDeepLinkSchemes: ["gajendra"],
  };
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-mutation-service-"));
  temporaryDirectories.push(directory);
  return directory;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForLockToBecomeStale(lockPath: string, staleLockMs: number, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const metadata = await stat(lockPath);
    if (Date.now() - metadata.mtimeMs >= staleLockMs) return;
    if (Date.now() >= deadline) throw new Error("Fault-writer lock did not become stale within the test budget.");
    await delay(8);
  }
}
