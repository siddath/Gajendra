import { stat } from "node:fs/promises";
import { metadataHash } from "./metadata-cache.js";
import type { SourceCollection } from "./thread-sources.js";

/** One live, disposable read model. No provider responses or commands are written to disk. */
export class ThreadCatalog {
  revision = 0;
  private versions = new WeakMap<SourceCollection, number>();
  versionFor(collection: SourceCollection): number | undefined { return this.versions.get(collection); }
  private value?: { key: string; at: number; collection: SourceCollection };
  private pending = new Map<string, Promise<SourceCollection>>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly collect: (preferences: Record<string, boolean>, reviews: boolean) => Promise<SourceCollection>,
    private readonly epoch: () => Promise<string | undefined>, private readonly configPath: string,
    private readonly now = Date.now, private readonly maxAgeMs = 30_000) {}

  private async key(preferences: Record<string, boolean>): Promise<string> {
    const config = await stat(this.configPath).then(s => [s.ino, s.size, s.mtimeMs, s.ctimeMs], () => null);
    return metadataHash([Object.entries(preferences).sort(), await this.epoch(), config]);
  }

  async peek(preferences: Record<string, boolean>): Promise<SourceCollection | undefined> {
    const key = await this.key(preferences);
    const age = this.value ? this.now() - this.value.at : Infinity;
    return this.value?.key === key && age >= 0 && age < this.maxAgeMs ? this.value.collection : undefined;
  }

  async get(preferences: Record<string, boolean>, fresh: boolean, reviews = false): Promise<SourceCollection> {
    if (!fresh && !reviews) {
      const value = await this.peek(preferences);
      if (value) return value;
    }
    const key = await this.key(preferences);
    // Acknowledgements require evidence obtained after this request, never a pre-existing read.
    const existing = !reviews ? this.pending.get(key) : undefined;
    if (existing) return existing;
    const operation = this.tail.catch(() => undefined).then(async () => {
      const started = this.now();
      const collection = await this.collect(preferences, reviews);
      if (key === await this.key(preferences)) {
        const projection = { ...collection, threads: collection.threads.map(({ resumeCommand: _command, ...thread }) => thread) };
        this.value = { key, at: started, collection: projection };
        this.revision++;
        this.versions.set(collection, this.revision);
        this.versions.set(projection, this.revision);
      }
      return collection;
    });
    this.tail = operation.then(() => undefined, () => undefined);
    if (!reviews) this.pending.set(key, operation);
    try { return await operation; }
    finally { if (this.pending.get(key) === operation) this.pending.delete(key); }
  }
}
