import type { Readable } from "node:stream";
import { LifecycleInvalidationCache } from "./metadata-cache.js";
import { resolveDataDirectory } from "./store.js";

/** Larger/private hook payloads are skipped; ordinary provider polling remains authoritative. */
export const MAX_LIFECYCLE_INPUT_BYTES = 64 * 1024;
export const LIFECYCLE_EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"] as const;
const opaqueId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u;

export type LifecycleIdentity = { sessionId: string; event: typeof LIFECYCLE_EVENTS[number]; turnId?: string };

export function resolveLifecycleDataDirectory(env: NodeJS.ProcessEnv = process.env): string {
  // Codex injects PLUGIN_DATA into hook commands, but not the MCP/native clients.
  // Use their shared default; an explicit GAJENDRA_DATA_DIR still isolates every client.
  return resolveDataDirectory({ ...env, PLUGIN_DATA: undefined });
}

export function parseLifecycleIdentity(input: string): LifecycleIdentity | null {
  if (Buffer.byteLength(input) > MAX_LIFECYCLE_INPUT_BYTES) return null;
  try {
    const value: unknown = JSON.parse(input);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const payload = value as Record<string, unknown>;
    if (typeof payload.session_id !== "string" || !opaqueId.test(payload.session_id)
      || typeof payload.hook_event_name !== "string" || !LIFECYCLE_EVENTS.some(event => event === payload.hook_event_name)
      || (payload.turn_id !== undefined && (typeof payload.turn_id !== "string" || !opaqueId.test(payload.turn_id)))) return null;
    // Construct the allow-list explicitly. Never retain the payload or inspect its content/path fields.
    return { sessionId: payload.session_id, event: payload.hook_event_name as LifecycleIdentity["event"],
      ...(typeof payload.turn_id === "string" ? { turnId: payload.turn_id } : {}) };
  } catch { return null; }
}

export async function ingestLifecycleEvent(input: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.GAJENDRA_METADATA_CACHE === "off" || !parseLifecycleIdentity(input)) return;
  // Host session IDs can denote parent/remote sessions; no independently verified local mapping exists.
  // Invalidate the bounded completion cache globally, preserving rendered metadata and all priorities.
  try { await new LifecycleInvalidationCache(resolveLifecycleDataDirectory(env)).invalidate(); } catch { /* Optional fast path. */ }
}

export function readBoundedLifecycleInput(stream: Readable, timeoutMs = 1_000): Promise<string | null> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    let size = 0;
    const finish = (value: string | null) => {
      clearTimeout(timer);
      stream.off("data", onData); stream.off("end", onEnd); stream.off("error", onError);
      stream.pause(); resolve(value);
    };
    const onData = (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > MAX_LIFECYCLE_INPUT_BYTES) finish(null); else chunks.push(bytes);
    };
    const onEnd = () => finish(Buffer.concat(chunks).toString("utf8"));
    const onError = () => finish(null);
    const timer = setTimeout(() => finish(null), Math.max(1, Math.min(timeoutMs, 1_000)));
    stream.on("data", onData); stream.once("end", onEnd); stream.once("error", onError);
  });
}
