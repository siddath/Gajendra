import { constants } from "node:fs";
import { access, open, readdir, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import { z } from "zod";

import type {
  AgentThread,
  CodexThread,
  ResumeCommand,
  SourceState,
  ThreadSourceStatus,
} from "../shared/contracts.js";
import { canonicalThreadId } from "./domain.js";
import { CodexAppServerClient } from "./codex-app-server.js";

const MAX_THREADS_PER_SOURCE = 200;
const MAX_CLAUDE_METADATA_BYTES = 512 * 1024;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CURSOR_OUTPUT_BYTES = 2 * 1024 * 1024;

type SourceAdapter = {
  id: string;
  name: string;
  kind: "builtin" | "configured";
  enabledByDefault: boolean;
  listThreads(): Promise<AgentThread[]>;
};

export type SourceCollection = {
  threads: AgentThread[];
  sources: ThreadSourceStatus[];
  error: string | null;
};

export class ThreadSourceRegistry {
  private readonly codex: CodexAppServerClient;

  constructor(
    codex = new CodexAppServerClient(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.codex = codex;
  }

  async collect(preferences: Record<string, boolean>): Promise<SourceCollection> {
    const configured = await loadConfiguredSources(this.env);
    const adapters: SourceAdapter[] = [
      new CodexThreadSource(this.codex),
      new ClaudeThreadSource(this.env),
      new CursorThreadSource(this.env),
      ...configured.adapters,
    ];
    const outcomes = await Promise.all(adapters.map(async (adapter) => {
      const enabled = preferences[adapter.id] ?? adapter.enabledByDefault;
      if (!enabled) return {
        threads: [] as AgentThread[],
        status: statusFor(adapter, "disabled", false, 0, "Enable this source to include its threads."),
      };
      try {
        const threads = (await adapter.listThreads()).slice(0, MAX_THREADS_PER_SOURCE);
        return { threads, status: statusFor(adapter, "ready", true, threads.length, null) };
      } catch (error) {
        const state = error instanceof SourceUnavailableError ? error.state : "error";
        return {
          threads: [] as AgentThread[],
          status: statusFor(adapter, state, true, 0, readableError(error)),
        };
      }
    }));

    const sources = outcomes.map(({ status }) => status);
    if (configured.issue) {
      sources.push({
        id: "configured-sources",
        name: "Configured agents",
        kind: "configured",
        state: "error",
        enabled: true,
        threadCount: 0,
        detail: configured.issue,
      });
    }
    const threads = deduplicate(outcomes.flatMap(({ threads: sourceThreads }) => sourceThreads));
    const enabled = sources.filter((source) => source.enabled);
    const error = enabled.length > 0 && enabled.every((source) => source.state !== "ready")
      ? "No configured thread source is currently available."
      : null;
    return { threads, sources, error };
  }

  close(): Promise<void> {
    return this.codex.close();
  }
}

class CodexThreadSource implements SourceAdapter {
  readonly id = "codex";
  readonly name = "Codex";
  readonly kind = "builtin" as const;
  readonly enabledByDefault = true;

  constructor(private readonly client: CodexAppServerClient) {}

  async listThreads(): Promise<AgentThread[]> {
    return (await this.client.listThreads()).map((thread) => codexThread(thread));
  }
}

class ClaudeThreadSource implements SourceAdapter {
  readonly id = "claude";
  readonly name = "Claude Code";
  readonly kind = "builtin" as const;
  readonly enabledByDefault = false;

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async listThreads(): Promise<AgentThread[]> {
    const executable = await resolveExecutable(
      this.env.GAJENDRA_CLAUDE_BIN,
      [path.join(os.homedir(), ".local", "bin", "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"],
    );
    if (!executable) throw new SourceUnavailableError("not-installed", "Claude Code CLI was not found.");
    const configDirectory = path.resolve(this.env.GAJENDRA_CLAUDE_CONFIG_DIR ?? this.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude"));
    const projectsDirectory = path.join(configDirectory, "projects");
    const files = await recentClaudeSessionFiles(projectsDirectory);
    const threads = (await Promise.all(files.map((file) => readClaudeThreadMetadata(file, executable))))
      .filter(isPresent);
    return threads.sort((left, right) => right.updatedAt - left.updatedAt);
  }
}

class CursorThreadSource implements SourceAdapter {
  readonly id = "cursor";
  readonly name = "Cursor";
  readonly kind = "builtin" as const;
  readonly enabledByDefault = true;

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async listThreads(): Promise<AgentThread[]> {
    const executable = await resolveExecutable(
      this.env.GAJENDRA_CURSOR_BIN,
      [path.join(os.homedir(), ".local", "bin", "cursor-agent"), "/opt/homebrew/bin/cursor-agent", "/usr/local/bin/cursor-agent"],
    );
    if (!executable) throw new SourceUnavailableError("not-installed", "Cursor Agent CLI was not found.");
    return parseCursorSessionList(await collectProcessOutput(executable, ["ls"], this.env), executable);
  }
}

class CatalogThreadSource implements SourceAdapter {
  readonly kind = "configured" as const;
  readonly enabledByDefault: boolean;

  constructor(
    readonly id: string,
    readonly name: string,
    private readonly catalogPath: string,
    enabled: boolean,
  ) {
    this.enabledByDefault = enabled;
  }

  async listThreads(): Promise<AgentThread[]> {
    const catalogStat = await stat(this.catalogPath).catch((error: unknown) => {
      if (isMissing(error)) throw new SourceUnavailableError("not-configured", `Catalog not found: ${this.catalogPath}`);
      throw error;
    });
    if (catalogStat.size > MAX_CATALOG_BYTES) throw new Error(`Catalog exceeds ${MAX_CATALOG_BYTES} bytes.`);
    const catalog = threadCatalogSchema.parse(JSON.parse(await readFile(this.catalogPath, "utf8")) as unknown);
    return catalog.threads.map((thread) => {
      const id = canonicalThreadId(this.id, thread.id);
      const resumeCommand = thread.resumeCommand ? normalizeResumeCommand(thread.resumeCommand) : undefined;
      return {
        id,
        sourceId: this.id,
        sourceName: this.name,
        title: cleanTitle(thread.title) || `${this.name} thread ${thread.id.slice(0, 8)}`,
        project: cleanProject(thread.project),
        updatedAt: normalizeTimestamp(thread.updatedAt),
        status: cleanTitle(thread.status) || "unknown",
        deepLink: thread.deepLink || (resumeCommand ? gajendraThreadLink(id) : ""),
        ...(resumeCommand ? { resumeCommand } : {}),
      };
    });
  }
}

export function parseCursorSessionList(output: string, executable = "cursor-agent"): AgentThread[] {
  const trimmed = output.trim();
  if (!trimmed) return [];
  const jsonThreads = parseCursorJson(trimmed, executable);
  if (jsonThreads) return jsonThreads;

  const rows: AgentThread[] = [];
  for (const rawLine of trimmed.split(/\r?\n/u)) {
    const line = rawLine.replace(/\u001B\[[0-9;]*m/gu, "").trim();
    const id = line.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/iu)?.[0];
    if (!id) continue;
    const remainder = line.replace(id, " ").replace(/[|│•]+/gu, " ").replace(/\s+/gu, " ").trim();
    const title = cleanTitle(remainder.replace(/^[-–—\s]+/u, "")) || `Cursor chat ${id.slice(0, 8)}`;
    const canonicalId = canonicalThreadId("cursor", id);
    rows.push({
      id: canonicalId,
      sourceId: "cursor",
      sourceName: "Cursor",
      title,
      project: "Cursor",
      updatedAt: parseTimestampFromText(line),
      status: "resumable",
      deepLink: gajendraThreadLink(canonicalId),
      resumeCommand: { executable, args: [`--resume=${id}`] },
    });
  }
  return rows;
}

async function recentClaudeSessionFiles(projectsDirectory: string): Promise<string[]> {
  let projects;
  try {
    projects = await readdir(projectsDirectory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) throw new SourceUnavailableError("not-configured", "Claude Code has no local session directory yet.");
    throw error;
  }
  const files: Array<{ path: string; modifiedAt: number }> = [];
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const directory = path.join(projectsDirectory, project.name);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const filePath = path.join(directory, entry.name);
      const fileStat = await stat(filePath);
      files.push({ path: filePath, modifiedAt: fileStat.mtimeMs });
    }
  }
  return files.sort((left, right) => right.modifiedAt - left.modifiedAt).slice(0, MAX_THREADS_PER_SOURCE).map((file) => file.path);
}

export async function readClaudeThreadMetadata(filePath: string, executable: string): Promise<AgentThread | null> {
  const fileStat = await stat(filePath);
  const file = await open(filePath, "r");
  try {
    const length = Math.min(fileStat.size, MAX_CLAUDE_METADATA_BYTES);
    const buffer = Buffer.alloc(length);
    await file.read(buffer, 0, length, 0);
    let sessionId = path.basename(filePath, ".jsonl");
    let cwd = "";
    let title = "";
    let slug = "";
    let timestamp = fileStat.mtimeMs / 1000;
    for (const line of buffer.toString("utf8").split(/\r?\n/u)) {
      if (!line.trim()) continue;
      let value: Record<string, unknown>;
      try {
        value = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (typeof value.sessionId === "string") sessionId = value.sessionId;
      if (typeof value.cwd === "string") cwd = value.cwd;
      if (typeof value.aiTitle === "string") title = value.aiTitle;
      if (typeof value.slug === "string" && !slug) slug = value.slug;
      if (typeof value.timestamp === "string") timestamp = normalizeTimestamp(value.timestamp) || timestamp;
    }
    if (!sessionId) return null;
    const id = canonicalThreadId("claude", sessionId);
    return {
      id,
      sourceId: "claude",
      sourceName: "Claude Code",
      title: cleanTitle(title || slug.replace(/-/gu, " ")) || `Claude session ${sessionId.slice(0, 8)}`,
      project: cleanProject(cwd),
      updatedAt: timestamp,
      status: "resumable",
      deepLink: gajendraThreadLink(id),
      resumeCommand: { executable, args: ["--resume", sessionId], ...(cwd ? { cwd } : {}) },
    };
  } finally {
    await file.close();
  }
}

function codexThread(thread: CodexThread): AgentThread {
  const id = canonicalThreadId("codex", thread.id);
  return {
    id,
    sourceId: "codex",
    sourceName: "Codex",
    title: cleanTitle(thread.name) || cleanTitle(thread.preview) || "Untitled Codex task",
    project: cleanProject(thread.cwd),
    updatedAt: thread.recencyAt ?? thread.updatedAt ?? 0,
    status: typeof thread.status === "string" ? thread.status : thread.status?.type ?? "unknown",
    deepLink: `codex://threads/${encodeURIComponent(thread.id)}`,
  };
}

function parseCursorJson(output: string, executable: string): AgentThread[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output) as unknown;
  } catch {
    return null;
  }
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { sessions?: unknown[] }).sessions)
      ? (parsed as { sessions: unknown[] }).sessions
      : null;
  if (!candidates) return null;
  return candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    const threadId = [row.id, row.chatId, row.sessionId].find((value) => typeof value === "string");
    if (typeof threadId !== "string") return [];
    const id = canonicalThreadId("cursor", threadId);
    return [{
      id,
      sourceId: "cursor",
      sourceName: "Cursor",
      title: cleanTitle(String(row.name ?? row.title ?? "")) || `Cursor chat ${threadId.slice(0, 8)}`,
      project: cleanProject(typeof row.cwd === "string" ? row.cwd : typeof row.project === "string" ? row.project : ""),
      updatedAt: normalizeTimestamp(row.updatedAt ?? row.createdAt),
      status: cleanTitle(typeof row.status === "string" ? row.status : "resumable") || "resumable",
      deepLink: gajendraThreadLink(id),
      resumeCommand: { executable, args: [`--resume=${threadId}`], ...(typeof row.cwd === "string" ? { cwd: row.cwd } : {}) },
    }];
  });
}

async function loadConfiguredSources(env: NodeJS.ProcessEnv): Promise<{ adapters: SourceAdapter[]; issue: string | null }> {
  const configPath = resolveSourcesConfigPath(env);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    return isMissing(error) ? { adapters: [], issue: null } : { adapters: [], issue: readableError(error) };
  }
  try {
    const config = sourcesConfigSchema.parse(JSON.parse(raw) as unknown);
    const adapters = config.sources.map((source) => new CatalogThreadSource(
      source.id,
      source.name,
      expandHome(source.catalog),
      source.enabled,
    ));
    return { adapters, issue: null };
  } catch (error) {
    return { adapters: [], issue: `Invalid source configuration at ${configPath}: ${readableError(error)}` };
  }
}

export function resolveSourcesConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GAJENDRA_SOURCES_CONFIG) return path.resolve(env.GAJENDRA_SOURCES_CONFIG);
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Gajendra", "sources.json");
  const configHome = env.XDG_CONFIG_HOME ? path.resolve(env.XDG_CONFIG_HOME) : path.join(os.homedir(), ".config");
  return path.join(configHome, "gajendra", "sources.json");
}

function statusFor(
  adapter: SourceAdapter,
  state: SourceState,
  enabled: boolean,
  threadCount: number,
  detail: string | null,
): ThreadSourceStatus {
  return { id: adapter.id, name: adapter.name, kind: adapter.kind, state, enabled, threadCount, detail };
}

async function resolveExecutable(explicit: string | undefined, candidates: string[]): Promise<string | null> {
  const paths = explicit ? [path.resolve(explicit), ...candidates] : candidates;
  for (const candidate of paths) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function collectProcessOutput(executable: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${path.basename(executable)} ${args.join(" ")} timed out.`));
    }, 10_000);
    timeout.unref();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (Buffer.byteLength(stdout) > MAX_CURSOR_OUTPUT_BYTES) child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-2000); });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (Buffer.byteLength(stdout) > MAX_CURSOR_OUTPUT_BYTES) {
        reject(new Error("Cursor session catalog exceeded the output limit."));
      } else if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Cursor session listing failed (${signal ?? code ?? "unknown"})${stderr.trim() ? `: ${stderr.trim()}` : ""}`));
      }
    });
  });
}

function cleanTitle(value: string | null | undefined): string {
  if (!value) return "";
  const firstLine = value.split(/\r?\n/u).find((line) => line.trim()) ?? "";
  return firstLine.replace(/[\u0000-\u001F\u007F]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, 140);
}

function cleanProject(value: string | null | undefined): string {
  if (!value) return "No project";
  return cleanTitle(path.basename(value) || value) || "No project";
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value > 10_000_000_000 ? value / 1000 : value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : 0;
  }
  return 0;
}

function parseTimestampFromText(value: string): number {
  const match = value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?/u)?.[0];
  return match ? normalizeTimestamp(match) : 0;
}

function normalizeResumeCommand(command: z.infer<typeof resumeCommandSchema>): ResumeCommand {
  return { executable: command.executable, args: command.args, ...(command.cwd ? { cwd: command.cwd } : {}) };
}

function gajendraThreadLink(threadId: string): string {
  return `gajendra://thread/${encodeURIComponent(threadId)}`;
}

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

function deduplicate(threads: AgentThread[]): AgentThread[] {
  const seen = new Set<string>();
  return threads.filter((thread) => {
    if (seen.has(thread.id)) return false;
    seen.add(thread.id);
    return true;
  });
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Thread source failed.";
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

class SourceUnavailableError extends Error {
  constructor(readonly state: Extract<SourceState, "not-installed" | "not-configured">, message: string) {
    super(message);
  }
}

const resumeCommandSchema = z.object({
  executable: z.string().min(1),
  args: z.array(z.string()).max(24).default([]),
  cwd: z.string().min(1).optional(),
});

const catalogThreadSchema = z.object({
  id: z.string().min(1).max(300),
  title: z.string().max(500),
  project: z.string().max(500).default(""),
  updatedAt: z.union([z.number(), z.string()]).optional(),
  status: z.string().max(80).default("unknown"),
  deepLink: z.string().url().optional(),
  resumeCommand: resumeCommandSchema.optional(),
}).refine((thread) => Boolean(thread.deepLink || thread.resumeCommand), {
  message: "A configured thread must declare deepLink or resumeCommand.",
});

const threadCatalogSchema = z.object({
  version: z.literal(1),
  threads: z.array(catalogThreadSchema).max(2_000),
});

const sourcesConfigSchema = z.object({
  version: z.literal(1),
  sources: z.array(z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}$/u),
    name: z.string().min(1).max(80),
    catalog: z.string().min(1),
    enabled: z.boolean().default(true),
  })).max(32),
});
