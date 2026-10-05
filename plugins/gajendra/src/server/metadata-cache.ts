import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, stat, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { resolveDataDirectory } from "./store.js";
import type { PriorityStore } from "../shared/contracts.js";
import { relativeCatalogWorkingDirectory, resolveSourcesConfigPath, type SourceCollection } from "./thread-sources.js";

// Disposable metadata only. Never use these files as the authority for priority or mutations.
const MAX_CACHE_BYTES = 4 * 1024 * 1024;
export const metadataHash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function cacheScope(env: NodeJS.ProcessEnv): Promise<string> {
  const optionalPath = (value: string | undefined) => value ? path.resolve(value) : null;
  // Match provider path resolution before hashing. The same relative spelling in two callers'
  // working directories must not attach either caller to the other's catalog/session owner.
  const codexExecutable = env.GAJENDRA_CODEX_BIN || env.AADI_CODEX_BIN || env.PRIORITY_DECK_CODEX_BIN;
  const codexIdentity = codexExecutable && /[/\\]/u.test(codexExecutable)
    ? path.resolve(codexExecutable) : codexExecutable;
  const codexSearchPath = !codexExecutable || !/[/\\]/u.test(codexExecutable)
    ? env.PATH?.split(path.delimiter).map(directory => path.resolve(directory)) : undefined;
  return metadataHash([path.resolve(env.CODEX_HOME ?? path.join(os.homedir(), ".codex")),
    codexIdentity, codexSearchPath,
    path.resolve(env.GAJENDRA_CLAUDE_CONFIG_DIR ?? env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude")),
    optionalPath(env.GAJENDRA_CLAUDE_BIN), optionalPath(env.GAJENDRA_CURSOR_BIN),
    path.resolve(env.GAJENDRA_GROK_CONFIG_DIR ?? path.join(os.homedir(), ".grok")), optionalPath(env.GAJENDRA_GROK_BIN),
    resolveSourcesConfigPath(env), await relativeCatalogWorkingDirectory(env)]);
}

export class PrivateMetadataFile {
  readonly filePath: string;
  constructor(name: string, directory = resolveDataDirectory()) {
    this.filePath = path.join(directory, "metadata-cache", name);
  }
  async read(): Promise<unknown> {
    let handle;
    try {
      const directory = await lstat(path.dirname(this.filePath));
      if (!directory.isDirectory() || directory.isSymbolicLink() || (directory.mode & 0o077) !== 0) return null;
      handle = await open(this.filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_CACHE_BYTES || (stat.mode & 0o077) !== 0
        || (process.getuid && stat.uid !== process.getuid())) return null;
      const buffer = Buffer.alloc(MAX_CACHE_BYTES + 1);
      let size = 0;
      while (size < buffer.length) {
        const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
        if (bytesRead === 0) break;
        size += bytesRead;
      }
      return size > MAX_CACHE_BYTES ? null : JSON.parse(buffer.subarray(0, size).toString("utf8"));
    } catch { return null; }
    finally { await handle?.close().catch(() => undefined); }
  }
  async write(value: unknown): Promise<void> {
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      const body = JSON.stringify(value);
      if (Buffer.byteLength(body) > MAX_CACHE_BYTES) return;
      const directory = path.dirname(this.filePath);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
        || (process.getuid && stat.uid !== process.getuid())) return;
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(body); } finally { await handle.close(); }
      await rename(temporary, this.filePath);
    } catch { /* Cache failure must never break discovery or priority state. */ }
    finally { await unlink(temporary).catch(() => undefined); }
  }
}

const text = z.string().max(4096);
const projectionSchema = z.object({
  version: z.literal(1), scope: z.string(), preferences: z.string(), savedAt: z.number().finite(),
  configuration: z.string().optional(),
  // Zod deliberately strips every unlisted field, including commands, reviews and provider payloads.
  threads: z.array(z.object({
    id: text, sourceId: text, sourceName: text, title: text, project: text,
    updatedAt: z.number().finite().nonnegative(), status: text, deepLink: text,
    allowedDeepLinkSchemes: z.array(z.string().max(64)).max(32).optional(),
  })).max(8000),
  sources: z.array(z.object({
    id: text, name: text, kind: z.enum(["builtin", "configured"]),
    state: z.enum(["ready", "disabled", "not-installed", "not-configured", "error"]),
    enabled: z.boolean(), threadCount: z.number().int().nonnegative(),
  })).max(36),
});

export class ThreadMetadataCache {
  private readonly file: PrivateMetadataFile;
  constructor(private readonly env: NodeJS.ProcessEnv = process.env, private readonly now = Date.now) {
    this.file = new PrivateMetadataFile("threads.v1.json", resolveDataDirectory(env));
  }
  async configuration(): Promise<string> {
    const file = await stat(resolveSourcesConfigPath(this.env)).then(s => [s.ino, s.size, s.mtimeMs, s.ctimeMs], () => null);
    return metadataHash(file);
  }
  async save(preferences: PriorityStore["sourcePreferences"], collection: SourceCollection, startedConfiguration?: string): Promise<void> {
    if (this.env.GAJENDRA_METADATA_CACHE === "off") return;
    // Keep the last healthy projection when discovery fails. Stale data is only served explicitly.
    if (collection.error || collection.sources.some(source => source.enabled && source.state === "error")) return;
    const configuration = await this.configuration();
    if (startedConfiguration !== undefined && configuration !== startedConfiguration) return;
    const parsed = projectionSchema.safeParse({ version: 1, scope: await cacheScope(this.env), configuration,
      preferences: preferenceHash(preferences), savedAt: this.now(), ...collection });
    if (parsed.success) await this.file.write(parsed.data);
  }
  async load(preferences: PriorityStore["sourcePreferences"]): Promise<{ collection: SourceCollection; savedAt: string } | null> {
    if (this.env.GAJENDRA_METADATA_CACHE === "off") return null;
    const parsed = projectionSchema.safeParse(await this.file.read());
    if (!parsed.success) return null;
    const value = parsed.data;
    const age = this.now() - value.savedAt;
    // One day's launch cache matches the daily widget workflow; it never expires saved priorities.
    if (age < 0 || age > 24 * 60 * 60 * 1000 || value.scope !== await cacheScope(this.env)
      || value.configuration !== await this.configuration()
      || value.preferences !== preferenceHash(preferences)) return null;
    return { savedAt: new Date(value.savedAt).toISOString(), collection: {
      // Cached activity must not appear as a currently running process or a fresh completion claim.
      threads: value.threads.map(thread => ({ ...thread, allowedDeepLinkSchemes: thread.allowedDeepLinkSchemes ?? [], status: "cached" })),
      sources: value.sources.map(source => ({ ...source, detail: null })), error: null,
    } };
  }
}

function preferenceHash(preferences: Record<string, boolean>): string {
  return metadataHash(Object.entries(preferences).sort(([a], [b]) => a.localeCompare(b)));
}

export type CachedReview = { fingerprint: string; checkedAt: number; completedAt: number | null };
const activityMarkerSchema = z.object({ version: z.literal(1), activityRevision: z.string().uuid() }).strict();

/** One replaceable invalidation token, never a provider event log or workflow authority. */
export class LifecycleInvalidationCache {
  private readonly file: PrivateMetadataFile;
  constructor(directory = resolveDataDirectory()) {
    this.file = new PrivateMetadataFile("lifecycle.v1.json", directory);
  }
  async read(): Promise<string | undefined> {
    const parsed = activityMarkerSchema.safeParse(await this.file.read());
    return parsed.success ? parsed.data.activityRevision : undefined;
  }
  async invalidate(): Promise<void> {
    await this.file.write({ version: 1, activityRevision: randomUUID() });
  }
}

const reviewCacheSchema = z.object({ version: z.literal(1), scope: z.string(), activityRevision: z.string().uuid().optional(),
  entries: z.array(z.tuple([z.string().regex(/^[a-f0-9]{64}$/u), z.object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u), checkedAt: z.number().finite(),
    completedAt: z.number().int().positive().nullable(),
  })])).max(200),
});

export class CodexReviewCache {
  private readonly file: PrivateMetadataFile;
  private readonly invalidation: LifecycleInvalidationCache;
  private loadedActivityRevision: string | undefined;
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {
    this.file = new PrivateMetadataFile("codex-reviews.v1.json", resolveDataDirectory(env));
    this.invalidation = new LifecycleInvalidationCache(resolveDataDirectory(env));
  }
  async load(): Promise<Map<string, CachedReview>> {
    // Capture before loading/checking. An event during provider work must invalidate its later save.
    this.loadedActivityRevision = await this.invalidation.read();
    const parsed = reviewCacheSchema.safeParse(await this.file.read());
    return new Map(parsed.success && parsed.data.scope === await cacheScope(this.env)
      && parsed.data.activityRevision === this.loadedActivityRevision ? parsed.data.entries : []);
  }
  async save(entries: Map<string, CachedReview>): Promise<void> {
    await this.file.write({ version: 1, scope: await cacheScope(this.env),
      ...(this.loadedActivityRevision ? { activityRevision: this.loadedActivityRevision } : {}), entries: [...entries].slice(0, 200) });
  }
}
