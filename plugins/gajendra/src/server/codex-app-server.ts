import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import type { CodexThread } from "../shared/contracts.js";

type JsonRpcResponse = { id: number; result?: unknown; error?: { code?: number; message?: string } };

export class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout }
  >();
  private ready: Promise<void> | null = null;
  private stderrTail = "";

  constructor(private readonly requestTimeoutMs = resolveRpcTimeout()) {}

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

    return all;
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

export function resolveRpcTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.GAJENDRA_RPC_TIMEOUT_MS ?? env.AADI_RPC_TIMEOUT_MS ?? env.PRIORITY_DECK_RPC_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 15_000;
}
