import type { DeckMutation, DeckSnapshot } from "../shared/contracts.js";
import { applyMutation, buildSnapshot } from "./domain.js";
import { GajendraStoreRepository } from "./store.js";
import { ThreadSourceRegistry, type SourceCollection } from "./thread-sources.js";

type SourceRegistry = Pick<ThreadSourceRegistry, "collect" | "close">;

export class GajendraService {
  constructor(
    private readonly store = new GajendraStoreRepository(),
    private readonly sources: SourceRegistry = new ThreadSourceRegistry(),
  ) {}

  async snapshot(): Promise<DeckSnapshot> {
    const state = await this.store.read();
    let collection: SourceCollection;
    try {
      collection = await this.sources.collect(state.sourcePreferences);
    } catch (error) {
      collection = { threads: [], sources: [], error: readableError(error) };
    }
    return buildSnapshot(state, collection.threads, collection.sources, collection.error);
  }

  async mutate(mutation: DeckMutation): Promise<DeckSnapshot> {
    const before = await this.store.read();
    await this.store.write(applyMutation(before, mutation));
    return this.snapshot();
  }

  close(): Promise<void> {
    return this.sources.close();
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to read configured agent threads.";
}
