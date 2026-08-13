import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EMPTY_STORE, type PriorityStore } from "../../src/shared/contracts.js";
import { GajendraStoreRepository, resolveDataDirectory, resolveLegacyStateFiles } from "../../src/server/store.js";

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
    expect(resolveLegacyStateFiles({ CODEX_HOME: "/tmp/codex" })).toEqual([
      path.join("/tmp/codex", "aadi", "aadi.v1.json"),
      path.join("/tmp/codex", "priority-deck", "priority-deck.v1.json"),
    ]);
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
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
