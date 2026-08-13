import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCursorSessionList, readClaudeThreadMetadata, ThreadSourceRegistry } from "../../src/server/thread-sources.js";
import type { CodexAppServerClient } from "../../src/server/codex-app-server.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("thread source adapters", () => {
  it("normalizes Cursor's supported session list into resumable threads", () => {
    const [thread] = parseCursorSessionList("123e4567-e89b-12d3-a456-426614174000  Refactor authentication", "/usr/local/bin/cursor-agent");
    expect(thread).toMatchObject({
      id: "cursor:123e4567-e89b-12d3-a456-426614174000",
      sourceName: "Cursor",
      title: "Refactor authentication",
      resumeCommand: { executable: "/usr/local/bin/cursor-agent", args: ["--resume=123e4567-e89b-12d3-a456-426614174000"] },
    });
  });

  it("reads only documented Claude metadata fields and never uses message content as a title", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-claude-source-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "123e4567-e89b-12d3-a456-426614174000.jsonl");
    await writeFile(file, [
      JSON.stringify({ type: "user", sessionId: "123e4567-e89b-12d3-a456-426614174000", cwd: "/code/project", timestamp: "2026-08-12T12:00:00Z", message: { content: "private prompt must not become title" } }),
      JSON.stringify({ type: "ai-title", sessionId: "123e4567-e89b-12d3-a456-426614174000", aiTitle: "Review source adapters" }),
    ].join("\n"));
    const thread = await readClaudeThreadMetadata(file, "/usr/local/bin/claude");
    expect(thread).toMatchObject({
      id: "claude:123e4567-e89b-12d3-a456-426614174000",
      title: "Review source adapters",
      project: "project",
      resumeCommand: { args: ["--resume", "123e4567-e89b-12d3-a456-426614174000"] },
    });
    expect(thread?.title).not.toContain("private prompt");
  });

  it("loads an explicit bounded catalog without requiring a provider-specific adapter", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-catalog-source-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    await writeFile(catalogPath, JSON.stringify({
      version: 1,
      threads: [{
        id: "thread-123",
        title: "Synthetic adapter check",
        project: "/code/example",
        updatedAt: "2026-08-12T12:00:00Z",
        status: "idle",
        deepLink: "my-agent://threads/thread-123",
      }],
    }));
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "my-agent", name: "My Agent", catalog: catalogPath, enabled: true }],
    }));
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const registry = new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath });
    const result = await registry.collect({ codex: false, claude: false, cursor: false });
    expect(result.threads).toEqual([expect.objectContaining({
      id: "my-agent:thread-123",
      sourceName: "My Agent",
      title: "Synthetic adapter check",
      deepLink: "my-agent://threads/thread-123",
    })]);
    expect(result.sources).toContainEqual(expect.objectContaining({ id: "my-agent", state: "ready", threadCount: 1 }));
  });
});
