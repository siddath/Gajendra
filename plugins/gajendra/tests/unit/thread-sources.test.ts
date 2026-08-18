import { mkdir, mkdtemp, readFile, rename, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  recentClaudeSessionFiles,
  recentGrokSummaryFiles,
  collectSourceAdapters,
  collectProcessOutput,
  parseCursorSessionList,
  readClaudeThreadMetadata,
  readGrokThreadMetadata,
  selectSourceThreads,
  ThreadSourceRegistry,
  type DiscoveryMeasurement,
  type SourceAdapter,
} from "../../src/server/thread-sources.js";
import type { AgentThread } from "../../src/shared/contracts.js";
import type { CodexAppServerClient } from "../../src/server/codex-app-server.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("thread source adapters", () => {
  it("bounds concurrent provider collection while retaining deterministic source order", async () => {
    let inFlight = 0;
    let peak = 0;
    const adapters: SourceAdapter[] = Array.from({ length: 9 }, (_, index) => ({
      id: `provider-${index}`,
      name: `Provider ${index}`,
      kind: "configured" as const,
      enabledByDefault: true,
      listThreads: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await delay(10);
        inFlight -= 1;
        return [threadForSource(`provider-${index}`, `thread-${index}`, index)];
      },
    }));
    const outcomes = await collectSourceAdapters(adapters, {}, 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(outcomes.map((outcome) => outcome.status.id)).toEqual(adapters.map((adapter) => adapter.id));
    expect(outcomes.map((outcome) => outcome.threads[0]?.id)).toEqual(adapters.map((adapter) => `${adapter.id}:thread-${adapter.id.slice("provider-".length)}`));
  });

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

  it("retains every explicit review-ready thread beyond the ordinary history window", () => {
    const threads: AgentThread[] = Array.from({ length: 202 }, (_, index) => ({
      id: `fixture:${index}`,
      sourceId: "fixture",
      sourceName: "Fixture",
      title: `Thread ${index}`,
      project: "fixture",
      updatedAt: 202 - index,
      status: "idle",
      deepLink: `fixture://threads/${index}`,
      ...(index === 201 ? {
        review: {
          state: "ready" as const,
          kind: "result" as const,
          updatedAt: 1,
          destination: { type: "thread" as const, deepLink: `fixture://threads/${index}` },
          providerStatus: "READY",
        },
      } : {}),
    }));

    const selected = selectSourceThreads(threads);
    expect(selected).toHaveLength(201);
    expect(selected).toContainEqual(expect.objectContaining({
      id: "fixture:201",
      review: expect.objectContaining({ state: "ready" }),
    }));
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

  it("keeps Grok reads on the originally opened bounded handle when the path is replaced", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-grok-open-handle-"));
    temporaryDirectories.push(directory);
    const file = path.join(directory, "summary.json");
    const replacement = path.join(directory, "replacement.json");
    await writeFile(file, JSON.stringify({
      info: { id: "opened-session", cwd: "/code/opened" },
      generated_title: "Opened handle title",
      updated_at: "2026-08-13T12:00:00Z",
    }));
    await writeFile(replacement, JSON.stringify({
      info: { id: "replacement-session" },
      generated_title: "replacement must not be read",
      padding: "x".repeat(128 * 1024),
    }));

    const thread = await readGrokThreadMetadata(file, "/usr/local/bin/grok", {
      onOpened: async () => { await rename(replacement, file); },
    });
    expect(thread).toMatchObject({ id: "grok:opened-session", title: "Opened handle title" });
  });

  it("caps configured-process stdout and reaps TERM-resistant inherited-pipe descendants before settling", async () => {
    const noisyChild = "process.on('SIGTERM', () => {}); process.stdout.write('x'.repeat(128)); setInterval(() => process.stdout.write('y'), 5);";
    const startedAt = Date.now();
    await expect(collectProcessOutput(process.execPath, ["-e", noisyChild], process.env, {
      outputLimitBytes: 32,
      timeoutMs: 1_000,
      killGraceMs: 25,
    })).rejects.toThrow("output limit");
    expect(Date.now() - startedAt).toBeLessThan(2_000);

    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-cursor-process-timeout-"));
    temporaryDirectories.push(directory);
    const parentPidPath = path.join(directory, "cursor-parent.pid");
    const descendantPidPath = path.join(directory, "cursor-descendant.pid");
    const descendant = "const fs = require('node:fs'); fs.writeFileSync(process.env.GAJENDRA_TEST_CURSOR_DESCENDANT_PID_PATH, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000);";
    const resistantChild = `const fs = require('node:fs'); const { spawn } = require('node:child_process'); fs.writeFileSync(process.env.GAJENDRA_TEST_CURSOR_PARENT_PID_PATH, String(process.pid)); process.on('SIGTERM', () => {}); spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit'], env: process.env }); setInterval(() => {}, 1_000);`;
    // Attach the rejection branch before waiting for fixture readiness, so a startup failure is
    // still consumed while the PID proof waits for the child to report itself.
    const descendantStartedAt = Date.now();
    const completion = collectProcessOutput(process.execPath, ["-e", resistantChild], {
      ...process.env,
      GAJENDRA_TEST_CURSOR_PARENT_PID_PATH: parentPidPath,
      GAJENDRA_TEST_CURSOR_DESCENDANT_PID_PATH: descendantPidPath,
    }, {
      outputLimitBytes: 32,
      timeoutMs: 2_000,
      killGraceMs: 25,
      closeGraceMs: 25,
    }).then(
      () => new Error("The TERM-resistant Cursor child unexpectedly completed."),
      (reason: unknown) => reason,
    );
    const [parentPid, descendantPid] = (await Promise.all([
      readFileWhenAvailable(parentPidPath),
      readFileWhenAvailable(descendantPidPath),
    ])).map(Number);
    const timeoutError = await completion;
    expect(timeoutError).toBeInstanceOf(Error);
    expect((timeoutError as Error).message).toBe("Cursor session listing timed out.");
    expect(Date.now() - descendantStartedAt).toBeLessThan(3_000);
    // collectProcessOutput resolves its terminal error only from close, so this check is exactly
    // after rejection and proves the SIGKILL fallback completed rather than merely being queued.
    expect(() => process.kill(parentPid!, 0)).toThrow();
    expect(() => process.kill(descendantPid!, 0)).toThrow();
  });

  it("fails closed after a provider exits but a TERM-resistant inherited-pipe descendant prevents close", async () => {
    if (process.platform === "win32") return;
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-cursor-inherited-pipe-"));
    temporaryDirectories.push(directory);
    const parentPidPath = path.join(directory, "cursor-parent.pid");
    const descendantPidPath = path.join(directory, "cursor-descendant.pid");
    const descendant = "const fs = require('node:fs'); fs.writeFileSync(process.env.GAJENDRA_TEST_CURSOR_DESCENDANT_PID_PATH, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1_000);";
    const parent = `const fs = require('node:fs'); const { spawn } = require('node:child_process'); fs.writeFileSync(process.env.GAJENDRA_TEST_CURSOR_PARENT_PID_PATH, String(process.pid)); spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit'], env: process.env }); const ready = setInterval(() => { if (fs.existsSync(process.env.GAJENDRA_TEST_CURSOR_DESCENDANT_PID_PATH)) process.exit(0); }, 5);`;
    const startedAt = Date.now();
    const completion = collectProcessOutput(process.execPath, ["-e", parent], {
      ...process.env,
      GAJENDRA_TEST_CURSOR_PARENT_PID_PATH: parentPidPath,
      GAJENDRA_TEST_CURSOR_DESCENDANT_PID_PATH: descendantPidPath,
    }, {
      timeoutMs: 2_000,
      killGraceMs: 25,
      closeGraceMs: 100,
    }).then(
      () => new Error("The inherited-pipe fixture unexpectedly completed."),
      (reason: unknown) => reason,
    );
    const [parentPid, descendantPid] = (await Promise.all([
      readFileWhenAvailable(parentPidPath),
      readFileWhenAvailable(descendantPidPath),
    ])).map(Number);
    const error = await completion;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Cursor session listing did not close its output streams.");
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    // The caller observes rejection only after the close watchdog escalates the dedicated group.
    expect(() => process.kill(parentPid!, 0)).toThrow();
    expect(() => process.kill(descendantPid!, 0)).toThrow();
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
        review: {
          state: "ready",
          kind: "pull-request",
          updatedAt: "2026-08-12T12:05:00Z",
          destination: { type: "url", url: "my-agent://reviews/thread-123" },
          providerStatus: "FINISHED",
        },
      }],
    }));
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "my-agent", name: "My Agent", catalog: catalogPath, enabled: true, deepLinkSchemes: ["my-agent"] }],
    }));
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const registry = new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath });
    const result = await registry.collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(result.threads).toEqual([expect.objectContaining({
      id: "my-agent:thread-123",
      sourceName: "My Agent",
      title: "Synthetic adapter check",
      deepLink: "my-agent://threads/thread-123",
      review: {
        state: "ready",
        kind: "pull-request",
        updatedAt: 1786536300,
        destination: { type: "url", url: "my-agent://reviews/thread-123" },
        providerStatus: "FINISHED",
      },
    })]);
    expect(result.sources).toContainEqual(expect.objectContaining({ id: "my-agent", state: "ready", threadCount: 1 }));
  });

  it("rejects fabricated review states and unsafe review destinations without leaking provider data", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-review-signal-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "review-agent", name: "Review Agent", catalog: catalogPath, enabled: true }],
    }));
    const invalidReviews = [
      {
        state: "finished",
        kind: "result",
        updatedAt: 1786536300,
        destination: { type: "url", url: "https://example.test/reviews/1" },
        providerStatus: "FINISHED",
      },
      {
        state: "ready",
        kind: "diff",
        updatedAt: 1786536300,
        destination: { type: "url", url: "javascript:provider-private-payload" },
        providerStatus: "FINISHED",
      },
    ];

    for (const review of invalidReviews) {
      await writeFile(catalogPath, JSON.stringify({
        version: 1,
        threads: [{ id: "unsafe", title: "Unsafe review", deepLink: "https://example.test/threads/1", review }],
      }));
      const result = await new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath })
        .collect({ codex: false, claude: false, cursor: false, grok: false });
      expect(result.threads).toEqual([]);
      expect(result.sources).toContainEqual(expect.objectContaining({ id: "review-agent", state: "error" }));
      expect(JSON.stringify(result)).not.toContain("provider-private-payload");
    }
  });

  it("keeps every active row while selecting only the 200 newest inactive rows from a maximum-size catalog", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-large-catalog-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    const inactive = Array.from({ length: 1_992 }, (_, index) => ({
      id: `idle-${index}`,
      title: `Idle ${index}`,
      updatedAt: 20_000 - index,
      status: "idle",
      deepLink: `large://threads/idle-${index}`,
    }));
    // These deliberately rank older than every inactive row. They must still survive the
    // history cap because provider-declared active work is never silently evicted.
    const active = Array.from({ length: 8 }, (_, index) => ({
      id: `active-${index}`,
      title: `Active ${index}`,
      updatedAt: index,
      status: "active",
      deepLink: `large://threads/active-${index}`,
    }));
    await writeFile(catalogPath, JSON.stringify({ version: 1, threads: [...inactive, ...active] }));
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "large", name: "Large synthetic catalog", catalog: catalogPath, enabled: true, deepLinkSchemes: ["large"] }],
    }));
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const registry = new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath });

    // Two seconds is intentionally generous for a local 2,000-row JSON parse; exact row/cap
    // assertions below are the non-timing proof that work and returned history remain bounded.
    const startedAt = Date.now();
    const result = await completesWithin(registry.collect({ codex: false, claude: false, cursor: false, grok: false }), 2_000);
    expect(Date.now() - startedAt).toBeLessThan(2_000);
    expect(result.sources).toContainEqual(expect.objectContaining({ id: "large", state: "ready", threadCount: 208 }));
    expect(result.threads).toHaveLength(208);
    expect(result.threads.filter((thread) => thread.status === "idle").map((thread) => thread.id)).toEqual(
      Array.from({ length: 200 }, (_, index) => `large:idle-${index}`),
    );
    expect(result.threads.filter((thread) => thread.status === "active").map((thread) => thread.id).sort()).toEqual(
      Array.from({ length: 8 }, (_, index) => `large:active-${index}`).sort(),
    );

    // The catalog schema rejects an over-cap input rather than scheduling or returning more rows.
    await writeFile(catalogPath, JSON.stringify({ version: 1, threads: [...inactive, ...active, {
      id: "over-cap", title: "Over cap", deepLink: "large://threads/over-cap",
    }] }));
    const overCap = await registry.collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(overCap.threads).toEqual([]);
    expect(overCap.sources).toContainEqual(expect.objectContaining({ id: "large", state: "error", threadCount: 0 }));
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
      detail: "Thread source could not be read. Review its local setup and try again.",
    }));
  });

  it("defaults configured catalogs to HTTPS and rejects dangerous or undeclared schemes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-safe-link-source-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;

    await writeFile(catalogPath, JSON.stringify({
      version: 1,
      threads: [{ id: "https", title: "HTTPS", deepLink: "https://example.test/thread" }],
    }));
    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "safe-agent", name: "Safe", catalog: catalogPath, enabled: true }],
    }));
    const registry = new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath });
    await expect(registry.collect({ codex: false, claude: false, cursor: false, grok: false }))
      .resolves.toMatchObject({ threads: [expect.objectContaining({ allowedDeepLinkSchemes: ["https"] })] });

    await writeFile(catalogPath, JSON.stringify({
      version: 1,
      threads: [{ id: "unsafe", title: "Unsafe", deepLink: " JaVaScRiPt:alert(1)" }],
    }));
    const rejected = await registry.collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(rejected.threads).toEqual([]);
    expect(rejected.sources).toContainEqual(expect.objectContaining({ id: "safe-agent", state: "error" }));
    expect(JSON.stringify(rejected)).not.toContain("alert(1)");

    await writeFile(configPath, JSON.stringify({
      version: 1,
      sources: [{ id: "unsafe-agent", name: "Unsafe", catalog: catalogPath, enabled: true, deepLinkSchemes: ["data"] }],
    }));
    const invalid = await new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath })
      .collect({ codex: false, claude: false, cursor: false, grok: false });
    expect(invalid.sources).toContainEqual(expect.objectContaining({ id: "configured-sources", detail: "Configured source configuration is invalid." }));
  });

  it("rejects reserved or duplicate configured source IDs before any catalog can inject a colliding thread", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-configured-source-id-"));
    temporaryDirectories.push(directory);
    const catalogPath = path.join(directory, "threads.json");
    const configPath = path.join(directory, "sources.json");
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    await writeFile(catalogPath, JSON.stringify({
      version: 1,
      threads: [{ id: "shadow", title: "Injected collision", deepLink: "safe-agent://threads/shadow" }],
    }));
    const source = (id: string) => ({
      id,
      name: `Configured ${id}`,
      catalog: catalogPath,
      enabled: true,
      deepLinkSchemes: ["safe-agent"],
    });
    const invalidConfigurations = [
      ["reserved", ["codex", "claude", "cursor", "grok", "configured-sources"].map(source)],
      ["duplicate", [source("safe-agent"), source("safe-agent")]],
    ] as const;

    for (const [, sources] of invalidConfigurations) {
      await writeFile(configPath, JSON.stringify({ version: 1, sources }));
      const result = await new ThreadSourceRegistry(codexStub, { GAJENDRA_SOURCES_CONFIG: configPath })
        .collect({ codex: false, claude: false, cursor: false, grok: false });
      expect(result.threads).toEqual([]);
      expect(result.sources.filter((status) => status.kind === "configured")).toEqual([
        expect.objectContaining({
          id: "configured-sources",
          state: "error",
          detail: "Configured source configuration is invalid.",
        }),
      ]);
      expect(JSON.stringify(result)).not.toContain("Injected collision");
      expect(JSON.stringify(result)).not.toContain(":shadow");
    }
  });

  it("bounds configured source reads to regular files and reports oversize input without exposing it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-oversized-config-"));
    temporaryDirectories.push(directory);
    const configPath = path.join(directory, "sources.json");
    const hostileValue = "provider-path-and-content-must-not-appear";
    await writeFile(configPath, hostileValue.repeat(4));
    const codexStub = { close: async () => undefined, listThreads: async () => [] } as unknown as CodexAppServerClient;
    const result = await new ThreadSourceRegistry(codexStub, {
      GAJENDRA_SOURCES_CONFIG: configPath,
      GAJENDRA_SOURCES_CONFIG_MAX_BYTES: "32",
    }).collect({ codex: false, claude: false, cursor: false, grok: false });

    expect(result.sources).toContainEqual(expect.objectContaining({
      id: "configured-sources",
      state: "error",
      detail: "Configured source configuration is unavailable.",
    }));
    expect(JSON.stringify(result)).not.toContain(hostileValue);
    expect(JSON.stringify(result)).not.toContain(directory);
  });

  it("selects the true newest Claude and Grok metadata within a bounded measured candidate scan", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gajendra-source-scan-"));
    temporaryDirectories.push(directory);
    const projects = path.join(directory, "projects");
    const claudePaths = await Promise.all([1, 3, 2, 4].map(async (stamp) => {
      const file = path.join(projects, `project-${stamp}`, `session-${stamp}.jsonl`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "{}");
      await utimes(file, stamp, stamp);
      return file;
    }));
    const claudeMeasurement: DiscoveryMeasurement = { directoriesRead: 0, candidateFiles: 0, metadataStats: 0 };
    const newestClaude = await recentClaudeSessionFiles(projects, { candidateLimit: 4, measurement: claudeMeasurement });
    expect(newestClaude).toEqual([claudePaths[3], claudePaths[1], claudePaths[2], claudePaths[0]]);
    expect(claudeMeasurement).toEqual({ directoriesRead: 4, candidateFiles: 4, metadataStats: 4 });
    await expect(recentClaudeSessionFiles(projects, { candidateLimit: 3 })).rejects.toThrow("too many session files");
    const emptyClaudeProjects = path.join(directory, "empty-claude-projects");
    await Promise.all(Array.from({ length: 5 }, (_, index) => mkdir(path.join(emptyClaudeProjects, `project-${index}`), { recursive: true })));
    await expect(recentClaudeSessionFiles(emptyClaudeProjects, { directoryEntryLimit: 4 }))
      .rejects.toThrow("directory catalog exceeded");

    const sessions = path.join(directory, "sessions");
    const grokPaths = await Promise.all([1, 4, 2, 3].map(async (stamp) => {
      const file = path.join(sessions, `workspace-${stamp}`, "session", "summary.json");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "{}");
      await utimes(file, stamp, stamp);
      return file;
    }));
    const grokMeasurement: DiscoveryMeasurement = { directoriesRead: 0, candidateFiles: 0, metadataStats: 0 };
    const newestGrok = await recentGrokSummaryFiles(sessions, { candidateLimit: 4, measurement: grokMeasurement });
    expect(newestGrok).toEqual([grokPaths[1], grokPaths[3], grokPaths[2], grokPaths[0]]);
    expect(grokMeasurement).toEqual({ directoriesRead: 4, candidateFiles: 4, metadataStats: 4 });
    const emptyGrokWorkspaces = path.join(directory, "empty-grok-sessions");
    await Promise.all(Array.from({ length: 5 }, (_, index) => mkdir(path.join(emptyGrokWorkspaces, `workspace-${index}`), { recursive: true })));
    await expect(recentGrokSummaryFiles(emptyGrokWorkspaces, { directoryEntryLimit: 4 }))
      .rejects.toThrow("directory catalog exceeded");
  });
});

function completesWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Local large-catalog test exceeded ${timeoutMs}ms.`)), timeoutMs);
    timeout.unref();
    void operation.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function threadForSource(sourceId: string, id: string, updatedAt: number): AgentThread {
  return {
    id: `${sourceId}:${id}`,
    sourceId,
    sourceName: sourceId,
    title: id,
    project: "fixture",
    updatedAt,
    status: "idle",
    deepLink: `${sourceId}://threads/${id}`,
    allowedDeepLinkSchemes: [sourceId],
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readFileWhenAvailable(filePath: string, timeoutMs = 1_500): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || Date.now() >= deadline) throw error;
      await delay(10);
    }
  }
}
