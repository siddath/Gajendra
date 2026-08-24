import { spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  isRunningThreadStatus,
  MAX_BACKGROUND_THREADS_PER_SOURCE,
  type CodexThread,
  type ReviewSignal,
} from "../shared/contracts.js";

type JsonRpcResponse = { id: number; result?: unknown; error?: { code?: number; message?: string } };
type OutputChildProcess = Pick<ChildProcess, "pid" | "kill"> & {
  stdout: Readable;
  stderr: Readable;
};
type AppServerLifecycle = {
  child: ChildProcessWithoutNullStreams;
  closed: Promise<void>;
  resolveClosed: () => void;
  closing: boolean;
  finished: boolean;
  exited: boolean;
  terminationError: Error | null;
  killTimer: NodeJS.Timeout | null;
  closeTimer: NodeJS.Timeout | null;
  postKillCloseTimer: NodeJS.Timeout | null;
};

const MAX_ROLLOUT_TAIL_BYTES = 256 * 1024;
const LSOF_TIMEOUT_MS = 2_000;
const LSOF_KILL_GRACE_MS = 250;
const LSOF_CLOSE_GRACE_MS = LSOF_KILL_GRACE_MS;
const MAX_LSOF_OUTPUT_BYTES = 512 * 1024;
// The primary app-server uses the same conservative TERM/KILL and pipe-close timing as lsof.
// These are intentionally bounded teardown timings, separate from the request-response timeout.
const CODEX_APP_SERVER_KILL_GRACE_MS = LSOF_KILL_GRACE_MS;
const CODEX_APP_SERVER_CLOSE_GRACE_MS = LSOF_CLOSE_GRACE_MS;
/**
 * A measured production thread/list response for 100 Codex threads was 383,665 bytes. Keep enough
 * headroom for that ordinary frame while still bounding an unterminated or hostile stdout stream.
 */
export const DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES = 512 * 1024;
export const MAX_CODEX_APP_SERVER_MAX_LINE_BYTES = 1_024 * 1_024;
export const MAX_CODEX_THREAD_PAGES = 20;
export const MAX_CODEX_THREAD_ROWS = 2_000;
export const MAX_CODEX_THREAD_LIST_DURATION_MS = 20_000;
/** Four simultaneous bounded tails retain at most one MiB of rollout bytes. */
export const DEFAULT_CODEX_ENRICHMENT_CONCURRENCY = 4;
export const MAX_CODEX_ENRICHMENT_CONCURRENCY = 8;
export const DEFAULT_CODEX_ENRICHMENT_DEADLINE_MS = 5_000;
export const MAX_CODEX_ENRICHMENT_DEADLINE_MS = 10_000;
/** Only the newest bounded Codex threads are eligible for a metadata-only review signal. */
export const DEFAULT_CODEX_REVIEW_CANDIDATES = MAX_BACKGROUND_THREADS_PER_SOURCE;
export const MAX_CODEX_REVIEW_CANDIDATES = MAX_BACKGROUND_THREADS_PER_SOURCE;
/** Experimental turn summaries never inherit activity-tail tuning: their privacy boundary is fixed. */
export const DEFAULT_CODEX_REVIEW_CONCURRENCY = 4;
export const MAX_CODEX_REVIEW_CONCURRENCY = DEFAULT_CODEX_REVIEW_CONCURRENCY;
export const DEFAULT_CODEX_REVIEW_DEADLINE_MS = 5_000;
export const MAX_CODEX_REVIEW_DEADLINE_MS = DEFAULT_CODEX_REVIEW_DEADLINE_MS;

type CodexThreadListPage = { data?: CodexThread[]; nextCursor?: string | null };
type CodexTurnListPage = { data?: unknown };

/** A transient provider projection. It is intentionally not part of the persisted Codex schema. */
export type CodexThreadWithReview = CodexThread & { gajendraReview?: ReviewSignal };

export type CodexThreadListBounds = {
  maxPages?: number;
  maxRows?: number;
  deadlineMs?: number;
  now?: () => number;
};

export type CodexActivityEnrichmentOptions = {
  /** A small bounded worker pool; values above the hard cap are deliberately ignored. */
  maxConcurrency?: number;
  /** Total budget for lock discovery and every rollout-tail read. */
  deadlineMs?: number;
  /** Test seams keep hostile-provider regressions deterministic without changing production I/O. */
  listOpenFiles?: (lockDirectory: string, env: NodeJS.ProcessEnv) => Promise<string>;
  resolveSessionsDirectory?: (sessionsDirectory: string) => Promise<string>;
  readTail?: (filePath: string, sessionsDirectory: string) => Promise<{ text: string; truncated: boolean }>;
};

export type CodexReviewEnrichmentOptions = {
  /** Bound the number of newest Codex candidates inspected during one visible source refresh. */
  maxCandidates?: number;
  /** Test seam; metadata-only turn summaries never exceed four concurrent requests. */
  maxConcurrency?: number;
  /** Test seam; one total metadata-only batch never exceeds five seconds. */
  deadlineMs?: number;
  /** Test seam for deterministic candidate ordering/deadline checks. */
  now?: () => number;
};

export type CodexReviewEnrichmentResult = {
  threads: CodexThreadWithReview[];
  /** `unsupported` is cacheable; a deadline or ordinary RPC failure remains retryable next refresh. */
  availability: "available" | "unsupported" | "transient";
};

class CodexAppServerRpcError extends Error {
  constructor(readonly code: number | undefined, message: string) {
    super(message);
    this.name = "CodexAppServerRpcError";
  }
}

/** Only an explicit protocol rejection may downgrade the optional experimental path. */
function isUnsupportedExperimentalError(error: unknown): error is CodexAppServerRpcError {
  if (!(error instanceof CodexAppServerRpcError)) return false;
  if (error.code === -32601) return true; // JSON-RPC Method not found.
  const message = error.message.toLowerCase();
  // A generic server/invalid-params code is retryable unless its text explicitly rejects the
  // experimental capability or method. In particular, "temporarily unavailable" must not turn
  // off future visible-refresh attempts just because it mentions experimental/capability.
  const experimentalTarget = /\b(?:method|capabilit(?:y|ies)|experimental(?:api|\s+(?:api|capability)))\b/u;
  const explicitlyUnsupported = /\b(?:unsupported|not supported)\b/u.test(message)
    && experimentalTarget.test(message);
  const explicitUnknownTarget = /\b(?:unknown|unrecognized)\s+(?:experimental\s+)?(?:method|field|capabilit(?:y|ies)|parameter)\b/u.test(message);
  const explicitMethodNotFound = /\bmethod[\s-]+not[\s-]+found\b/u.test(message);
  return (error.code === -32602 || error.code === -32000)
    && (explicitlyUnsupported || explicitUnknownTarget || explicitMethodNotFound);
}

export type ListOpenFilesOptions = {
  timeoutMs?: number;
  killGraceMs?: number;
  closeGraceMs?: number;
  outputLimitBytes?: number;
};

export class CodexAppServerClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private lifecycle: AppServerLifecycle | null = null;
  private teardown: Promise<void> | null = null;
  private closeEpoch = 0;
  private terminallyClosed = false;
  private nextId = 1;
  private stdoutCleanup: (() => void) | null = null;
  private readonly stdoutLineLimit: number;
  private readonly pending = new Map<
    number,
    { resolve(value: unknown): void; reject(error: Error): void; timeout: NodeJS.Timeout }
  >();
  private ready: Promise<void> | null = null;
  private experimentalApiEnabled = false;
  private experimentalTurnsUnsupported = false;

  constructor(
    private readonly requestTimeoutMs = resolveRpcTimeout(),
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.stdoutLineLimit = resolveCodexAppServerStdoutLineLimit(env);
  }

  async listThreads(): Promise<CodexThreadWithReview[]> {
    await this.ensureReady();
    const threads = await listBoundedCodexThreads(async (params) => (
      this.request("thread/list", params) as Promise<CodexThreadListPage>
    ));
    const runtimeThreads = await enrichCodexRuntimeStatuses(threads, this.env);
    if (!this.experimentalApiEnabled || this.experimentalTurnsUnsupported) return runtimeThreads;

    const reviews = await enrichCodexReviewSignals(
      runtimeThreads,
      (params) => this.request("thread/turns/list", params),
    );
    if (reviews.availability === "unsupported") this.experimentalTurnsUnsupported = true;
    return reviews.threads;
  }

  async close(): Promise<void> {
    // close is terminal for a client instance. Invalidate any retry that was already queued on a
    // failed child's close promise before awaiting that child, so close cannot return with a new
    // app-server process that started in the gap.
    this.terminallyClosed = true;
    this.closeEpoch += 1;
    const lifecycle = this.lifecycle;
    if (lifecycle) {
      await this.shutdownAppServer(lifecycle, new Error("Codex app-server client is closed."));
      return;
    }
    if (this.teardown) await this.teardown;
  }

  private ensureReady(): Promise<void> {
    if (this.terminallyClosed) return Promise.reject(new Error("Codex app-server client is closed."));
    if (this.ready) return this.ready;
    // A retry must not start a new RPC child until every pipe from a previous failed child has
    // closed (or the bounded watchdog has torn down our local handles).
    const epoch = this.closeEpoch;
    const starting = this.teardown ? this.teardown.then(() => this.start(epoch)) : this.start(epoch);
    this.ready = starting;
    // A protocol violation can occur while start() is still creating its initial request. Keep a
    // rejected start from pinning the client in a permanently failed "ready" state.
    void starting.catch(() => {
      if (this.ready === starting) this.ready = null;
    });
    return starting;
  }

  private async start(epoch: number, initializeMode: "experimental" | "baseline" = "experimental"): Promise<void> {
    if (this.terminallyClosed || epoch !== this.closeEpoch) {
      throw new Error("Codex app-server client is closed.");
    }
    const executable = this.env.GAJENDRA_CODEX_BIN
      || this.env.AADI_CODEX_BIN
      || this.env.PRIORITY_DECK_CODEX_BIN
      || "codex";
    const child = spawn(executable, ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: this.env,
      // On POSIX the app-server and inherited-pipe descendants share an isolated process group.
      detached: supportsProcessGroupSignals(),
    });
    const lifecycle = this.createAppServerLifecycle(child);
    this.process = child;
    this.lifecycle = lifecycle;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", () => undefined);
    child.once("exit", (code, signal) => {
      this.handleAppServerExit(lifecycle, code, signal);
    });
    child.once("error", (error) => {
      this.handleAppServerError(lifecycle, error);
    });
    child.once("close", () => this.handleAppServerClose(lifecycle));
    this.attachStdoutFraming(child);

    const clientInfo = { name: "gajendra", title: "Gajendra", version: "0.3.1" };
    try {
      await this.request("initialize", {
        clientInfo,
        capabilities: initializeMode === "experimental"
          ? { experimentalApi: true, requestAttestation: false }
          : null,
      });
    } catch (error) {
      if (initializeMode !== "experimental" || !isUnsupportedExperimentalError(error)) {
        await this.shutdownAppServer(lifecycle, error instanceof Error ? error : new Error("Codex app-server initialize failed."));
        throw error;
      }
      // App-server initialization is one-shot per connection. Tear down the capability-rejecting
      // child before retrying baseline initialization, keeping the original ensureReady promise
      // in place so no caller can start a second process during the handoff.
      await this.shutdownAppServer(lifecycle, error, true);
      if (this.terminallyClosed || epoch !== this.closeEpoch) throw new Error("Codex app-server client is closed.");
      return this.start(epoch, "baseline");
    }
    this.experimentalApiEnabled = initializeMode === "experimental";
    this.experimentalTurnsUnsupported = initializeMode !== "experimental";
    this.notify("initialized", {});
  }

  /**
   * Do not use readline here: it retains a complete line before emitting it, so a provider that
   * never writes a newline can make the renderer retain arbitrary stdout. This parser holds at
   * most one configured JSON-RPC frame and rejects before concatenating an oversize segment.
   */
  private attachStdoutFraming(child: ChildProcessWithoutNullStreams): void {
    let buffered = Buffer.alloc(0);
    let open = true;
    const discard = () => {
      if (!open) return;
      open = false;
      child.stdout.off("data", onStdout);
      child.stdout.resume();
      if (this.stdoutCleanup === discard) this.stdoutCleanup = null;
    };
    const onStdout = (value: Buffer | string) => {
      if (!open) return;
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf(0x0a, start);
        const end = newline === -1 ? chunk.length : newline;
        const segment = chunk.subarray(start, end);
        if (buffered.length + segment.length > this.stdoutLineLimit) {
          discard();
          this.failProtocolOutput(child);
          return;
        }
        if (newline === -1) {
          if (segment.length > 0) buffered = buffered.length === 0 ? Buffer.from(segment) : Buffer.concat([buffered, segment]);
          return;
        }
        const line = buffered.length === 0
          ? segment.toString("utf8")
          : Buffer.concat([buffered, segment]).toString("utf8");
        buffered = Buffer.alloc(0);
        this.acceptLine(line.endsWith("\r") ? line.slice(0, -1) : line);
        start = newline + 1;
      }
    };
    this.stdoutCleanup?.();
    this.stdoutCleanup = discard;
    child.stdout.on("data", onStdout);
  }

  private failProtocolOutput(child: ChildProcessWithoutNullStreams): void {
    const lifecycle = this.lifecycle;
    if (!lifecycle || lifecycle.child !== child) return;
    const error = new Error("Codex app-server protocol output exceeded the safe limit.");
    // The pending RPC is rejected immediately, but ensureReady gates every retry on this
    // lifecycle's close promise. That prevents a new client from running beside an inherited
    // pipe descendant of the malformed child.
    void this.shutdownAppServer(lifecycle, error);
  }

  private createAppServerLifecycle(child: ChildProcessWithoutNullStreams): AppServerLifecycle {
    let resolveClosed: (() => void) | null = null;
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    return {
      child,
      closed,
      resolveClosed: () => resolveClosed?.(),
      closing: false,
      finished: false,
      exited: false,
      terminationError: null,
      killTimer: null,
      closeTimer: null,
      postKillCloseTimer: null,
    };
  }

  private shutdownAppServer(lifecycle: AppServerLifecycle, error: Error, preserveReady = false): Promise<void> {
    if (lifecycle.closing) return lifecycle.closed;
    lifecycle.closing = true;
    lifecycle.terminationError = error;
    if (this.process === lifecycle.child) {
      this.process = null;
      if (!preserveReady) this.ready = null;
    }
    this.stdoutCleanup?.();
    this.stdoutCleanup = null;
    this.rejectPending(error);
    this.teardown = lifecycle.closed;
    void lifecycle.closed.then(() => {
      if (this.teardown === lifecycle.closed) this.teardown = null;
    });

    // Do not settle merely because the group signal was issued. A forked descendant can retain
    // stdio after its leader exits; close or the bounded watchdog is the teardown authority.
    signalProcessGroup(lifecycle.child, "SIGTERM");
    if (lifecycle.exited) {
      this.startAppServerCloseWatchdog(lifecycle);
    } else {
      lifecycle.killTimer = setTimeout(() => {
        if (lifecycle.finished) return;
        lifecycle.killTimer = null;
        signalProcessGroup(lifecycle.child, "SIGKILL");
        this.startAppServerCloseWatchdog(lifecycle);
      }, CODEX_APP_SERVER_KILL_GRACE_MS);
      lifecycle.killTimer.unref();
    }
    return lifecycle.closed;
  }

  private handleAppServerExit(lifecycle: AppServerLifecycle, code: number | null, signal: NodeJS.Signals | null): void {
    lifecycle.exited = true;
    if (lifecycle.killTimer) clearTimeout(lifecycle.killTimer);
    lifecycle.killTimer = null;
    if (!lifecycle.closing) {
      void this.shutdownAppServer(lifecycle, new Error(`Codex app-server exited (${signal ?? code ?? "unknown"}).`));
      return;
    }
    this.startAppServerCloseWatchdog(lifecycle);
  }

  private handleAppServerError(lifecycle: AppServerLifecycle, error: Error): void {
    if (!lifecycle.closing) {
      void this.shutdownAppServer(lifecycle, error);
      return;
    }
    this.startAppServerCloseWatchdog(lifecycle);
  }

  private handleAppServerClose(lifecycle: AppServerLifecycle): void {
    if (!lifecycle.closing) {
      lifecycle.closing = true;
      lifecycle.terminationError = new Error("Codex app-server closed unexpectedly.");
      if (this.process === lifecycle.child) {
        this.process = null;
        this.ready = null;
      }
      this.stdoutCleanup?.();
      this.stdoutCleanup = null;
      this.rejectPending(lifecycle.terminationError);
    }
    this.finishAppServerLifecycle(lifecycle);
  }

  private startAppServerCloseWatchdog(lifecycle: AppServerLifecycle): void {
    if (lifecycle.finished || lifecycle.closeTimer || lifecycle.postKillCloseTimer) return;
    lifecycle.closeTimer = setTimeout(() => {
      lifecycle.closeTimer = null;
      signalProcessGroup(lifecycle.child, "SIGKILL");
      // Prefer the genuine close event after KILL, which proves inherited pipes have released.
      // If a platform keeps the local handles open, bound the caller with one final grace.
      lifecycle.postKillCloseTimer = setTimeout(() => {
        lifecycle.postKillCloseTimer = null;
        destroyAppServerPipes(lifecycle.child);
        this.finishAppServerLifecycle(lifecycle);
      }, CODEX_APP_SERVER_KILL_GRACE_MS);
      lifecycle.postKillCloseTimer.unref();
    }, CODEX_APP_SERVER_CLOSE_GRACE_MS);
    lifecycle.closeTimer.unref();
  }

  private finishAppServerLifecycle(lifecycle: AppServerLifecycle): void {
    if (lifecycle.finished) return;
    lifecycle.finished = true;
    if (lifecycle.killTimer) clearTimeout(lifecycle.killTimer);
    if (lifecycle.closeTimer) clearTimeout(lifecycle.closeTimer);
    if (lifecycle.postKillCloseTimer) clearTimeout(lifecycle.postKillCloseTimer);
    lifecycle.killTimer = null;
    lifecycle.closeTimer = null;
    lifecycle.postKillCloseTimer = null;
    if (this.lifecycle === lifecycle) this.lifecycle = null;
    if (this.process === lifecycle.child) this.process = null;
    lifecycle.resolveClosed();
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
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
      pending.reject(new CodexAppServerRpcError(
        typeof message.error.code === "number" ? message.error.code : undefined,
        message.error.message || `Codex app-server error ${message.error.code ?? "unknown"}`,
      ));
    } else {
      pending.resolve(message.result);
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const active = this.process;
    if (!active) {
      // A hostile child can overflow stdout immediately after spawn, before start() has installed
      // its first pending initialize request. Preserve that bounded protocol failure instead of
      // replacing it with a generic race-dependent "not running" error.
      return Promise.reject(this.lifecycle?.terminationError ?? new Error("Codex app-server is not running."));
    }
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

/**
 * The app-server's per-request timeout cannot bound a pathological cursor stream by itself.
 * Keep page, row, and elapsed-time ceilings together so one provider response cannot turn a
 * metadata refresh into unbounded work or memory retention.
 */
export async function listBoundedCodexThreads(
  request: (params: {
    cursor: string | null;
    limit: number;
    sortKey: "recency_at";
    sortDirection: "desc";
    archived: false;
  }) => Promise<CodexThreadListPage>,
  bounds: CodexThreadListBounds = {},
): Promise<CodexThread[]> {
  const maxPages = positiveBound(bounds.maxPages, MAX_CODEX_THREAD_PAGES);
  const maxRows = positiveBound(bounds.maxRows, MAX_CODEX_THREAD_ROWS);
  const deadlineMs = positiveBound(bounds.deadlineMs, MAX_CODEX_THREAD_LIST_DURATION_MS);
  const now = bounds.now ?? Date.now;
  const startedAt = now();
  const all: CodexThread[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;

  for (;;) {
    if (pages >= maxPages) throw new Error("Codex app-server exceeded the safe page limit.");
    const remainingMs = deadlineMs - (now() - startedAt);
    if (remainingMs <= 0) throw new Error("Codex app-server exceeded the total listing deadline.");
    const response: CodexThreadListPage = await beforeDeadline<CodexThreadListPage>(request({
      cursor,
      limit: Math.min(100, maxRows - all.length),
      sortKey: "recency_at",
      sortDirection: "desc",
      archived: false,
    }), remainingMs);
    pages += 1;
    const rows = response.data ?? [];
    if (rows.length > maxRows - all.length) throw new Error("Codex app-server exceeded the safe row limit.");
    all.push(...rows);
    if (now() - startedAt > deadlineMs) throw new Error("Codex app-server exceeded the total listing deadline.");
    const next: string | null = response.nextCursor ?? null;
    if (!next) return all;
    if (all.length >= maxRows) throw new Error("Codex app-server exceeded the safe row limit.");
    if (seenCursors.has(next)) throw new Error("Codex app-server repeated a pagination cursor.");
    seenCursors.add(next);
    cursor = next;
  }
}

/**
 * Projects the optional experimental turn-summary metadata into a live ReviewSignal. The request
 * explicitly asks the app-server not to load turn items; this function never examines item
 * content, and returns an unmodified base list when the experimental endpoint is unavailable.
 */
export async function enrichCodexReviewSignals(
  threads: CodexThread[],
  requestTurns: (params: {
    threadId: string;
    limit: 1;
    sortDirection: "desc";
    itemsView: "notLoaded";
  }) => Promise<unknown>,
  options: CodexReviewEnrichmentOptions = {},
): Promise<CodexReviewEnrichmentResult> {
  // Do not carry a provider-supplied or stale projection across refreshes. This one only exists
  // in the current source collection and is deliberately constructed from strict metadata below.
  const baseThreads = threads.map(codexBaseThread);
  const now = options.now ?? Date.now;
  const maxCandidates = boundedPositive(
    options.maxCandidates,
    DEFAULT_CODEX_REVIEW_CANDIDATES,
    MAX_CODEX_REVIEW_CANDIDATES,
  );
  const maxConcurrency = boundedPositive(
    options.maxConcurrency,
    DEFAULT_CODEX_REVIEW_CONCURRENCY,
    MAX_CODEX_REVIEW_CONCURRENCY,
  );
  const deadlineMs = boundedPositive(
    options.deadlineMs,
    DEFAULT_CODEX_REVIEW_DEADLINE_MS,
    MAX_CODEX_REVIEW_DEADLINE_MS,
  );
  const deadline = now() + deadlineMs;
  const candidates = [...baseThreads]
    .filter((thread) => typeof thread.id === "string" && thread.id.length > 0 && isEligibleCodexReviewThread(thread))
    .sort((left, right) => codexThreadRecency(right) - codexThreadRecency(left))
    .slice(0, maxCandidates);
  if (candidates.length === 0) return { threads: baseThreads, availability: "available" };

  const signals = new Map<string, ReviewSignal>();
  let nextCandidate = 0;
  let availability: CodexReviewEnrichmentResult["availability"] = "available";
  const inspectCandidate = async (thread: CodexThread): Promise<void> => {
    try {
      const response = await beforeDeadline(
        requestTurns({ threadId: thread.id, limit: 1, sortDirection: "desc", itemsView: "notLoaded" }),
        Math.max(1, deadline - now()),
        "Codex review metadata exceeded its total deadline.",
      );
      const outcome = classifyCodexReviewTurnPage(thread, response, now());
      if (outcome.kind === "ready") signals.set(thread.id, outcome.signal);
      // An unexpected response shape could otherwise leave an earlier valid candidate visible
      // as Ready. Abort the whole optional batch without retaining any turn-derived data.
      else if (outcome.kind === "invalid") availability = "transient";
    } catch (error) {
      // A rejected experimental endpoint is not an ordinary source error. Treat the entire
      // optional projection as unavailable so an older server cannot leave a partial claim.
      availability = isUnsupportedExperimentalError(error) ? "unsupported" : "transient";
    }
  };

  // Probe the optional method once before filling the pool. This lets a method-not-found or
  // capability-rejecting app-server stop at one request rather than launching a needless burst.
  const firstCandidate = candidates[nextCandidate++];
  if (firstCandidate) await inspectCandidate(firstCandidate);
  if (availability !== "available" || now() >= deadline) {
    return { threads: baseThreads, availability: availability === "available" ? "transient" : availability };
  }

  const worker = async (): Promise<void> => {
    for (;;) {
      if (availability !== "available" || now() >= deadline) {
        if (availability === "available") availability = "transient";
        return;
      }
      const thread = candidates[nextCandidate++];
      if (!thread) return;
      await inspectCandidate(thread);
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrency, candidates.length) }, () => worker()));
  if (availability !== "available" || now() >= deadline) {
    return { threads: baseThreads, availability: availability === "available" ? "transient" : availability };
  }

  return {
    threads: baseThreads.map((thread) => {
      const review = signals.get(thread.id);
      return review && isEligibleCodexReviewThread(thread)
        ? { ...thread, gajendraReview: review }
        : thread;
    }),
    availability: "available",
  };
}

function codexBaseThread(thread: CodexThread): CodexThread {
  // `thread/list` is provider data. Copy only the established listing metadata so unexpected
  // experimental fields (including a turn-like payload) cannot hitch a ride to a source adapter.
  const base: CodexThread = { id: thread.id };
  if (typeof thread.preview === "string") base.preview = thread.preview;
  if (typeof thread.name === "string" || thread.name === null) base.name = thread.name;
  if (typeof thread.cwd === "string") base.cwd = thread.cwd;
  if (typeof thread.updatedAt === "number" && Number.isFinite(thread.updatedAt)) base.updatedAt = thread.updatedAt;
  if (typeof thread.recencyAt === "number" && Number.isFinite(thread.recencyAt)) base.recencyAt = thread.recencyAt;
  else if (thread.recencyAt === null) base.recencyAt = null;
  if (typeof thread.status === "string") base.status = thread.status;
  else if (thread.status && typeof thread.status === "object" && typeof thread.status.type === "string") {
    base.status = { type: thread.status.type };
  }
  if (typeof thread.path === "string" || thread.path === null) base.path = thread.path;
  return base;
}

function codexThreadRecency(thread: CodexThread): number {
  const value = thread.recencyAt ?? thread.updatedAt ?? 0;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isEligibleCodexReviewThread(thread: CodexThread): boolean {
  // `thread/list` currently defines idle/notLoaded as the only non-active states suitable for a
  // completion claim. Unknown, malformed, future, and system-error values stay fail-closed.
  const status = normalizeCodexStatus(codexStatusType(thread.status));
  return status === "idle" || status === "notloaded";
}

function normalizeCodexStatus(status: string): string {
  return status.toLowerCase().replace(/[^a-z]/gu, "");
}

type CodexReviewTurnOutcome =
  | { kind: "ready"; signal: ReviewSignal }
  | { kind: "not-ready" }
  | { kind: "invalid" };

function classifyCodexReviewTurnPage(thread: CodexThread, response: unknown, nowMs: number): CodexReviewTurnOutcome {
  if (!response || typeof response !== "object") return { kind: "invalid" };
  const data = (response as CodexTurnListPage).data;
  if (!Array.isArray(data)) return { kind: "invalid" };
  // An empty newest-turn page is valid evidence that there is no reviewable turn, not malformed
  // provider data. It emits no signal without suppressing other independently valid candidates.
  if (data.length === 0) return { kind: "not-ready" };
  if (data.length !== 1) return { kind: "invalid" };
  const turn = data[0];
  if (!turn || typeof turn !== "object") return { kind: "invalid" };
  const summary = turn as {
    status?: unknown;
    completedAt?: unknown;
    itemsView?: unknown;
    items?: unknown;
    error?: unknown;
  };
  // `notLoaded` and an empty item array prove that this classification used only summary
  // metadata. A non-empty item list is rejected without being traversed or retained.
  if (summary.itemsView !== "notLoaded" || !Array.isArray(summary.items) || summary.items.length !== 0) return { kind: "invalid" };
  if (summary.status !== "completed" && summary.status !== "inProgress" && summary.status !== "active" && summary.status !== "interrupted" && summary.status !== "failed") {
    return { kind: "invalid" };
  }
  // A valid newest non-completed turn is simply not review-ready. It must not poison an otherwise
  // valid optional metadata batch, and no error/details are traversed or retained.
  if (summary.status !== "completed") return { kind: "not-ready" };
  if (summary.error !== null) return { kind: "invalid" };
  // After the metadata-only shape and null error checks above, an explicit null completion time is
  // an older Codex candidate-local omission rather than malformed metadata. It is not review-ready
  // and must not poison valid siblings. Missing/other timestamp values still fail closed below.
  if (summary.completedAt === null) return { kind: "not-ready" };
  const completedAt = codexCompletedAt(summary.completedAt, nowMs);
  if (completedAt === null) return { kind: "invalid" };
  return { kind: "ready", signal: {
    state: "ready",
    kind: "result",
    updatedAt: completedAt,
    destination: { type: "thread", deepLink: `codex://threads/${encodeURIComponent(thread.id)}` },
    providerStatus: "completed",
  } };
}

function codexCompletedAt(value: unknown, nowMs: number): number | null {
  // `thread/turns/list` exposes Unix seconds. Do not guess alternate units or coerce strings:
  // an unexpected, unrenderable, or future server timestamp must remain a no-signal rather than
  // a synthetic completion time. Millisecond timestamps are far ahead of the current Unix-second
  // clock and therefore also fail closed.
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  const renderedMs = value * 1_000;
  if (!Number.isFinite(new Date(renderedMs).getTime())) return null;
  const nowSeconds = Math.floor(nowMs / 1_000);
  return Number.isSafeInteger(nowSeconds) && value <= nowSeconds ? value : null;
}

export async function enrichCodexRuntimeStatuses(
  threads: CodexThread[],
  env: NodeJS.ProcessEnv = process.env,
  options: CodexActivityEnrichmentOptions = {},
): Promise<CodexThread[]> {
  if (!isCodexActivityEnrichmentEnabled(env)) return threads;
  if (threads.every((thread) => codexStatusType(thread.status) === "active")) return threads;
  const deadlineMs = boundedPositive(
    options.deadlineMs ?? environmentInteger(env.GAJENDRA_CODEX_ENRICHMENT_DEADLINE_MS),
    DEFAULT_CODEX_ENRICHMENT_DEADLINE_MS,
    MAX_CODEX_ENRICHMENT_DEADLINE_MS,
  );
  const maxConcurrency = boundedPositive(
    options.maxConcurrency ?? environmentInteger(env.GAJENDRA_CODEX_ENRICHMENT_CONCURRENCY),
    DEFAULT_CODEX_ENRICHMENT_CONCURRENCY,
    MAX_CODEX_ENRICHMENT_CONCURRENCY,
  );
  const deadline = Date.now() + deadlineMs;
  const codexHome = path.resolve(env.CODEX_HOME ?? path.join(os.homedir(), ".codex"));
  const lockDirectory = path.join(codexHome, "thread-writer-locks");
  const sessionsDirectory = path.join(codexHome, "sessions");
  let heldThreadIds: Set<string>;
  let realSessionsDirectory: string;
  try {
    heldThreadIds = heldCodexThreadIds(await beforeDeadline(
      (options.listOpenFiles ?? listOpenFiles)(lockDirectory, env),
      remainingDeadlineMs(deadline),
      "Codex runtime enrichment exceeded its total deadline.",
    ), lockDirectory);
    realSessionsDirectory = await beforeDeadline(
      (options.resolveSessionsDirectory ?? realpath)(sessionsDirectory),
      remainingDeadlineMs(deadline),
      "Codex runtime enrichment exceeded its total deadline.",
    );
  } catch {
    return threads;
  }
  if (heldThreadIds.size === 0) return threads;

  const activeThreadIds = new Set(threads
    .filter((thread) => codexStatusType(thread.status) === "active")
    .map((thread) => thread.id));
  const candidates = threads.filter((thread) => (
    codexStatusType(thread.status) !== "active" && heldThreadIds.has(thread.id) && Boolean(thread.path)
  ));
  let nextCandidate = 0;
  let timedOut = false;
  const readTail = options.readTail ?? readContainedRolloutTail;
  const worker = async (): Promise<void> => {
    for (;;) {
      if (timedOut || Date.now() >= deadline) {
        timedOut = true;
        return;
      }
      const thread = candidates[nextCandidate++];
      if (!thread?.path) return;
      try {
        const tail = await beforeDeadline(
          readTail(thread.path, realSessionsDirectory),
          remainingDeadlineMs(deadline),
          "Codex runtime enrichment exceeded its total deadline.",
        );
        if (rolloutTailShowsActiveTurn(tail.text, tail.truncated)) activeThreadIds.add(thread.id);
      } catch (error) {
        if (error instanceof DeadlineExceededError) {
          timedOut = true;
          return;
        }
        // One malformed, unreadable, or hostile rollout keeps its base app-server status. Other
        // independently held threads may still be enriched within the shared deadline.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxConcurrency, candidates.length) }, () => worker()));
  // A deadline is all-or-nothing: do not present a partly enriched status set as authoritative.
  if (timedOut || Date.now() >= deadline) return threads;

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
    if (event.type === "turn_context") return true;
    if (event.type === "event_msg" && isAllowedActivityMarker(event.payload?.type)) return true;
  }
  return false;
}

export function isCodexActivityEnrichmentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.GAJENDRA_CODEX_ACTIVITY_ENRICHMENT;
  return value === undefined || !["0", "false", "off", "no"].includes(value.trim().toLowerCase());
}

function isAllowedActivityMarker(value: unknown): boolean {
  return value === "token_count" || value === "turn_started" || value === "turn_in_progress";
}

function codexStatusType(status: CodexThread["status"]): string {
  return typeof status === "string" ? status : status?.type ?? "unknown";
}

/** Reads a rollout only when its resolved target remains within the real sessions root. */
export async function readCodexRolloutTail(filePath: string, sessionsDirectory: string): Promise<{ text: string; truncated: boolean }> {
  return readContainedRolloutTail(filePath, await realpath(sessionsDirectory));
}

async function readContainedRolloutTail(filePath: string, realSessionsDirectory: string): Promise<{ text: string; truncated: boolean }> {
  const resolvedFilePath = await realpath(filePath);
  const containedRoot = `${realSessionsDirectory}${path.sep}`;
  if (!resolvedFilePath.startsWith(containedRoot) || !resolvedFilePath.endsWith(".jsonl")) {
    throw new Error("Codex rollout path is outside the sessions directory.");
  }
  // O_NOFOLLOW rejects a final-component symlink swapped after realpath. fstat and every bounded
  // read below use this one opened handle, so a stat/read replacement cannot alter the target.
  const file = await open(resolvedFilePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await file.stat();
    if (!metadata.isFile()) throw new Error("Codex rollout is not a regular file.");
    const length = Math.min(metadata.size, MAX_ROLLOUT_TAIL_BYTES);
    const truncated = metadata.size > length;
    const buffer = Buffer.alloc(length);
    let offset = 0;
    const position = metadata.size - length;
    while (offset < buffer.length) {
      const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, position + offset);
      if (bytesRead === 0) break;
      offset += bytesRead;
    }
    return { text: buffer.subarray(0, offset).toString("utf8"), truncated };
  } finally {
    await file.close();
  }
}

export function listOpenFiles(
  lockDirectory: string,
  env: NodeJS.ProcessEnv,
  options: ListOpenFilesOptions = {},
): Promise<string> {
  const executable = env.GAJENDRA_LSOF_BIN ?? "/usr/sbin/lsof";
  const timeoutMs = positiveBound(options.timeoutMs, LSOF_TIMEOUT_MS);
  const killGraceMs = positiveBound(options.killGraceMs, LSOF_KILL_GRACE_MS);
  const closeGraceMs = positiveBound(options.closeGraceMs, LSOF_CLOSE_GRACE_MS);
  const outputLimitBytes = positiveBound(options.outputLimitBytes, MAX_LSOF_OUTPUT_BYTES);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-Fn", "+D", lockDirectory], {
      stdio: ["ignore", "pipe", "pipe"],
      env,
      // Keep lsof and descendants which inherit its pipes in an isolated POSIX process group.
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
    const finish = (error: Error | null, value = "") => {
      if (settled) return;
      settled = true;
      clearTimers();
      stopCapture();
      if (error) reject(error);
      else resolve(value);
    };
    const stopCapture = () => {
      if (!captureOpen) return;
      captureOpen = false;
      child.stdout.off("data", onStdout);
      // Keep both pipes flowing but discard provider-controlled output after a terminal state.
      child.stdout.resume();
      child.stderr.resume();
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
        const error = terminationError ?? new Error("lsof did not close its output streams.");
        terminationError = error;
        signalProcessGroup(child, "SIGKILL");
        closeTimer = null;
        // Prefer the real close event after group KILL: it proves descendant-held inherited
        // pipes were released before callers can proceed. The second bounded grace still fails
        // closed if a platform leaves local descriptors open despite KILL.
        postKillCloseTimer = setTimeout(() => {
          stopCapture();
          destroyLocalPipes(child);
          finish(error);
        }, killGraceMs);
        postKillCloseTimer.unref();
      }, closeGraceMs);
      closeTimer.unref();
    };
    timeout = setTimeout(() => {
      terminate(new Error(`lsof timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    timeout.unref();
    onStdout = (chunk: Buffer | string) => {
      if (!captureOpen) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (bytes.length > outputLimitBytes - capturedBytes) {
        terminate(new Error("lsof exceeded the safe output limit."));
        return;
      }
      chunks.push(bytes);
      capturedBytes += bytes.length;
    };
    child.stdout.on("data", onStdout);
    // Drain stderr without retaining or exposing provider-controlled text.
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
      // The direct lsof process can exit while a child holds inherited pipes open. TERM the
      // dedicated group now; the bounded watchdog below escalates to KILL if close never arrives.
      signalProcessGroup(child, "SIGTERM");
      startCloseWatchdog();
    });
    // stdout/stderr can close after exit. Settle only once all output handles have closed so a
    // normal result is complete and a terminating child cannot outlive this command result.
    child.once("close", (code) => {
      if (terminationError) {
        finish(terminationError);
      } else if (code === 0 || code === 1) {
        finish(null, Buffer.concat(chunks, capturedBytes).toString("utf8"));
      } else {
        finish(new Error(`lsof exited with status ${code ?? "unknown"}.`));
      }
    });
  });
}

export function resolveRpcTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.GAJENDRA_RPC_TIMEOUT_MS ?? env.AADI_RPC_TIMEOUT_MS ?? env.PRIORITY_DECK_RPC_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 15_000;
}

export function resolveCodexAppServerStdoutLineLimit(env: NodeJS.ProcessEnv = process.env): number {
  return boundedPositive(
    environmentInteger(env.GAJENDRA_CODEX_APP_SERVER_MAX_LINE_BYTES),
    DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES,
    MAX_CODEX_APP_SERVER_MAX_LINE_BYTES,
  );
}

function positiveBound(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

/** POSIX gives a detached child its own process group; Windows falls back to direct-child kill
 * plus the close watchdog, which still prevents an inherited pipe from keeping this request open. */
function supportsProcessGroupSignals(): boolean {
  return process.platform !== "win32";
}

function signalProcessGroup(child: OutputChildProcess, signal: NodeJS.Signals): void {
  if (supportsProcessGroupSignals() && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // The leader may already be gone while a close watchdog still owns the local pipe handles.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // A concurrent exit is harmless; close/watchdog settles safely.
  }
}

function destroyLocalPipes(child: OutputChildProcess): void {
  child.stdout.destroy();
  child.stderr.destroy();
}

function destroyAppServerPipes(child: ChildProcessWithoutNullStreams): void {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
}

function boundedPositive(value: number | undefined, fallback: number, maximum: number): number {
  return Math.min(positiveBound(value, fallback), maximum);
}

function environmentInteger(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function remainingDeadlineMs(deadline: number): number {
  return Math.max(1, deadline - Date.now());
}

class DeadlineExceededError extends Error {}

function beforeDeadline<T>(operation: Promise<T>, timeoutMs: number, message = "Codex app-server exceeded the total listing deadline."): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new DeadlineExceededError(message)), timeoutMs);
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
