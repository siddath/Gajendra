import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { backendDirectory } from "../../src/server/shared-backend.js";
import { EMPTY_STORE, type DeckSnapshot } from "../../src/shared/contracts.js";

it("shares a private owner between CLI and MCP, preserves CAS/replay, and recovers after owner shutdown", async () => {
  if (process.platform === "win32") return;
  const dir = await mkdtemp(path.join(os.tmpdir(), "gajendra-broker-test-"));
  const executable = path.join(dir, "server.mjs");
  const env = { ...process.env, GAJENDRA_DATA_DIR: dir, GAJENDRA_CODEX_BIN: "/usr/bin/false",
    GAJENDRA_SOURCES_CONFIG: path.join(dir, "sources.json") };
  let runtime: string | undefined;
  const client = new Client({ name: "synthetic-cache-test", version: "1" });
  async function killOwner() {
    if (!runtime) return;
    const pid = Number(await readFile(path.join(runtime, "pid"), "utf8"));
    try { process.kill(pid, "SIGTERM"); } catch {}
    for (let i = 0; i < 300; i++) {
      try { process.kill(pid, 0); }
      catch { return; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error("Synthetic backend did not stop");
  }
  try {
    await build({ entryPoints: [path.resolve("src/server/index.ts")], outfile: executable, bundle: true,
      platform: "node", format: "esm", target: "node20", logLevel: "silent",
      banner: { js: 'import { createRequire as __createRequire } from "module"; const require = __createRequire(import.meta.url);' } });
    await writeFile(path.join(dir, "gajendra.v2.json"), JSON.stringify({ ...EMPTY_STORE,
      sourcePreferences: { codex: false, claude: false, cursor: false, grok: false } }), { mode: 0o600 });
    await writeFile(env.GAJENDRA_SOURCES_CONFIG, JSON.stringify({ version: 1, sources: [{ id: "synthetic", name: "Synthetic",
      enabled: true, catalog: path.join(dir, "threads.json"), deepLinkSchemes: ["synthetic"] }] }));
    await writeFile(path.join(dir, "threads.json"), JSON.stringify({ version: 1, threads: [{ id: "one", title: "Synthetic",
      project: "Synthetic", updatedAt: 100, status: "idle", deepLink: "synthetic://one" }] }));
    runtime = await backendDirectory(env, executable);
    const cli = async (flag: string) => JSON.parse((await promisify(execFile)(process.execPath, [executable, flag], { env, timeout: 10_000 })).stdout);
    const opened = await Promise.all([cli("--snapshot-json"), cli("--snapshot-json"), cli("--read-json")]);
    expect(opened.map(s => s.available[0]?.id)).toEqual(["synthetic:one", "synthetic:one", "synthetic:one"]);
    expect((await stat(runtime)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(runtime, "service.sock"))).mode & 0o777).toBe(0o600);
    const pid = await readFile(path.join(runtime, "pid"), "utf8");
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [executable, "--stdio"], env: env as Record<string, string> }));
    const args = { threadId: "synthetic:one", level: "focus", expectedRevision: 0, idempotencyKey: "synthetic-operation" };
    const result = await client.callTool({ name: "gajendra_set_level", arguments: args });
    expect(result.structuredContent).toMatchObject({ outcome: "applied", revision: 1 });
    const replay = await client.callTool({ name: "gajendra_set_level", arguments: args });
    expect(replay.structuredContent).toMatchObject({ outcome: "replayed", revision: 1 });
    const read: DeckSnapshot = await cli("--read-json");
    expect(read.focus[0]?.id).toBe("synthetic:one"); expect(read.revision).toBe(1);
    expect(await readFile(path.join(runtime, "pid"), "utf8")).toBe(pid);
    await client.close(); await killOwner();
    const restarted = await cli("--read-json");
    expect(restarted.focus[0]?.id).toBe("synthetic:one"); expect(restarted.revision).toBe(1);
    expect(await readFile(path.join(runtime, "pid"), "utf8")).not.toBe(pid);
    expect(await backendDirectory({ ...env, GAJENDRA_DATA_DIR: `${dir}-other` }, executable)).not.toBe(runtime);
  } finally {
    await client.close().catch(() => undefined); await killOwner().catch(() => undefined);
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
    if (runtime) await rm(runtime, { recursive: true, force: true });
  }
}, 30_000);
