import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCursorSessionList, readClaudeThreadMetadata, readGrokThreadMetadata, selectSourceThreads, ThreadSourceRegistry } from "../../src/server/thread-sources.js";
import type { AgentThread } from "../../src/shared/contracts.js";
import type { CodexAppServerClient } from "../../src/server/codex-app-server.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("thread source adapters", () => {
  it("retains every active thread beyond the ordinary 200-thread history window", () => {
    const threads: AgentThread[] = Array.from({ length: 202 }, (_, index) => ({
      id: `fixture:${index}`,
      sourceId: "fixture",
      sourceName: "Fixture",
      title: `Thread ${index}`,
      project: "fixture",
      updatedAt: 202 - index,
      status: index === 201 ? "active" : "idle",
      deepLink: `fixture://threads/${index}`,
    }));

    const selected = selectSourceThreads(threads);
    expect(selected).toHaveLength(201);
    expect(selected).toContainEqual(expect.objectContaining({ id: "fixture:201", status: "active" }));
  });

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

  it("reads only documented Grok summary metadata and resumes the exact session", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-grok-source-"));
    temporaryDirectories.push(directory);
    const sessionDirectory = path.join(directory, "sessions", "encoded-project", "grok-session-1");
    await mkdir(sessionDirectory, { recursive: true });
    const file = path.join(sessionDirectory, "summary.json");
    await writeFile(file, JSON.stringify({
      info: { id: "grok-session-1", cwd: "/code/grok-project" },
      generated_title: "Review Grok adapter contracts",
      session_summary: "Older generated title",
      updated_at: "2026-08-13T12:00:00Z",
      first_prompt: "private prompt must never become a title",
    }));
    const thread = await readGrokThreadMetadata(file, "/usr/local/bin/grok");
    expect(thread).toMatchObject({
      id: "grok:grok-session-1",
      sourceName: "Grok Build",
      title: "Review Grok adapter contracts",
      project: "grok-project",
      resumeCommand: { executable: "/usr/local/bin/grok", args: ["--resume", "grok-session-1"], cwd: "/code/grok-project" },
    });
    expect(thread?.title).not.toContain("private prompt");

    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const registry = new ThreadSourceRegistry(codexStub, {
      GAJENDRA_GROK_BIN: process.execPath,
      GAJENDRA_GROK_CONFIG_DIR: directory,
      GAJENDRA_SOURCES_CONFIG: path.join(directory, "missing-sources.json"),
    });
    const result = await registry.collect({ codex: false, claude: false, cursor: false, grok: true });
    expect(result.threads).toEqual([expect.objectContaining({ id: "grok:grok-session-1" })]);
    expect(result.sources).toContainEqual(expect.objectContaining({ id: "grok", state: "ready", threadCount: 1 }));
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
    const result = await registry.collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(result.threads).toEqual([expect.objectContaining({
      id: "my-agent:thread-123",
      sourceName: "My Agent",
      title: "Synthetic adapter check",
      deepLink: "my-agent://threads/thread-123",
    })]);
    expect(result.sources).toContainEqual(expect.objectContaining({ id: "my-agent", state: "ready", threadCount: 1 }));
  });

  it("rejects configured threads that cannot resume in their owning agent", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-non-resumable-source-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    await writeFile(catalogPath, JSON.stringify({
      version: 1,
      threads: [{ id: "thread-without-destination", title: "Cannot resume", project: "example" }],
    }));
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "my-agent", name: "My Agent", catalog: catalogPath, enabled: true }],
    }));
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const registry = new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath });
    const result = await registry.collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(result.threads).toEqual([]);
    expect(result.sources).toContainEqual(expect.objectContaining({
      id: "my-agent",
      state: "error",
      threadCount: 0,
      detail: expect.stringContaining("deepLink or resumeCommand"),
    }));
  });
});
