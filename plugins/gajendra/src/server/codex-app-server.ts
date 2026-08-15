import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { open, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import type { CodexThread } from "../shared/contracts.js";

type JsonRpcResponse = { id: number; result?: unknown; error?: { code?: number; message?: string } };

const MAX_ROLLOUT_TAIL_BYTES = 256 * 1024;
const LSOF_TIMEOUT_MS = 2_000;

export class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout }
  >();
  private ready: Promise<void> | null = null;
  private stderrTail = "";

  constructor(
    private readonly requestTimeoutMs = resolveRpcTimeout(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async listThreads(): Promise<CodexThread[]> {
    await this.ensureReady();
    const all: CodexThread[] = [];
    let cursor: string | null = null;
    const seenCursors = new Set<string>();

    do {
      const response = (await this.request("thread/list", {
        cursor,
        limit: 100,
        sortKey: "recency_at",
        sortDirection: "desc",
        archived: false,
      })) as { data?: CodexThread[]; nextCursor?: string | null };
      all.push(...(response.data ?? []));
      const next = response.nextCursor ?? null;
      if (next && seenCursors.has(next)) throw new Error("Codex app-server repeated a pagination cursor.");
      if (next) seenCursors.add(next);
      cursor = next;
    } while (cursor);

    return enrichCodexRuntimeStatuses(all, this.env);
  }

  async close(): Promise<void> {
    const active = this.process;
    this.process = null;
    this.ready = null;
    if (!active || active.killed) return;
    active.kill("SIGTERM");
  }

  private ensureReady(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = this.start();
    return this.ready;
  }

  private async start(): Promise<void> {
    const executable = process.env.GAJENDRA_CODEX_BIN
      || process.env.AADI_CODEX_BIN
      || process.env.PRIORITY_DECK_CODEX_BIN
      || "codex";
    const child = spawn(executable, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    this.process = child;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-2000);
    });
    child.once("exit", (code, signal) => {
      const detail = this.stderrTail.trim();
      const error = new Error(
        `Codex app-server exited (${signal ?? code ?? "unknown"})${detail ? `: ${detail}` : ""}`,
      );
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
      if (this.process === child) {
        this.process = null;
        this.ready = null;
      }
    });
    child.once("error", (error) => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
    });

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => this.acceptLine(line));

    await this.request("initialize", {
      clientInfo: { name: "gajendra", title: "Gaja, Elephant Focus for AI Power Users", version: "0.3.1" },
      capabilities: null,
    });
    this.notify("initialized", {});
  }

  private acceptLine(line: string): void {
    if (!line.trim()) return;
    let message: JsonRpcResponse;
    try {
      message = JSON.parse(line) as JsonRpcResponse;
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) {
      pending.reject(new Error(message.error.message || `Codex app-server error ${message.error.code ?? "unknown"}`));
    } else {
      pending.resolve(message.result);
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const active = this.process;
    if (!active) return Promise.reject(new Error("Codex app-server is not running."));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request '${method}' timed out after ${this.requestTimeoutMs}ms.`));
      }, this.requestTimeoutMs);
      timeout.unref();
      this.pending.set(id, { resolve, reject, timeout });
      active.stdin.write(`${JSON.stringify({ method, id, params })}\n`, (error) => {
        if (!error) return;
        this.pending.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private notify(method: string, params: unknown): void {
    this.process?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }
}

export async function enrichCodexRuntimeStatuses(
  threads: CodexThread[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<CodexThread[]> {
  if (threads.every((thread) => codexStatusType(thread.status) === "active")) return threads;
  const codexHome = path.resolve(env.CODEX_HOME ?? path.join(os.homedir(), ".codex"));
  const lockDirectory = path.join(codexHome, "thread-writer-locks");
  let heldThreadIds: Set<string>;
  try {
    heldThreadIds = heldCodexThreadIds(await listOpenFiles(lockDirectory, env), lockDirectory);
  } catch {
    return threads;
  }
  if (heldThreadIds.size === 0) return threads;

  const activeThreadIds = new Set<string>();
  await Promise.all(threads.map(async (thread) => {
    if (codexStatusType(thread.status) === "active") {
      activeThreadIds.add(thread.id);
      return;
    }
    if (!heldThreadIds.has(thread.id) || !thread.path || !isCodexRolloutPath(thread.path, codexHome)) return;
    try {
      const tail = await readRolloutTail(thread.path);
      if (rolloutTailShowsActiveTurn(tail.text, tail.truncated)) activeThreadIds.add(thread.id);
    } catch {
      // Runtime enrichment is best effort. The app-server status remains the fallback.
    }
  }));

  return threads.map((thread) => activeThreadIds.has(thread.id)
    ? { ...thread, status: { type: "active" } }
    : thread);
}

export function heldCodexThreadIds(output: string, lockDirectory: string): Set<string> {
  const normalizedDirectory = `${path.resolve(lockDirectory)}${path.sep}`;
  const ids = new Set<string>();
  for (const line of output.split(/\r?\n/u)) {
    if (!line.startsWith("n")) continue;
    const filePath = path.resolve(line.slice(1));
    if (!filePath.startsWith(normalizedDirectory) || path.extname(filePath) !== ".lock") continue;
    const id = path.basename(filePath, ".lock");
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/iu.test(id)) ids.add(id);
  }
  return ids;
}

export function rolloutTailShowsActiveTurn(tail: string, truncated = false): boolean {
  const lines = tail.split(/\r?\n/u);
  if (truncated) lines.shift();
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line) continue;
    let event: { type?: unknown; payload?: { type?: unknown } };
    try {
      event = JSON.parse(line) as { type?: unknown; payload?: { type?: unknown } };
    } catch {
      continue;
    }
    if (event.type === "event_msg" && event.payload?.type === "task_complete") return false;
    if (event.type === "session_meta") return false;
    if (event.type === "turn_context" || event.type === "response_item" || event.type === "event_msg" || event.type === "inter_agent_communication_metadata") {
      return true;
    }
  }
  return false;
}

function codexStatusType(status: CodexThread["status"]): string {
  return typeof status === "string" ? status : status?.type ?? "unknown";
}

function isCodexRolloutPath(filePath: string, codexHome: string): boolean {
  const resolved = path.resolve(filePath);
  const sessions = `${path.join(codexHome, "sessions")}${path.sep}`;
  return resolved.startsWith(sessions) && resolved.endsWith(".jsonl");
}

async function readRolloutTail(filePath: string): Promise<{ text: string; truncated: boolean }> {
  const fileStat = await stat(filePath);
  const length = Math.min(fileStat.size, MAX_ROLLOUT_TAIL_BYTES);
  const truncated = fileStat.size > length;
  const buffer = Buffer.alloc(length);
  const file = await open(filePath, "r");
  try {
    await file.read(buffer, 0, length, fileStat.size - length);
    return { text: buffer.toString("utf8"), truncated };
  } finally {
    await file.close();
  }
}

function listOpenFiles(lockDirectory: string, env: NodeJS.ProcessEnv): Promise<string> {
  const executable = env.GAJENDRA_LSOF_BIN ?? "/usr/sbin/lsof";
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-Fn", "+D", lockDirectory], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (error: Error | null, value = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`lsof timed out after ${LSOF_TIMEOUT_MS}ms.`));
    }, LSOF_TIMEOUT_MS);
    timeout.unref();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout = `${stdout}${chunk}`.slice(-512 * 1024); });
    child.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-2_000); });
    child.once("error", (error) => finish(error));
    child.once("exit", (code) => {
      if (code === 0 || code === 1) finish(null, stdout);
      else finish(new Error(stderr.trim() || `lsof exited with status ${code ?? "unknown"}.`));
    });
  });
}

export function resolveRpcTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.GAJENDRA_RPC_TIMEOUT_MS ?? env.AADI_RPC_TIMEOUT_MS ?? env.PRIORITY_DECK_RPC_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 15_000;
}
