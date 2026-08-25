import { chmod, mkdir, open, readdir, rename, rmdir, stat, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  DEFAULT_IDEMPOTENCY_LEDGER_LIMIT,
  DEFAULT_REVIEW_ACKNOWLEDGEMENT_LIMIT,
  EMPTY_STORE,
  type PriorityStore,
} from "../shared/contracts.js";
import { normalizeStore } from "./domain.js";

const DEFAULT_MAX_STORE_BYTES = 512 * 1024;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const RECOVERY_REQUIRED_MARKER = { recoveryRequired: true } as const;
const LOCK_OWNER_FILE = "owner.json";
const LOCK_RECLAIM_FILE = ".reclaiming";
const MAX_LOCK_RECORD_BYTES = 4 * 1024;

export type StoreOptions = {
  maxStoreBytes?: number;
  lockTimeoutMs?: number;
  staleLockMs?: number;
  idempotencyLimit?: number;
  reviewAcknowledgementLimit?: number;
  /** Deterministic interleaving hook used only by the lock regression suite. */
  onStaleLockCandidate?: (lockPath: string) => Promise<void> | void;
  /** Pauses a fully private candidate before it is atomically published as the fixed lock path. */
  onBeforeLockPublish?: () => Promise<void> | void;
  /** Process-fault hook used only to verify atomic primary/LKG transitions in the regression suite. */
  onPrimaryWritten?: () => Promise<void> | void;
};

export type StoreTransaction<T> = {
  value: T;
  next?: PriorityStore;
};

type StoredRead =
  | { kind: "valid"; raw: unknown; store: PriorityStore }
  | { kind: "missing" }
  | { kind: "invalid" }
  | { kind: "recovery-marker" };

type LockOwner = {
  token: string;
  pid: number;
  createdAt: number;
};

export class StoreRecoveryError extends Error {
  constructor() {
    super("Gajendra priority state needs recovery. The previous state was preserved privately.");
    this.name = "StoreRecoveryError";
  }
}

export class StoreBusyError extends Error {
  constructor() {
    super("Gajendra priority state is busy. Refresh and try the change again.");
    this.name = "StoreBusyError";
  }
}

/**
 * Atomic rename protects a single file. The owner-private lock also protects the surrounding
 * read-modify-write transaction when stdio, web, and short-lived companion processes overlap.
 */
export class GajendraStoreRepository {
  readonly filePath: string;
  readonly legacyFilePaths: string[];
  readonly backupPath: string;
  readonly lockPath: string;
  readonly recoveryMarkerPath: string;
  readonly maxStoreBytes: number;
  readonly lockTimeoutMs: number;
  readonly staleLockMs: number;
  readonly idempotencyLimit: number;
  readonly reviewAcknowledgementLimit: number;
  private readonly onStaleLockCandidate: StoreOptions["onStaleLockCandidate"];
  private readonly onBeforeLockPublish: StoreOptions["onBeforeLockPublish"];
  private readonly onPrimaryWritten: StoreOptions["onPrimaryWritten"];

  constructor(dataDirectory?: string, legacyFilePaths?: string[] | null, options: StoreOptions = {}) {
    const usesDefaultDirectory = dataDirectory === undefined;
    const resolvedDirectory = dataDirectory ?? resolveDataDirectory();
    this.filePath = path.join(resolvedDirectory, "gajendra.v2.json");
    this.backupPath = path.join(resolvedDirectory, "gajendra.v2.last-known-good.json");
    this.lockPath = path.join(resolvedDirectory, ".gajendra.v2.lock");
    this.recoveryMarkerPath = path.join(resolvedDirectory, ".gajendra.v2.recovery-required");
    this.legacyFilePaths = legacyFilePaths === undefined && usesDefaultDirectory
      ? resolveLegacyStateFiles()
      : legacyFilePaths ?? [];
    this.maxStoreBytes = positiveInteger(options.maxStoreBytes, DEFAULT_MAX_STORE_BYTES);
    this.lockTimeoutMs = positiveInteger(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS);
    this.staleLockMs = Math.max(this.lockTimeoutMs, positiveInteger(options.staleLockMs, DEFAULT_STALE_LOCK_MS));
    this.idempotencyLimit = positiveInteger(options.idempotencyLimit, DEFAULT_IDEMPOTENCY_LEDGER_LIMIT);
    this.reviewAcknowledgementLimit = Math.min(
      positiveInteger(options.reviewAcknowledgementLimit, DEFAULT_REVIEW_ACKNOWLEDGEMENT_LIMIT),
      DEFAULT_REVIEW_ACKNOWLEDGEMENT_LIMIT,
    );
    this.onStaleLockCandidate = options.onStaleLockCandidate;
    this.onBeforeLockPublish = options.onBeforeLockPublish;
    this.onPrimaryWritten = options.onPrimaryWritten;
  }

  async read(): Promise<PriorityStore> {
    return this.withLock(async () => this.readUnsafe());
  }

  async write(store: PriorityStore): Promise<void> {
    await this.withLock(async () => {
      await this.writeUnsafe(store);
    });
  }

  async transaction<T>(operation: (current: PriorityStore) => Promise<StoreTransaction<T>> | StoreTransaction<T>): Promise<T> {
    return this.withLock(async () => {
      const current = await this.readUnsafe();
      const transaction = await operation(structuredClone(current));
      if (transaction.next) await this.writeUnsafe(transaction.next);
      return transaction.value;
    });
  }

  private async readUnsafe(): Promise<PriorityStore> {
    const primary = await this.readStoredFileUnsafe(this.filePath, "primary");
    if (await this.hasRecoveryMarkerUnsafe()) return this.resumeRecoveryUnsafe(primary);
    if (primary.kind === "valid") {
      if (hasLegacyIdempotencyKey(primary.raw)) await this.writeUnsafe(primary.store);
      return primary.store;
    }
    if (primary.kind === "missing") {
      if (await this.hasQuarantinedPrimaryUnsafe()) throw new StoreRecoveryError();
      return this.readLegacyOrEmptyUnsafe();
    }
    return this.recoverInvalidPrimaryUnsafe(primary);
  }

  private async readLegacyOrEmptyUnsafe(): Promise<PriorityStore> {
    for (const legacyFilePath of this.legacyFilePaths) {
      const legacy = await this.readStoredFileUnsafe(legacyFilePath, "legacy");
      if (legacy.kind === "missing") continue;
      if (legacy.kind !== "valid") throw new StoreRecoveryError();
      await this.writeUnsafe(legacy.store);
      return legacy.store;
    }
    return structuredClone(EMPTY_STORE);
  }

  private async recoverInvalidPrimaryUnsafe(primary: StoredRead): Promise<PriorityStore> {
    await this.ensurePrivateDirectory();
    await this.writeRecoveryMarkerUnsafe();
    if (primary.kind !== "missing" && primary.kind !== "recovery-marker") await this.quarantinePrimaryUnsafe();
    return this.restoreLastKnownGoodUnsafe();
  }

  /**
   * A marker is written before recovery mutates the primary. A crash can therefore leave either
   * a valid replacement primary or only the private LKG. Re-check both on every later read so a
   * completed restoration is finalized, while an invalid pair remains fail-closed.
   */
  private async resumeRecoveryUnsafe(primary: StoredRead): Promise<PriorityStore> {
    if (primary.kind === "valid") {
      await unlink(this.recoveryMarkerPath).catch((error: unknown) => {
        if (!isMissing(error)) throw error;
      });
      return primary.store;
    }
    if (primary.kind !== "missing" && primary.kind !== "recovery-marker") await this.quarantinePrimaryUnsafe();
    return this.restoreLastKnownGoodUnsafe();
  }

  private async restoreLastKnownGoodUnsafe(): Promise<PriorityStore> {
    const backup = await this.readStoredFileUnsafe(this.backupPath, "backup");
    if (backup.kind !== "valid") {
      await this.writeRecoveryRequiredPrimaryUnsafe();
      throw new StoreRecoveryError();
    }
    await this.writeMainUnsafe(backup.store);
    await unlink(this.recoveryMarkerPath).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
    return backup.store;
  }

  private async quarantinePrimaryUnsafe(): Promise<void> {
    const quarantinePath = path.join(
      path.dirname(this.filePath),
      `gajendra.v2.corrupt-${Date.now()}-${randomUUID()}.json`,
    );
    try {
      await rename(this.filePath, quarantinePath);
      await chmod(quarantinePath, 0o600);
    } catch (error) {
      if (!isMissing(error)) throw new StoreRecoveryError();
    }
  }

  private async readStoredFileUnsafe(filePath: string, purpose: "primary" | "backup" | "legacy"): Promise<StoredRead> {
    let raw: string;
    try {
      raw = await this.readBoundedFile(filePath);
    } catch (error) {
      if (isMissing(error)) return { kind: "missing" };
      if (error instanceof StoreRecoveryError) return { kind: "invalid" };
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return { kind: "invalid" };
    }
    if (isRecoveryRequiredMarker(parsed)) return { kind: "recovery-marker" };
    if (!hasKnownStoreShape(parsed, purpose)) return { kind: "invalid" };
    return { kind: "valid", raw: parsed, store: normalizeStore(parsed) };
  }

  private async writeRecoveryMarkerUnsafe(): Promise<void> {
    await this.writePrivateFile(this.recoveryMarkerPath, `${JSON.stringify(RECOVERY_REQUIRED_MARKER)}\n`);
  }

  private async writeRecoveryRequiredPrimaryUnsafe(): Promise<void> {
    await this.writePrivateFile(this.filePath, `${JSON.stringify(RECOVERY_REQUIRED_MARKER)}\n`);
  }

  private async hasRecoveryMarkerUnsafe(): Promise<boolean> {
    try {
      await stat(this.recoveryMarkerPath);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw new StoreRecoveryError();
    }
  }

  private async hasQuarantinedPrimaryUnsafe(): Promise<boolean> {
    try {
      return (await readdir(path.dirname(this.filePath))).some((name) => /^gajendra\.v2\.corrupt-.+\.json$/u.test(name));
    } catch (error) {
      if (isMissing(error)) return false;
      throw new StoreRecoveryError();
    }
  }

  private async writeUnsafe(store: PriorityStore): Promise<void> {
    const normalized = normalizeStore({
      ...store,
      idempotency: store.idempotency.slice(-this.idempotencyLimit),
      reviewAcknowledgements: store.reviewAcknowledgements.slice(-this.reviewAcknowledgementLimit),
    });
    const contents = `${JSON.stringify(normalized, null, 2)}\n`;
    if (Buffer.byteLength(contents) > this.maxStoreBytes) throw new StoreRecoveryError();
    await this.ensurePrivateDirectory();
    await this.writeMainUnsafe(normalized, contents);
    // The primary has already crossed an atomic rename boundary here. A fatal process loss before
    // the LKG refresh therefore leaves a complete old or complete new state, never a half move.
    await this.onPrimaryWritten?.();
    await this.writePrivateFile(this.backupPath, contents);
  }

  private async writeMainUnsafe(store: PriorityStore, contents?: string): Promise<void> {
    const serialized = contents ?? `${JSON.stringify(normalizeStore(store), null, 2)}\n`;
    if (Buffer.byteLength(serialized) > this.maxStoreBytes) throw new StoreRecoveryError();
    await this.writePrivateFile(this.filePath, serialized);
  }

  private async writePrivateFile(destination: string, contents: string): Promise<void> {
    const directory = path.dirname(destination);
    const temporaryPath = path.join(directory, `.gajendra.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, destination);
    await chmod(destination, 0o600);
  }

  private async readBoundedFile(filePath: string): Promise<string> {
    const handle = await open(filePath, "r");
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile()) throw new StoreRecoveryError();
      const buffer = Buffer.alloc(this.maxStoreBytes + 1);
      let offset = 0;
      while (offset < buffer.length) {
        const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset > this.maxStoreBytes) throw new StoreRecoveryError();
      return buffer.subarray(0, offset).toString("utf8");
    } finally {
      await handle.close();
    }
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensurePrivateDirectory();
    const deadline = Date.now() + this.lockTimeoutMs;
    let owner: LockOwner | null = null;
    while (!owner) {
      owner = await this.tryAcquireLockUnsafe();
      if (owner) break;
      await this.recoverStaleLockUnsafe();
      if (Date.now() >= deadline) throw new StoreBusyError();
      await delay(12 + Math.floor(Math.random() * 18));
    }
    try {
      return await operation();
    } finally {
      await this.releaseLockUnsafe(owner);
    }
  }

  /**
   * The lock is a directory instead of a replaceable file. A stale cleaner first claims a file
   * *inside that directory*, then revalidates the owner token. A new owner cannot acquire until
   * the old directory is removed, and a cleaner which raced a replacement sees a different token
   * and only drops its own claim. This closes the file rename/unlink TOCTOU from the old lock.
   */
  private async tryAcquireLockUnsafe(): Promise<LockOwner | null> {
    const owner: LockOwner = { token: randomUUID(), pid: process.pid, createdAt: Date.now() };
    const candidatePath = this.lockCandidatePath(owner);
    let candidateCreated = false;
    let published = false;
    try {
      // Populate a private sibling first, then atomically publish it. The fixed lock path is
      // consequently never observable as an ownerless directory (or an empty owner file), even
      // if this process is suspended between filesystem operations for longer than staleLockMs.
      try {
        await mkdir(candidatePath, { mode: 0o700 });
        candidateCreated = true;
      } catch (error) {
        if (isExists(error)) return null;
        throw error;
      }
      await chmod(candidatePath, 0o700);
      await this.onBeforeLockPublish?.();
      await this.writeLockRecordUnsafe(path.join(candidatePath, LOCK_OWNER_FILE), owner);
      try {
        await rename(candidatePath, this.lockPath);
      } catch (error) {
        if (isExists(error) || isNotEmpty(error)) return null;
        throw error;
      }
      published = true;
      return owner;
    } finally {
      if (candidateCreated && !published) await this.discardLockCandidateUnsafe(candidatePath);
    }
  }

  private async releaseLockUnsafe(owner: LockOwner): Promise<void> {
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      const current = await this.readLockRecordUnsafe(this.lockOwnerPath());
      if (!sameLockOwner(current, owner)) return;
      if (await this.reclaimGuardBlocksUnsafe()) {
        if (Date.now() >= deadline) return;
        await delay(8);
        continue;
      }
      // A cleaner may have claimed the directory between the first owner read and this point.
      if (!sameLockOwner(await this.readLockRecordUnsafe(this.lockOwnerPath()), owner)) return;
      try {
        await unlink(this.lockOwnerPath());
        await rmdir(this.lockPath);
        return;
      } catch (error) {
        if (isMissing(error)) return;
        if (isNotEmpty(error) && Date.now() < deadline) {
          await delay(8);
          continue;
        }
        if (isNotEmpty(error)) return;
        throw error;
      }
    }
  }

  private async recoverStaleLockUnsafe(): Promise<void> {
    let metadata;
    try {
      metadata = await stat(this.lockPath);
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    // Do not attempt a destructive upgrade of a pre-directory lock. Waiting is fail-closed and
    // lets an older live service release its own file without risking cross-version data loss.
    if (!metadata.isDirectory()) return;
    if (await this.reclaimGuardBlocksUnsafe()) return;
    if (Date.now() - metadata.mtimeMs < this.staleLockMs) return;
    const candidate = await this.readLockRecordUnsafe(this.lockOwnerPath());
    if (candidate && isProcessAlive(candidate.pid)) return;
    await this.onStaleLockCandidate?.(this.lockPath);
    const claim: LockOwner = { token: randomUUID(), pid: process.pid, createdAt: Date.now() };
    let claimed = false;
    try {
      await this.writeLockRecordUnsafe(this.lockReclaimPath(), claim);
      claimed = true;
    } catch (error) {
      if (isMissing(error) || isExists(error)) return;
      throw error;
    }
    try {
      const owner = await this.readLockRecordUnsafe(this.lockOwnerPath());
      // Re-check after the exclusive in-directory claim. This is the critical ownership guard:
      // an old cleaner can never retire a directory that a new owner created meanwhile.
      if (!sameLockIdentity(owner, candidate) || (owner && isProcessAlive(owner.pid))) return;
      await unlink(this.lockOwnerPath()).catch((error: unknown) => {
        if (!isMissing(error)) throw error;
      });
      await unlink(this.lockReclaimPath());
      claimed = false;
      await rmdir(this.lockPath).catch((error: unknown) => {
        if (!isMissing(error) && !isNotEmpty(error)) throw error;
      });
    } finally {
      if (claimed) {
        await unlink(this.lockReclaimPath()).catch((error: unknown) => {
          if (!isMissing(error)) throw error;
        });
      }
    }
  }

  private async reclaimGuardBlocksUnsafe(): Promise<boolean> {
    let metadata;
    try {
      metadata = await stat(this.lockReclaimPath());
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
    const guard = await this.readLockRecordUnsafe(this.lockReclaimPath());
    if (Date.now() - metadata.mtimeMs < this.staleLockMs || (guard && isProcessAlive(guard.pid))) return true;
    // A cleaner can die after claiming the directory. Retire only its in-directory guard, then
    // restart normal owner-token validation before any enclosing lock removal.
    await unlink(this.lockReclaimPath()).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
    return false;
  }

  private lockOwnerPath(): string {
    return path.join(this.lockPath, LOCK_OWNER_FILE);
  }

  private lockReclaimPath(): string {
    return path.join(this.lockPath, LOCK_RECLAIM_FILE);
  }

  private lockCandidatePath(owner: LockOwner): string {
    return `${this.lockPath}.candidate-${owner.token}`;
  }

  private async discardLockCandidateUnsafe(candidatePath: string): Promise<void> {
    await unlink(path.join(candidatePath, LOCK_OWNER_FILE)).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
    await rmdir(candidatePath).catch((error: unknown) => {
      if (!isMissing(error) && !isNotEmpty(error)) throw error;
    });
  }

  private async writeLockRecordUnsafe(destination: string, record: LockOwner): Promise<void> {
    const handle = await open(destination, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(record)}\n`);
    } finally {
      await handle.close();
    }
    await chmod(destination, 0o600);
  }

  private async readLockRecordUnsafe(filePath: string): Promise<LockOwner | null> {
    let handle;
    try {
      handle = await open(filePath, "r");
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.size > MAX_LOCK_RECORD_BYTES) return null;
      const buffer = Buffer.alloc(metadata.size);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const raw = buffer.subarray(0, bytesRead).toString("utf8");
      const parsed = JSON.parse(raw) as unknown;
      return isLockOwner(parsed) ? parsed : null;
    } catch {
      return null;
    } finally {
      await handle.close();
    }
  }

  private async ensurePrivateDirectory(): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
  }
}

export function resolveDataDirectory(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GAJENDRA_DATA_DIR) return path.resolve(env.GAJENDRA_DATA_DIR);
  if (env.PLUGIN_DATA) return path.resolve(env.PLUGIN_DATA);
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Gajendra");
  const configHome = env.XDG_CONFIG_HOME ? path.resolve(env.XDG_CONFIG_HOME) : path.join(os.homedir(), ".config");
  return path.join(configHome, "gajendra");
}

export function resolveLegacyStateFiles(env: NodeJS.ProcessEnv = process.env): string[] {
  // An explicit Gajendra data root is commonly a test, host, or isolated runtime boundary. Do
  // not reach into the user's legacy Codex tree unless the caller supplies legacyFilePaths.
  if (env.GAJENDRA_DATA_DIR) return [];
  if (env.PLUGIN_DATA && !env.GAJENDRA_DATA_DIR) {
    return ["gajendra.v1.json", "aadi.v1.json", "priority-deck.v1.json"].map((file) => path.join(path.resolve(env.PLUGIN_DATA as string), file));
  }
  const codexHome = env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(os.homedir(), ".codex");
  const candidates = [
    path.join(codexHome, "aadi", "aadi.v1.json"),
    path.join(codexHome, "priority-deck", "priority-deck.v1.json"),
  ];
  if (env.AADI_DATA_DIR) candidates.unshift(path.join(path.resolve(env.AADI_DATA_DIR), "aadi.v1.json"));
  if (env.PRIORITY_DECK_DATA_DIR) candidates.unshift(path.join(path.resolve(env.PRIORITY_DECK_DATA_DIR), "priority-deck.v1.json"));
  return candidates;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error && typeof error === "object" && "code" in error && error.code === "ESRCH");
  }
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}

function isNotEmpty(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOTEMPTY");
}

function isRecoveryRequiredMarker(value: unknown): boolean {
  return Boolean(value
    && typeof value === "object"
    && "recoveryRequired" in value
    && value.recoveryRequired === true);
}

function hasLegacyIdempotencyKey(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("idempotency" in value) || !Array.isArray(value.idempotency)) return false;
  return value.idempotency.some((receipt) => receipt && typeof receipt === "object" && Object.hasOwn(receipt, "key"));
}

function hasKnownStoreShape(value: unknown, purpose: "primary" | "backup" | "legacy"): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const version = candidate.version;
  if (version !== 1 && version !== 2 && version !== 3) return false;
  if (purpose === "backup" && version !== 3) return false;
  if (typeof candidate.currentFocusThreadId !== "string" && candidate.currentFocusThreadId !== null) return false;
  if (!Array.isArray(candidate.entries) || !candidate.entries.every(isStrictStoredEntry)) return false;
  const entryIds = candidate.entries.map((entry) => (entry as { threadId: string }).threadId);
  if (new Set(entryIds).size !== entryIds.length) return false;
  if (!isCollapsedShape(candidate.collapsed)) return false;
  if (version >= 2 && !isSourcePreferencesShape(candidate.sourcePreferences)) return false;
  if (version === 3) {
    if (!isRevision(candidate.revision) || !Array.isArray(candidate.idempotency) || !candidate.idempotency.every(isStrictReceipt)) return false;
    if (candidate.reviewAcknowledgements !== undefined
      && (!Array.isArray(candidate.reviewAcknowledgements)
        || candidate.reviewAcknowledgements.length > DEFAULT_REVIEW_ACKNOWLEDGEMENT_LIMIT
        || !candidate.reviewAcknowledgements.every(isStrictReviewAcknowledgement))) return false;
  }
  return true;
}

function isStrictReviewAcknowledgement(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  return typeof receipt.threadHash === "string"
    && /^[a-f0-9]{64}$/iu.test(receipt.threadHash)
    && typeof receipt.signalHash === "string"
    && /^[a-f0-9]{64}$/iu.test(receipt.signalHash);
}

function isStrictStoredEntry(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.threadId === "string"
    && entry.threadId.length > 0
    && (entry.level === "focus" || entry.level === "important")
    && typeof entry.addedAt === "string"
    && (entry.context === undefined || entry.context === "design" || entry.context === "engineering" || entry.context === "life");
}

function isCollapsedShape(value: unknown): boolean {
  return Boolean(value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as Record<string, unknown>).focus !== undefined
    && (value as Record<string, unknown>).important !== undefined
    && typeof (value as Record<string, unknown>).focus === "boolean"
    && typeof (value as Record<string, unknown>).important === "boolean");
}

function isSourcePreferencesShape(value: unknown): boolean {
  return Boolean(value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.entries(value).every(([sourceId, enabled]) => sourceId.trim().length > 0 && typeof enabled === "boolean"));
}

function isStrictReceipt(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const receipt = value as Record<string, unknown>;
  const validKey = (typeof receipt.keyHash === "string" && /^[a-f0-9]{64}$/iu.test(receipt.keyHash))
    || (typeof receipt.key === "string" && receipt.key.length > 0 && receipt.key.length <= 256);
  return validKey
    && typeof receipt.fingerprint === "string"
    && /^[a-f0-9]{64}$/iu.test(receipt.fingerprint)
    && isRevision(receipt.revision);
}

function isRevision(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isLockOwner(value: unknown): value is LockOwner {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.token === "string"
    && candidate.token.length > 0
    && typeof candidate.pid === "number"
    && Number.isSafeInteger(candidate.pid)
    && candidate.pid > 0
    && typeof candidate.createdAt === "number"
    && Number.isFinite(candidate.createdAt);
}

function sameLockOwner(left: LockOwner | null, right: LockOwner | null): boolean {
  return left !== null && right !== null && left.token === right.token;
}

function sameLockIdentity(left: LockOwner | null, right: LockOwner | null): boolean {
  return left?.token === right?.token;
}
