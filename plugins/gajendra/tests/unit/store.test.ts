import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EMPTY_STORE, type PriorityStore } from "../../src/shared/contracts.js";
import { GajendraStoreRepository, StoreBusyError, StoreRecoveryError, resolveDataDirectory, resolveLegacyStateFiles } from "../../src/server/store.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("GajendraStoreRepository", () => {
  it("returns an empty v2 store when no file exists", async () => {
    const directory = await createTemporaryDirectory();
    await expect(new GajendraStoreRepository(directory).read()).resolves.toEqual(EMPTY_STORE);
  });

  it("writes only priority/source metadata with private permissions", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const state = {
      ...structuredClone(EMPTY_STORE),
      currentFocusThreadId: "claude:thread-a",
      entries: [{ threadId: "claude:thread-a", level: "focus" as const, addedAt: "2026-08-12T12:00:00.000Z", context: "design" as const }],
      sourcePreferences: { ...EMPTY_STORE.sourcePreferences, claude: true },
    };
    await repository.write(state);
    const contents = await readFile(repository.filePath, "utf8");
    expect(contents).toContain('"threadId": "claude:thread-a"');
    expect(contents).toContain('"context": "design"');
    expect(contents).not.toMatch(/preview|transcript|prompt/iu);
    expect((await stat(repository.filePath)).mode & 0o777).toBe(0o600);
    await expect(repository.read()).resolves.toEqual(state);
  });

  it("strips injected provider prose and unknown entry fields before writing", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const unsafeState = {
      ...structuredClone(EMPTY_STORE),
      entries: [{
        threadId: "codex:thread-a",
        level: "focus",
        addedAt: "2026-08-12T12:00:00.000Z",
        context: "life",
        title: "private title",
        project: "private project",
        prompt: "private prompt",
        unknown: "discard me",
      }],
      currentFocusThreadId: "codex:thread-a",
    } as unknown as PriorityStore;
    await repository.write(unsafeState);
    const contents = await readFile(repository.filePath, "utf8");
    expect(contents).toContain('"context": "life"');
    expect(contents).not.toMatch(/private|title|project|prompt|unknown/iu);
  });

  it("prefers explicit and plugin-owned data directories", () => {
    expect(resolveDataDirectory({ GAJENDRA_DATA_DIR: "/tmp/explicit", PLUGIN_DATA: "/tmp/plugin" })).toBe("/tmp/explicit");
    expect(resolveDataDirectory({ PLUGIN_DATA: "/tmp/plugin" })).toBe("/tmp/plugin");
    expect(resolveLegacyStateFiles({ GAJENDRA_DATA_DIR: "/tmp/isolated", CODEX_HOME: "/tmp/codex" })).toEqual([]);
    expect(resolveLegacyStateFiles({ CODEX_HOME: "/tmp/codex" })).toEqual([
      path.join("/tmp/codex", "aadi", "aadi.v1.json"),
      path.join("/tmp/codex", "priority-deck", "priority-deck.v1.json"),
    ]);
  });

  it("fully isolates default construction under GAJENDRA_DATA_DIR unless migration is explicitly supplied", async () => {
    const dataDirectory = await createTemporaryDirectory();
    const codexHome = await createTemporaryDirectory();
    const legacyFile = path.join(codexHome, "aadi", "aadi.v1.json");
    await mkdir(path.dirname(legacyFile), { recursive: true });
    await writeFile(legacyFile, JSON.stringify({
      version: 1,
      currentFocusThreadId: "legacy-thread",
      entries: [{ threadId: "legacy-thread", level: "focus", addedAt: "2026-08-12T12:00:00.000Z" }],
      collapsed: { focus: false, important: false },
    }));
    const originalDataDirectory = process.env.GAJENDRA_DATA_DIR;
    const originalCodexHome = process.env.CODEX_HOME;
    try {
      process.env.GAJENDRA_DATA_DIR = dataDirectory;
      process.env.CODEX_HOME = codexHome;
      const isolated = new GajendraStoreRepository();
      expect(isolated.legacyFilePaths).toEqual([]);
      await expect(isolated.read()).resolves.toEqual(EMPTY_STORE);
      await expect(readFile(isolated.filePath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

      const explicitlyMigrating = new GajendraStoreRepository(undefined, [legacyFile]);
      await expect(explicitlyMigrating.read()).resolves.toMatchObject({ currentFocusThreadId: "codex:legacy-thread" });
    } finally {
      restoreEnvironment("GAJENDRA_DATA_DIR", originalDataDirectory);
      restoreEnvironment("CODEX_HOME", originalCodexHome);
    }
  });

  it("copies Aadi metadata into v2 without deleting the legacy file", async () => {
    const directory = await createTemporaryDirectory();
    const legacyDirectory = await createTemporaryDirectory();
    const legacyFile = path.join(legacyDirectory, "aadi.v1.json");
    const legacyState = {
      version: 1,
      currentFocusThreadId: "thread-a",
      entries: [{ threadId: "thread-a", level: "focus", addedAt: "2026-08-12T12:00:00.000Z" }],
      collapsed: { focus: false, important: false },
    };
    await writeFile(legacyFile, JSON.stringify(legacyState), { mode: 0o600 });
    const repository = new GajendraStoreRepository(directory, [legacyFile]);
    const migrated = await repository.read();
    expect(migrated.currentFocusThreadId).toBe("codex:thread-a");
    await expect(readFile(repository.filePath, "utf8")).resolves.toContain('"threadId": "codex:thread-a"');
    await expect(readFile(legacyFile, "utf8")).resolves.toContain('"threadId":"thread-a"');
  });

  it("migrates v2 state to revisioned v3 metadata on the next private write", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    await writeFile(repository.filePath, JSON.stringify({
      version: 2,
      currentFocusThreadId: "codex:thread-a",
      entries: [{ threadId: "codex:thread-a", level: "focus", addedAt: "2026-08-12T12:00:00.000Z" }],
      collapsed: { focus: false, important: false },
      sourcePreferences: { codex: true },
    }));
    const migrated = await repository.read();
    expect(migrated).toMatchObject({ version: 3, revision: 0, idempotency: [] });
    await repository.write(migrated);
    await expect(readFile(repository.filePath, "utf8")).resolves.toContain('"version": 3');
  });

  it("hashes legacy and new idempotency receipt keys before private persistence", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const rawKey = "caller supplied free text must never be stored";
    await writeFile(repository.filePath, JSON.stringify({
      ...EMPTY_STORE,
      idempotency: [{ key: rawKey, fingerprint: "a".repeat(64), revision: 1 }],
    }), { mode: 0o600 });

    await expect(repository.read()).resolves.toMatchObject({
      idempotency: [{ keyHash: expect.stringMatching(/^[a-f0-9]{64}$/u), revision: 1 }],
    });
    const persisted = await readFile(repository.filePath, "utf8");
    expect(persisted).not.toContain(rawKey);
    expect(persisted).not.toMatch(/"key"\s*:/u);
  });

  it("quarantines corrupt state and restores only a private last-known-good copy", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const knownGood = {
      ...structuredClone(EMPTY_STORE),
      currentFocusThreadId: "codex:thread-a",
      entries: [{ threadId: "codex:thread-a", level: "focus" as const, addedAt: "2026-08-12T12:00:00.000Z" }],
    };
    await repository.write(knownGood);
    await writeFile(repository.filePath, "{not json", { mode: 0o600 });
    await expect(repository.read()).resolves.toMatchObject({ currentFocusThreadId: "codex:thread-a" });
    expect(await readdir(directory)).toEqual(expect.arrayContaining([
      "gajendra.v2.last-known-good.json",
      expect.stringMatching(/^gajendra\.v2\.corrupt-/u),
    ]));
    await expect(readFile(repository.filePath, "utf8")).resolves.not.toContain("not json");
  });

  it("quarantines a structurally invalid primary before normalization and restores a valid revisioned LKG", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const knownGood = {
      ...structuredClone(EMPTY_STORE),
      revision: 7,
      currentFocusThreadId: "codex:known-good",
      entries: [{ threadId: "codex:known-good", level: "focus" as const, addedAt: "2026-08-12T12:00:00.000Z" }],
    };
    await repository.write(knownGood);
    await writeFile(repository.filePath, JSON.stringify({ version: 3, sourcePreferences: { codex: false } }), { mode: 0o600 });

    await expect(repository.read()).resolves.toMatchObject({ revision: 7, currentFocusThreadId: "codex:known-good" });
    expect(await readdir(directory)).toContainEqual(expect.stringMatching(/^gajendra\.v2\.corrupt-/u));
    await expect(readFile(repository.filePath, "utf8")).resolves.toContain('"revision": 7');
  });

  it("fails closed on every read after quarantining an oversized state without a backup", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { maxStoreBytes: 32 });
    await writeFile(repository.filePath, "x".repeat(64), { mode: 0o600 });
    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
    await expect(readFile(repository.filePath, "utf8")).resolves.toBe('{"recoveryRequired":true}\n');
    const quarantined = (await readdir(directory)).find((name) => name.startsWith("gajendra.v2.corrupt-"));
    expect(quarantined).toBeDefined();
    await expect(readFile(path.join(directory, quarantined!), "utf8")).resolves.toBe("x".repeat(64));
  });

  it("retains a durable recovery-required marker when the backup is invalid", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    await writeFile(repository.filePath, "{malformed primary", { mode: 0o600 });
    await writeFile(repository.backupPath, "{malformed backup", { mode: 0o600 });

    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
    await expect(readFile(repository.filePath, "utf8")).resolves.toBe('{"recoveryRequired":true}\n');
    await expect(readFile(repository.recoveryMarkerPath, "utf8")).resolves.toBe('{"recoveryRequired":true}\n');
    const quarantined = (await readdir(directory)).find((name) => name.startsWith("gajendra.v2.corrupt-"));
    expect(quarantined).toBeDefined();
    await expect(readFile(path.join(directory, quarantined!), "utf8")).resolves.toBe("{malformed primary");
  });

  it("resumes recovery after both replacement-primary and LKG crash points", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    const knownGood = {
      ...structuredClone(EMPTY_STORE),
      revision: 7,
      currentFocusThreadId: "codex:recovered",
      entries: [{ threadId: "codex:recovered", level: "focus" as const, addedAt: "2026-08-12T12:00:00.000Z" }],
    };
    await repository.write(knownGood);

    // Crash after a valid replacement landed but before marker cleanup.
    await writeFile(repository.recoveryMarkerPath, '{"recoveryRequired":true}\n', { mode: 0o600 });
    await expect(repository.read()).resolves.toMatchObject({ revision: 7, currentFocusThreadId: "codex:recovered" });
    await expect(readFile(repository.recoveryMarkerPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    // Crash after quarantine/marker creation but before the LKG was copied back to primary.
    await writeFile(repository.filePath, '{"recoveryRequired":true}\n', { mode: 0o600 });
    await writeFile(repository.recoveryMarkerPath, '{"recoveryRequired":true}\n', { mode: 0o600 });
    await expect(repository.read()).resolves.toMatchObject({ revision: 7, currentFocusThreadId: "codex:recovered" });
    await expect(repository.read()).resolves.toMatchObject({ revision: 7, currentFocusThreadId: "codex:recovered" });
  });

  it("fails closed if recovery is interrupted after primary quarantine and before a replacement primary", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory);
    await writeFile(repository.filePath, "{interrupted recovery primary", { mode: 0o600 });
    await rename(repository.filePath, path.join(directory, "gajendra.v2.corrupt-interrupted.json"));

    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
    await expect(repository.read()).rejects.toBeInstanceOf(StoreRecoveryError);
  });

  it("never lets two stale cleaners retire a newly acquired token-owned lock", async () => {
    const directory = await createTemporaryDirectory();
    const candidateReached = deferred<void>();
    const allowFirstCleaner = deferred<void>();
    // This test deliberately pauses one cleaner while a second cleaner and a live owner each
    // acquire the lock. Keep the acquisition budget above that controlled schedule so aggregate
    // suite load cannot turn the ownership proof into an unrelated StoreBusy rejection.
    const acquisitionBudgetMs = 1_500;
    const firstCleaner = new GajendraStoreRepository(directory, [], {
      lockTimeoutMs: acquisitionBudgetMs,
      staleLockMs: acquisitionBudgetMs,
      onStaleLockCandidate: async () => {
        candidateReached.resolve(undefined);
        await allowFirstCleaner.promise;
      },
    });
    await writeStaleLock(firstCleaner, "stale-owner");

    const firstRead = firstCleaner.read();
    await candidateReached.promise;
    await new GajendraStoreRepository(directory, [], {
      lockTimeoutMs: acquisitionBudgetMs,
      staleLockMs: acquisitionBudgetMs,
    }).read();

    const ownerAcquired = deferred<void>();
    const releaseOwner = deferred<void>();
    const liveOwner = new GajendraStoreRepository(directory, [], {
      lockTimeoutMs: acquisitionBudgetMs,
      staleLockMs: acquisitionBudgetMs,
    });
    const ownerTransaction = liveOwner.transaction(async () => {
      ownerAcquired.resolve(undefined);
      await releaseOwner.promise;
      return { value: undefined };
    });
    await ownerAcquired.promise;

    allowFirstCleaner.resolve(undefined);
    const liveOwnerRecord = await readFile(path.join(firstCleaner.lockPath, "owner.json"), "utf8");
    expect(liveOwnerRecord).not.toContain("stale-owner");

    releaseOwner.resolve(undefined);
    await Promise.all([ownerTransaction, firstRead]);
  });

  it("never exposes an ownerless fixed lock when acquisition pauses beyond the stale window", async () => {
    const directory = await createTemporaryDirectory();
    const candidateReady = deferred<void>();
    const publishCandidate = deferred<void>();
    const firstEntered = deferred<void>();
    const releaseFirst = deferred<void>();
    let activeCriticalSections = 0;
    const first = new GajendraStoreRepository(directory, [], {
      // This test intentionally parks the first writer through a stale window and a second
      // writer's critical section. Keep its acquisition budget above that controlled schedule so
      // suite load cannot turn the ownership proof into an unrelated StoreBusy rejection.
      lockTimeoutMs: 1_500,
      staleLockMs: 40,
      onBeforeLockPublish: async () => {
        candidateReady.resolve(undefined);
        await publishCandidate.promise;
      },
    });
    const firstTransaction = first.transaction(async () => {
      activeCriticalSections += 1;
      expect(activeCriticalSections).toBe(1);
      firstEntered.resolve(undefined);
      await releaseFirst.promise;
      activeCriticalSections -= 1;
      return { value: undefined };
    });
    await candidateReady.promise;
    // This exceeds staleLockMs. A cleaner/new owner must see no fixed directory to reclaim.
    await wait(80);
    await expect(stat(first.lockPath)).rejects.toMatchObject({ code: "ENOENT" });

    const secondEntered = deferred<void>();
    const releaseSecond = deferred<void>();
    const second = new GajendraStoreRepository(directory, [], { lockTimeoutMs: 1_500, staleLockMs: 40 });
    const secondTransaction = second.transaction(async () => {
      activeCriticalSections += 1;
      expect(activeCriticalSections).toBe(1);
      secondEntered.resolve(undefined);
      await releaseSecond.promise;
      activeCriticalSections -= 1;
      return { value: undefined };
    });
    await secondEntered.promise;

    publishCandidate.resolve(undefined);
    expect(await remainsPending(firstEntered.promise, 30)).toBe(true);
    releaseSecond.resolve(undefined);
    await secondTransaction;
    await firstEntered.promise;
    releaseFirst.resolve(undefined);
    await firstTransaction;
  });

  it("reclaims a dead reclaim guard only after preserving and revalidating its enclosing owner", async () => {
    const directory = await createTemporaryDirectory();
    const repository = new GajendraStoreRepository(directory, [], { lockTimeoutMs: 80, staleLockMs: 80 });
    await mkdir(repository.lockPath, { mode: 0o700 });
    const old = new Date(Date.now() - 1_000);
    await writeFile(path.join(repository.lockPath, "owner.json"), JSON.stringify({ token: "live-owner", pid: process.pid, createdAt: old.getTime() }));
    await writeFile(path.join(repository.lockPath, ".reclaiming"), JSON.stringify({ token: "dead-cleaner", pid: 999_999_999, createdAt: old.getTime() }));
    await utimes(path.join(repository.lockPath, ".reclaiming"), old, old);
    await utimes(repository.lockPath, old, old);

    await expect(repository.read()).rejects.toBeInstanceOf(StoreBusyError);
    await expect(readFile(path.join(repository.lockPath, "owner.json"), "utf8")).resolves.toContain("live-owner");
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((complete) => { resolve = complete; }), resolve };
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function remainsPending(promise: Promise<unknown>, milliseconds: number): Promise<boolean> {
  return Promise.race([promise.then(() => false), wait(milliseconds).then(() => true)]);
}

async function writeStaleLock(repository: GajendraStoreRepository, token: string): Promise<void> {
  await mkdir(repository.lockPath, { mode: 0o700 });
  const old = new Date(Date.now() - 2_000);
  await writeFile(path.join(repository.lockPath, "owner.json"), JSON.stringify({ token, pid: 999_999_999, createdAt: old.getTime() }));
  await utimes(path.join(repository.lockPath, "owner.json"), old, old);
  await utimes(repository.lockPath, old, old);
}
