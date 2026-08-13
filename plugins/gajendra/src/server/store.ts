import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { EMPTY_STORE, type PriorityStore } from "../shared/contracts.js";
import { normalizeStore } from "./domain.js";

export class GajendraStoreRepository {
  readonly filePath: string;
  readonly legacyFilePaths: string[];

  constructor(dataDirectory?: string, legacyFilePaths?: string[] | null) {
    const usesDefaultDirectory = dataDirectory === undefined;
    const resolvedDirectory = dataDirectory ?? resolveDataDirectory();
    this.filePath = path.join(resolvedDirectory, "gajendra.v2.json");
    this.legacyFilePaths = legacyFilePaths === undefined && usesDefaultDirectory
      ? resolveLegacyStateFiles()
      : legacyFilePaths ?? [];
  }

  async read(): Promise<PriorityStore> {
    try {
      return normalizeStore(JSON.parse(await readFile(this.filePath, "utf8")) as unknown);
    } catch (error) {
      if (isMissing(error)) return this.readLegacyOrEmpty();
      throw error;
    }
  }

  private async readLegacyOrEmpty(): Promise<PriorityStore> {
    for (const legacyFilePath of this.legacyFilePaths) {
      try {
        const legacy = normalizeStore(JSON.parse(await readFile(legacyFilePath, "utf8")) as unknown);
        await this.write(legacy);
        return legacy;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return structuredClone(EMPTY_STORE);
  }

  async write(store: PriorityStore): Promise<void> {
    const directory = path.dirname(this.filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const temporaryPath = path.join(directory, `.gajendra.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(normalizeStore(store), null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
    await chmod(this.filePath, 0o600);
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

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
