import { constants, type Dirent } from "node:fs";
import { access, open, opendir, stat } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

import { z } from "zod";

import type {
  AgentThread,
  CodexThread,
  ReviewSignal,
  ResumeCommand,
  SourceState,
  ThreadSourceStatus,
} from "../shared/contracts.js";
import {
  DEFAULT_CONFIGURED_DEEP_LINK_SCHEMES,
  isPermittedDeepLink,
  isRunningThreadStatus,
  MAX_BACKGROUND_THREADS_PER_SOURCE,
} from "../shared/contracts.js";
import { canonicalThreadId } from "./domain.js";
import { CodexAppServerClient } from "./codex-app-server.js";

const MAX_CLAUDE_METADATA_BYTES = 512 * 1024;
const MAX_GROK_METADATA_BYTES = 128 * 1024;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_CURSOR_OUTPUT_BYTES = 2 * 1024 * 1024;
const CURSOR_LIST_TIMEOUT_MS = 10_000;
const PROCESS_KILL_GRACE_MS = 250;
const PROCESS_CLOSE_GRACE_MS = PROCESS_KILL_GRACE_MS;
const DEFAULT_MAX_SOURCES_CONFIG_BYTES = 128 * 1024;
const MAX_CONFIGURABLE_SOURCES_CONFIG_BYTES = 2 * 1024 * 1024;
type OutputChildProcess = Pick<ChildProcess, "pid" | "kill"> & {
  stdout: Readable;
  stderr: Readable;
};
export const MAX_DISCOVERY_CANDIDATES = MAX_BACKGROUND_THREADS_PER_SOURCE * 10;
/** Limits concurrent provider/catalog reads; each configured catalog can itself be up to 2 MiB. */
export const DEFAULT_SOURCE_COLLECTION_CONCURRENCY = 4;
export const MAX_SOURCE_COLLECTION_CONCURRENCY = 8;

export type DiscoveryMeasurement = {
  directoriesRead: number;
  candidateFiles: number;
  metadataStats: number;
};

export type DiscoveryOptions = {
  candidateLimit?: number;
  directoryEntryLimit?: number;
  measurement?: DiscoveryMeasurement;
};

export type ProcessCaptureOptions = {
  outputLimitBytes?: number;
  timeoutMs?: number;
  killGraceMs?: number;
  closeGraceMs?: number;
};

export type GrokReadOptions = {
  /** Deterministic post-open replacement hook used only by the handle-TOCTOU regression. */
  onOpened?: () => Promise<void> | void;
};

export type SourceAdapter = {
  id: string;
  name: string;
  kind: "builtin" | "configured";
  enabledByDefault: boolean;
  listThreads(): Promise<AgentThread[]>;
};

export type SourceAdapterOutcome = {
  threads: AgentThread[];
  status: ThreadSourceStatus;
};

export type SourceCollection = {
  threads: AgentThread[];
  sources: ThreadSourceStatus[];
  error: string | null;
};

export class ThreadSourceRegistry {
  private readonly codex: CodexAppServerClient;
  private readonly sourceCollectionConcurrency: number;

  constructor(
    codex = new CodexAppServerClient(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.codex = codex;
    this.sourceCollectionConcurrency = resolveSourceCollectionConcurrency(this.env.GAJENDRA_SOURCE_COLLECTION_CONCURRENCY);
  }

  async collect(preferences: Record<string, boolean>): Promise<SourceCollection> {
    const configured = await loadConfiguredSources(this.env);
    const adapters: SourceAdapter[] = [
      new CodexThreadSource(this.codex),
      new ClaudeThreadSource(this.env),
      new CursorThreadSource(this.env),
      new GrokThreadSource(this.env),
      ...configured.adapters,
    ];
    const outcomes = await collectSourceAdapters(adapters, preferences, this.sourceCollectionConcurrency);

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

/**
 * Keep provider discovery bounded even when a user configures all supported catalogs. Results
 * retain adapter order so source badges and error rows remain deterministic.
 */
export async function collectSourceAdapters(
  adapters: SourceAdapter[],
  preferences: Record<string, boolean>,
  maxConcurrency = DEFAULT_SOURCE_COLLECTION_CONCURRENCY,
): Promise<SourceAdapterOutcome[]> {
  const concurrency = Math.min(resolveSourceCollectionConcurrency(maxConcurrency), adapters.length);
  const outcomes: SourceAdapterOutcome[] = new Array(adapters.length);
  let nextAdapter = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextAdapter++;
      const adapter = adapters[index];
      if (!adapter) return;
      outcomes[index] = await collectSourceAdapter(adapter, preferences);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return outcomes;
}

async function collectSourceAdapter(
  adapter: SourceAdapter,
  preferences: Record<string, boolean>,
): Promise<SourceAdapterOutcome> {
  const enabled = preferences[adapter.id] ?? adapter.enabledByDefault;
  if (!enabled) {
    return {
      threads: [],
      status: statusFor(adapter, "disabled", false, 0, "Enable this source to include its threads."),
    };
  }
  try {
    const threads = selectSourceThreads(await adapter.listThreads());
    return { threads, status: statusFor(adapter, "ready", true, threads.length, null) };
  } catch (error) {
    const state = error instanceof SourceUnavailableError ? error.state : "error";
    return {
      threads: [],
      status: statusFor(adapter, state, true, 0, readableError(error)),
    };
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

class GrokThreadSource implements SourceAdapter {
  readonly id = "grok";
  readonly name = "Grok Build";
  readonly kind = "builtin" as const;
  readonly enabledByDefault = false;

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async listThreads(): Promise<AgentThread[]> {
    const executable = await resolveExecutable(
      this.env.GAJENDRA_GROK_BIN,
      [path.join(os.homedir(), ".local", "bin", "grok"), "/opt/homebrew/bin/grok", "/usr/local/bin/grok"],
    );
    if (!executable) throw new SourceUnavailableError("not-installed", "Grok Build CLI was not found.");
    const configDirectory = path.resolve(this.env.GAJENDRA_GROK_CONFIG_DIR ?? path.join(os.homedir(), ".grok"));
    const summaryFiles = await recentGrokSummaryFiles(path.join(configDirectory, "sessions"));
    const threads = (await Promise.all(summaryFiles.map((file) => readGrokThreadMetadata(file, executable))))
      .filter(isPresent);
    return threads.sort((left, right) => right.updatedAt - left.updatedAt);
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
    private readonly deepLinkSchemes: string[],
  ) {
    this.enabledByDefault = enabled;
  }

  async listThreads(): Promise<AgentThread[]> {
    let rawCatalog: string;
    try {
      rawCatalog = await readBoundedRegularFile(this.catalogPath, MAX_CATALOG_BYTES);
    } catch (error) {
      if (isMissing(error)) throw new SourceUnavailableError("not-configured", "Configured agent catalog is not available.");
      throw error;
    }
    const catalog = threadCatalogSchema.parse(JSON.parse(rawCatalog) as unknown);
    return catalog.threads.map((thread) => {
      if (thread.deepLink && !isPermittedDeepLink(thread.deepLink, this.deepLinkSchemes)) {
        throw new Error("Configured agent catalog contains a disallowed deep link.");
      }
      const reviewDestination = thread.review
        ? thread.review.destination.type === "thread"
          ? thread.review.destination.deepLink
          : thread.review.destination.url
        : null;
      if (reviewDestination && !isPermittedDeepLink(reviewDestination, this.deepLinkSchemes)) {
        throw new Error("Configured agent catalog contains a disallowed review destination.");
      }
      const id = canonicalThreadId(this.id, thread.id);
      const resumeCommand = thread.resumeCommand ? normalizeResumeCommand(thread.resumeCommand) : undefined;
      const review: ReviewSignal | undefined = thread.review ? {
        state: "ready",
        kind: thread.review.kind,
        updatedAt: normalizeTimestamp(thread.review.updatedAt),
        destination: thread.review.destination,
        providerStatus: thread.review.providerStatus,
      } : undefined;
      const allowedDeepLinkSchemes = [...new Set([
        ...(thread.deepLink ? this.deepLinkSchemes : ["gajendra"]),
        ...(review ? this.deepLinkSchemes : []),
      ])];
      return {
        id,
        sourceId: this.id,
        sourceName: this.name,
        title: cleanTitle(thread.title) || `${this.name} thread ${thread.id.slice(0, 8)}`,
        project: cleanProject(thread.project),
        updatedAt: normalizeTimestamp(thread.updatedAt),
        status: cleanTitle(thread.status) || "unknown",
        deepLink: thread.deepLink || (resumeCommand ? gajendraThreadLink(id) : ""),
        allowedDeepLinkSchemes,
        ...(resumeCommand ? { resumeCommand } : {}),
        ...(review ? { review } : {}),
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
      allowedDeepLinkSchemes: ["gajendra"],
      resumeCommand: { executable, args: [`--resume=${id}`] },
    });
  }
  return rows;
}

export async function recentClaudeSessionFiles(projectsDirectory: string, options: DiscoveryOptions = {}): Promise<string[]> {
  const candidateLimit = positiveCandidateLimit(options.candidateLimit);
  const measurement = options.measurement;
  const directoryBudget = { remaining: positiveDirectoryEntryLimit(options.directoryEntryLimit) };
  let projects;
  try {
    projects = await boundedDirectoryEntries(projectsDirectory, directoryBudget);
  } catch (error) {
    if (isMissing(error)) throw new SourceUnavailableError("not-configured", "Claude Code has no local session directory yet.");
    throw error;
  }
  const files: Array<{ path: string; modifiedAt: number }> = [];
  for (const project of projects) {
    if (!project.isDirectory()) continue;
    const directory = path.join(projectsDirectory, project.name);
    if (measurement) measurement.directoriesRead += 1;
    for (const entry of await boundedDirectoryEntries(directory, directoryBudget)) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      if (measurement) measurement.candidateFiles += 1;
      if (files.length >= candidateLimit) {
        throw new Error("Claude Code has too many session files to inspect safely.");
      }
      const filePath = path.join(directory, entry.name);
      const fileStat = await stat(filePath);
      if (measurement) measurement.metadataStats += 1;
      files.push({ path: filePath, modifiedAt: fileStat.mtimeMs });
    }
  }
  return files.sort((left, right) => right.modifiedAt - left.modifiedAt).slice(0, MAX_BACKGROUND_THREADS_PER_SOURCE).map((file) => file.path);
}

export async function recentGrokSummaryFiles(sessionsDirectory: string, options: DiscoveryOptions = {}): Promise<string[]> {
  const candidateLimit = positiveCandidateLimit(options.candidateLimit);
  const measurement = options.measurement;
  const directoryBudget = { remaining: positiveDirectoryEntryLimit(options.directoryEntryLimit) };
  let workspaces;
  try {
    workspaces = await boundedDirectoryEntries(sessionsDirectory, directoryBudget);
  } catch (error) {
    if (isMissing(error)) throw new SourceUnavailableError("not-configured", "Grok Build has no local session directory yet.");
    throw error;
  }
  const summaries: Array<{ path: string; modifiedAt: number }> = [];
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue;
    const directory = path.join(sessionsDirectory, workspace.name);
    if (measurement) measurement.directoriesRead += 1;
    for (const entry of await boundedDirectoryEntries(directory, directoryBudget)) {
      if (!entry.isDirectory()) continue;
      const summaryPath = path.join(directory, entry.name, "summary.json");
      try {
        const summaryStat = await stat(summaryPath);
        if (!summaryStat.isFile()) continue;
        if (measurement) {
          measurement.candidateFiles += 1;
          measurement.metadataStats += 1;
        }
        if (summaries.length >= candidateLimit) {
          throw new Error("Grok Build has too many session summaries to inspect safely.");
        }
        summaries.push({ path: summaryPath, modifiedAt: summaryStat.mtimeMs });
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
  }
  return summaries
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .slice(0, MAX_BACKGROUND_THREADS_PER_SOURCE)
    .map((summary) => summary.path);
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
      allowedDeepLinkSchemes: ["gajendra"],
      resumeCommand: { executable, args: ["--resume", sessionId], ...(cwd ? { cwd } : {}) },
    };
  } finally {
    await file.close();
  }
}

export async function readGrokThreadMetadata(
  filePath: string,
  executable: string,
  options: GrokReadOptions = {},
): Promise<AgentThread | null> {
  const summary = await readBoundedGrokSummary(filePath, options.onOpened);
  if (!summary) return null;
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(summary.contents) as Record<string, unknown>;
  } catch {
    return null;
  }
  const info = value.info && typeof value.info === "object" ? value.info as Record<string, unknown> : {};
  const sessionId = typeof info.id === "string"
    ? info.id
    : typeof value.session_id === "string"
      ? value.session_id
      : path.basename(path.dirname(filePath));
  if (!sessionId) return null;
  const cwd = typeof info.cwd === "string" ? info.cwd : typeof value.cwd === "string" ? value.cwd : "";
  const generatedTitle = typeof value.generated_title === "string" ? value.generated_title : "";
  const sessionSummary = typeof value.session_summary === "string" ? value.session_summary : "";
  const id = canonicalThreadId("grok", sessionId);
  return {
    id,
    sourceId: "grok",
    sourceName: "Grok Build",
    title: cleanTitle(generatedTitle || sessionSummary) || `Grok session ${sessionId.slice(0, 8)}`,
    project: cleanProject(cwd),
    updatedAt: normalizeTimestamp(value.last_active_at ?? value.updated_at) || summary.modifiedAt / 1000,
    status: "resumable",
    deepLink: gajendraThreadLink(id),
    allowedDeepLinkSchemes: ["gajendra"],
    resumeCommand: { executable, args: ["--resume", sessionId], ...(cwd ? { cwd } : {}) },
  };
}

async function readBoundedGrokSummary(
  filePath: string,
  onOpened: (() => Promise<void> | void) | undefined,
): Promise<{ contents: string; modifiedAt: number } | null> {
  const file = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    // Use fstat from the opened descriptor, not a path stat followed by readFile. The bounded
    // buffer below remains a hard ceiling even if the original inode grows after fstat.
    const metadata = await file.stat();
    if (!metadata.isFile() || metadata.size > MAX_GROK_METADATA_BYTES) return null;
    await onOpened?.();
    const buffer = Buffer.alloc(MAX_GROK_METADATA_BYTES + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > MAX_GROK_METADATA_BYTES) return null;
    return { contents: buffer.subarray(0, offset).toString("utf8"), modifiedAt: metadata.mtimeMs };
  } finally {
    await file.close();
  }
}

function codexThread(thread: CodexThread & { gajendraReview?: ReviewSignal }): AgentThread {
  const id = canonicalThreadId("codex", thread.id);
  const review = thread.gajendraReview;
  return {
    id,
    sourceId: "codex",
    sourceName: "Codex",
    title: cleanTitle(thread.name) || cleanTitle(thread.preview) || "Untitled Codex task",
    project: cleanProject(thread.cwd),
    updatedAt: thread.recencyAt ?? thread.updatedAt ?? 0,
    status: typeof thread.status === "string" ? thread.status : thread.status?.type ?? "unknown",
    deepLink: `codex://threads/${encodeURIComponent(thread.id)}`,
    allowedDeepLinkSchemes: ["codex"],
    ...(review ? { review } : {}),
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
      allowedDeepLinkSchemes: ["gajendra"],
      resumeCommand: { executable, args: [`--resume=${threadId}`], ...(typeof row.cwd === "string" ? { cwd: row.cwd } : {}) },
    }];
  });
}

async function loadConfiguredSources(env: NodeJS.ProcessEnv): Promise<{ adapters: SourceAdapter[]; issue: string | null }> {
  const configPath = resolveSourcesConfigPath(env);
  let raw: string;
  try {
    raw = await readBoundedSourcesConfig(configPath, sourcesConfigByteLimit(env));
  } catch (error) {
    return isMissing(error)
      ? { adapters: [], issue: null }
      : { adapters: [], issue: "Configured source configuration is unavailable." };
  }
  try {
    const config = sourcesConfigSchema.parse(JSON.parse(raw) as unknown);
    const adapters = config.sources.map((source) => new CatalogThreadSource(
      source.id,
      source.name,
      expandHome(source.catalog),
      source.enabled,
      source.deepLinkSchemes ?? [...DEFAULT_CONFIGURED_DEEP_LINK_SCHEMES],
    ));
    return { adapters, issue: null };
  } catch (error) {
    return { adapters: [], issue: "Configured source configuration is invalid." };
  }
}

async function readBoundedSourcesConfig(configPath: string, maxBytes: number): Promise<string> {
  return readBoundedRegularFile(configPath, maxBytes);
}

async function readBoundedRegularFile(filePath: string, maxBytes: number): Promise<string> {
  const file = await open(filePath, "r");
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) throw new Error("Configured source metadata is unavailable.");
    const buffer = Buffer.alloc(maxBytes + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    if (offset > maxBytes) throw new Error("Configured source metadata exceeds its limit.");
    return buffer.subarray(0, offset).toString("utf8");
  } finally {
    await file.close();
  }
}

function sourcesConfigByteLimit(env: NodeJS.ProcessEnv): number {
  const requested = Number(env.GAJENDRA_SOURCES_CONFIG_MAX_BYTES);
  if (!Number.isSafeInteger(requested) || requested <= 0) return DEFAULT_MAX_SOURCES_CONFIG_BYTES;
  return Math.min(requested, MAX_CONFIGURABLE_SOURCES_CONFIG_BYTES);
}

/**
 * Keep the source worker pool at its documented default or higher. A lower override can serialize
 * the default-enabled Cursor pass after the 60.75s Codex envelope and make the derived service
 * deadline false; values above the hard cap remain bounded.
 */
export function resolveSourceCollectionConcurrency(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return DEFAULT_SOURCE_COLLECTION_CONCURRENCY;
  return Math.min(Math.max(parsed, DEFAULT_SOURCE_COLLECTION_CONCURRENCY), MAX_SOURCE_COLLECTION_CONCURRENCY);
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

export function collectProcessOutput(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  options: ProcessCaptureOptions = {},
): Promise<string> {
  const outputLimitBytes = positiveProcessBound(options.outputLimitBytes, MAX_CURSOR_OUTPUT_BYTES);
  const timeoutMs = positiveProcessBound(options.timeoutMs, CURSOR_LIST_TIMEOUT_MS);
  const killGraceMs = positiveProcessBound(options.killGraceMs, PROCESS_KILL_GRACE_MS);
  const closeGraceMs = positiveProcessBound(options.closeGraceMs, PROCESS_CLOSE_GRACE_MS);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
      // On POSIX this gives the provider and every inherited-pipe descendant its own process
      // group, so a timeout cannot leave a grandchild holding stdout/stderr open forever.
      detached: supportsProcessGroupSignals(),
    });
    const chunks: Buffer[] = [];
    let capturedBytes = 0;
    let captureOpen = true;
    let settled = false;
    let exited = false;
    let terminationError: Error | null = null;
    let timeout: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    let closeTimer: NodeJS.Timeout | null = null;
    let postKillCloseTimer: NodeJS.Timeout | null = null;
    let onStdout: (chunk: Buffer | string) => void = () => undefined;
    const clearTimers = () => {
      if (timeout) clearTimeout(timeout);
      timeout = null;
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = null;
      if (postKillCloseTimer) clearTimeout(postKillCloseTimer);
      postKillCloseTimer = null;
    };
    const stopCapture = () => {
      if (!captureOpen) return;
      captureOpen = false;
      child.stdout.off("data", onStdout);
      child.stdout.resume();
      child.stderr.resume();
    };
    const settle = (error: Error | null, value = "") => {
      if (settled) return;
      settled = true;
      clearTimers();
      stopCapture();
      if (error) reject(error);
      else resolve(value);
    };
    const terminate = (error: Error) => {
      if (settled || terminationError) return;
      terminationError = error;
      stopCapture();
      signalProcessGroup(child, "SIGTERM");
      killTimer = setTimeout(() => {
        if (exited) return;
        signalProcessGroup(child, "SIGKILL");
      }, killGraceMs);
      killTimer.unref();
    };
    const startCloseWatchdog = () => {
      if (settled || closeTimer) return;
      closeTimer = setTimeout(() => {
        const error = terminationError ?? new Error("Cursor session listing did not close its output streams.");
        terminationError = error;
        // The direct child may already have exited while a descendant still owns its inherited
        // pipes. Kill the group once more, then give close the existing kill grace to report
        // final pipe teardown before resorting to local-handle destruction.
        signalProcessGroup(child, "SIGKILL");
        closeTimer = null;
        postKillCloseTimer = setTimeout(() => {
          // A platform or hostile descendant may still retain an inherited descriptor after the
          // bounded group-KILL grace. Never let that keep the caller pending indefinitely.
          stopCapture();
          destroyLocalPipes(child);
          settle(error);
        }, killGraceMs);
        postKillCloseTimer.unref();
      }, closeGraceMs);
      closeTimer.unref();
    };
    onStdout = (chunk: Buffer | string) => {
      if (!captureOpen) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = outputLimitBytes - capturedBytes;
      if (bytes.length > remaining) {
        if (remaining > 0) {
          chunks.push(bytes.subarray(0, remaining));
          capturedBytes += remaining;
        }
        terminate(new Error("Cursor session catalog exceeded the output limit."));
        return;
      }
      chunks.push(bytes);
      capturedBytes += bytes.length;
    };
    timeout = setTimeout(() => terminate(new Error("Cursor session listing timed out.")), timeoutMs);
    timeout.unref();
    child.stdout.on("data", onStdout);
    // Drain provider stderr without retaining or exposing provider-controlled content.
    child.stderr.on("data", () => undefined);
    child.once("error", (error) => {
      if (!terminationError) terminationError = error;
      clearTimers();
      startCloseWatchdog();
    });
    child.once("exit", () => {
      exited = true;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (killTimer) clearTimeout(killTimer);
      killTimer = null;
      // A direct child can exit while a forked descendant retains inherited stdout/stderr. Give
      // close a bounded grace period, then tear down local pipes and return a safe failure. The
      // dedicated POSIX group gets TERM now and KILL from the watchdog if it still owns a pipe.
      signalProcessGroup(child, "SIGTERM");
      startCloseWatchdog();
    });
    // exit only says the child stopped running. close follows after both pipes are closed, so it
    // is the first point at which final stdout is complete and a TERM-resistant child is gone.
    child.once("close", (code, signal) => {
      if (terminationError) {
        settle(terminationError);
      } else if (code === 0) {
        settle(null, Buffer.concat(chunks, capturedBytes).toString("utf8"));
      } else {
        settle(new Error(`Cursor session listing failed (${signal ?? code ?? "unknown"}).`));
      }
    });
  });
}

function positiveProcessBound(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** Windows has no portable negative-PID process-group signal equivalent. The pipe watchdog below
 * still bounds the caller there; POSIX additionally reaps descendants which inherited our pipes. */
function supportsProcessGroupSignals(): boolean {
  return process.platform !== "win32";
}

function signalProcessGroup(child: OutputChildProcess, signal: NodeJS.Signals): void {
  if (supportsProcessGroupSignals() && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The group leader may have exited already. Fall through to the direct child where present.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Exit/close or the watchdog settle the operation safely.
  }
}

function destroyLocalPipes(child: OutputChildProcess): void {
  child.stdout.destroy();
  child.stderr.destroy();
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

export function selectSourceThreads(threads: AgentThread[]): AgentThread[] {
  const ordered = [...threads].sort((left, right) => right.updatedAt - left.updatedAt);
  const running = ordered.filter((thread) => isRunningThreadStatus(thread.status));
  const reviewReady = ordered.filter((thread) => !isRunningThreadStatus(thread.status) && thread.review?.state === "ready");
  const background = ordered
    .filter((thread) => !isRunningThreadStatus(thread.status) && thread.review?.state !== "ready")
    .slice(0, MAX_BACKGROUND_THREADS_PER_SOURCE);
  return [...running, ...reviewReady, ...background].sort((left, right) => right.updatedAt - left.updatedAt);
}

function readableError(error: unknown): string {
  if (error instanceof SourceUnavailableError) return error.message;
  return "Thread source could not be read. Review its local setup and try again.";
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

const reviewDestinationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("thread"),
    deepLink: z.string().min(1).max(2_048).url(),
  }).strict(),
  z.object({
    type: z.literal("url"),
    url: z.string().min(1).max(2_048).url(),
  }).strict(),
]);

const reviewSignalSchema = z.object({
  state: z.literal("ready"),
  kind: z.enum(["result", "diff", "pull-request"]),
  updatedAt: z.union([z.number().positive().finite(), z.string().min(1)]).refine(
    (value) => normalizeTimestamp(value) > 0,
    "Review updatedAt must be a valid timestamp.",
  ),
  destination: reviewDestinationSchema,
  providerStatus: z.string().min(1).max(80).refine(
    (value) => cleanTitle(value) === value,
    "Review providerStatus must be one bounded line.",
  ),
}).strict();

const catalogThreadSchema = z.object({
  id: z.string().min(1).max(300),
  title: z.string().max(500),
  project: z.string().max(500).default(""),
  updatedAt: z.union([z.number(), z.string()]).optional(),
  status: z.string().max(80).default("unknown"),
  deepLink: z.string().url().optional(),
  resumeCommand: resumeCommandSchema.optional(),
  review: reviewSignalSchema.optional(),
}).refine((thread) => Boolean(thread.deepLink || thread.resumeCommand), {
  message: "A configured thread must declare deepLink or resumeCommand.",
});

const threadCatalogSchema = z.object({
  version: z.literal(1),
  threads: z.array(catalogThreadSchema).max(2_000),
});

const RESERVED_SOURCE_IDS = new Set(["codex", "claude", "cursor", "grok", "configured-sources"]);
const configuredSourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}$/u),
  name: z.string().min(1).max(80),
  catalog: z.string().min(1),
  enabled: z.boolean().default(true),
  deepLinkSchemes: z.array(z.string().regex(/^[a-z][a-z0-9+.-]{0,31}$/iu).refine(
    (scheme) => !["javascript", "data", "file"].includes(scheme.toLowerCase()),
    "Unsafe deep-link scheme.",
  )).min(1).max(8).optional(),
});

const sourcesConfigSchema = z.object({
  version: z.literal(1),
  sources: z.array(configuredSourceSchema).max(32),
}).superRefine((config, context) => {
  const seen = new Set<string>();
  config.sources.forEach((source, index) => {
    if (RESERVED_SOURCE_IDS.has(source.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sources", index, "id"], message: "Configured source ID is reserved." });
    }
    if (seen.has(source.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sources", index, "id"], message: "Configured source IDs must be unique." });
    }
    seen.add(source.id);
  });
});

function positiveCandidateLimit(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : MAX_DISCOVERY_CANDIDATES;
}

function positiveDirectoryEntryLimit(value: number | undefined): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : MAX_DISCOVERY_CANDIDATES;
}

async function boundedDirectoryEntries(directoryPath: string, budget: { remaining: number }) {
  const entries: Dirent[] = [];
  const directory = await opendir(directoryPath);
  for await (const entry of directory) {
    if (budget.remaining <= 0) throw new Error("Thread source directory catalog exceeded the safe scan limit.");
    budget.remaining -= 1;
    entries.push(entry);
  }
  return entries;
}
