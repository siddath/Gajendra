import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ingestLifecycleEvent, MAX_LIFECYCLE_INPUT_BYTES, parseLifecycleIdentity, readBoundedLifecycleInput } from "../../src/server/lifecycle-events.js";
import { CodexReviewCache, LifecycleInvalidationCache, metadataHash, ThreadMetadataCache } from "../../src/server/metadata-cache.js";
import { EMPTY_STORE } from "../../src/shared/contracts.js";
import { GajendraStoreRepository } from "../../src/server/store.js";
import { GajendraService } from "../../src/server/service.js";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "gajendra-hooks-")); dirs.push(dir);
  return { dir, env: { GAJENDRA_DATA_DIR: dir }, marker: new LifecycleInvalidationCache(dir) };
}
const event = (name = "Stop", extras = {}) => JSON.stringify({ session_id: "thread_123", hook_event_name: name, turn_id: "turn_456", ...extras });
const entry = { fingerprint: metadataHash("metadata"), checkedAt: Date.now(), completedAt: 100 };

describe("optional lifecycle invalidation", () => {
  it("projects only opaque event identity, stores no event content and never writes priorities", async () => {
    const f = await fixture(); const store = new GajendraStoreRepository(f.dir); await store.write(structuredClone(EMPTY_STORE));
    const before = await readFile(store.filePath, "utf8");
    const input = event("Stop", { prompt: "PRIVATE_PROMPT", last_assistant_message: "PRIVATE_RESULT", transcript_path: "/private/transcript", cwd: "/private/project" });
    expect(parseLifecycleIdentity(input)).toEqual({ sessionId: "thread_123", event: "Stop", turnId: "turn_456" });
    await ingestLifecycleEvent(input, f.env);
    expect(await readFile(store.filePath, "utf8")).toBe(before);
    const markerPath = path.join(f.dir, "metadata-cache/lifecycle.v1.json");
    const body = await readFile(markerPath, "utf8");
    expect(JSON.parse(body)).toEqual({ version: 1, activityRevision: await f.marker.read() });
    for (const forbidden of ["PRIVATE", "transcript", "thread_123", "turn_456", "Stop", "project"]) expect(body).not.toContain(forbidden);
    expect((await stat(markerPath)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(markerPath))).mode & 0o777).toBe(0o700);
  });

  it("rejects unknown events, malformed identity and oversized input without touching an existing epoch", async () => {
    const f = await fixture(); await ingestLifecycleEvent(event(), f.env); const before = await f.marker.read();
    for (const input of [event("PostToolUse"), event("Stop", { session_id: "../unsafe" }), event("Stop", { turn_id: "unsafe command" }), "[]", "bad-json",
      event("Stop", { prompt: "x".repeat(MAX_LIFECYCLE_INPUT_BYTES) })]) {
      expect(parseLifecycleIdentity(input)).toBeNull(); await ingestLifecycleEvent(input, f.env); expect(await f.marker.read()).toBe(before);
    }
    await ingestLifecycleEvent(event(), { ...f.env, GAJENDRA_METADATA_CACHE: "off" }); expect(await f.marker.read()).toBe(before);
  });

  it("invalidates only completion reuse; launch metadata and the priority authority survive", async () => {
    const f = await fixture(); const cache = new CodexReviewCache(f.env);
    await cache.load(); await cache.save(new Map([[metadataHash("thread_123"), entry]]));
    expect(await cache.load()).toHaveLength(1);
    const launch = new ThreadMetadataCache(f.env);
    await launch.save(EMPTY_STORE.sourcePreferences, { threads: [], sources: [], error: null });
    const launchPath = path.join(f.dir, "metadata-cache/threads.v1.json"); const before = await readFile(launchPath, "utf8");
    await ingestLifecycleEvent(event("SessionEnd"), f.env);
    expect(await new CodexReviewCache(f.env).load()).toHaveLength(0);
    expect(await readFile(launchPath, "utf8")).toBe(before);
    expect(await readdir(f.dir)).toEqual(["metadata-cache"]);
  });

  it("does not let a provider check racing a hook republish reusable stale completion evidence", async () => {
    const f = await fixture(); const inFlight = new CodexReviewCache(f.env);
    await inFlight.load(); await ingestLifecycleEvent(event(), f.env);
    await inFlight.save(new Map([[metadataHash("thread_123"), entry]]));
    const fresh = new CodexReviewCache(f.env); expect(await fresh.load()).toHaveLength(0);
    await fresh.save(new Map([[metadataHash("thread_123"), entry]])); expect(await new CodexReviewCache(f.env).load()).toHaveLength(1);
  });

  it("bounds event spam to one private file and exposes epoch changes without scanning sources", async () => {
    const f = await fixture(); let scans = 0;
    const service = new GajendraService(new GajendraStoreRepository(f.dir), { collect: async () => {
      scans += 1; return { threads: [], sources: [], error: null };
    }, close: async () => {} });
    const before = await service.sync();
    await Promise.all(Array.from({ length: 40 }, (_, i) => ingestLifecycleEvent(event("SessionStart", { session_id: `thread_${i}` }), f.env)));
    const after = await service.sync(); expect(after.revision).toBe(before.revision); expect(after.activityRevision).toBeTruthy(); expect(scans).toBe(0);
    expect(await readdir(path.join(f.dir, "metadata-cache"))).toEqual(["lifecycle.v1.json"]);
    expect((await stat(path.join(f.dir, "metadata-cache/lifecycle.v1.json"))).size).toBeLessThan(128);
    expect((await service.snapshot()).activityRevision).toBe(after.activityRevision); expect(scans).toBe(1);
  });

  it("fails open on unavailable storage and insecure permissions without correcting owner choices", async () => {
    const f = await fixture(); await ingestLifecycleEvent(event(), f.env); const before = await f.marker.read();
    await chmod(path.join(f.dir, "metadata-cache"), 0o755);
    await expect(ingestLifecycleEvent(event(), f.env)).resolves.toBeUndefined();
    await chmod(path.join(f.dir, "metadata-cache"), 0o700); expect(await f.marker.read()).toBe(before);
    const notDirectory = path.join(f.dir, "file"); await writeFile(notDirectory, "unchanged");
    await expect(ingestLifecycleEvent(event(), { GAJENDRA_DATA_DIR: notDirectory })).resolves.toBeUndefined();
    expect(await readFile(notDirectory, "utf8")).toBe("unchanged");
  });

  it("bounds bytes and waiting on stdin", async () => {
    expect(await readBoundedLifecycleInput(Readable.from([event()]))).toBe(event());
    expect(await readBoundedLifecycleInput(Readable.from(["x".repeat(MAX_LIFECYCLE_INPUT_BYTES + 1)]))).toBeNull();
    const idle = new PassThrough(); expect(await readBoundedLifecycleInput(idle, 10)).toBeNull(); idle.destroy();
  });

  it("packages only fixed lifecycle commands and uses the explicit runtime without evaluating stdin", async () => {
    const f = await fixture(); const hookFile = fileURLToPath(new URL("../../hooks/hooks.json", import.meta.url));
    const hooks = JSON.parse(await readFile(hookFile, "utf8")).hooks;
    expect(Object.keys(hooks)).toEqual(["SessionStart", "UserPromptSubmit", "Stop", "SessionEnd"]);
    for (const handlers of Object.values(hooks) as Array<Array<{ hooks: Array<{ command: string; timeout: number }> }>>) {
      expect(handlers).toEqual([{ hooks: [{ type: "command", command: '/bin/sh "${PLUGIN_ROOT}/hooks/lifecycle-event.sh"', timeout: 3 }] }]);
    }
    await mkdir(path.join(f.dir, "dist"));
    await writeFile(path.join(f.dir, "dist/server.mjs"), 'if (process.argv[2] !== "--lifecycle-event") process.exit(2); process.stdout.write("{}\\n");');
    const wrapper = fileURLToPath(new URL("../../hooks/lifecycle-event.sh", import.meta.url));
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile("/bin/sh", [wrapper], { env: { ...process.env, PLUGIN_ROOT: f.dir, GAJENDRA_NODE_BIN: process.execPath }, timeout: 3_000 },
        (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
      child.stdin!.on("error", () => {}); child.stdin!.end('$(touch should-never-run)');
    });
    expect(result).toEqual({ stdout: "{}\n", stderr: "" });
    expect(await readdir(f.dir)).toEqual(["dist"]);
  });

  it("the actual CLI emits harmless JSON for Stop, malformed input and oversized payloads", async () => {
    const f = await fixture();
    const index = fileURLToPath(new URL("../../src/server/index.ts", import.meta.url));
    const run = (input: string) => new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = execFile(process.execPath, ["--import", "tsx", index, "--lifecycle-event"], {
        env: { ...process.env, ...f.env }, timeout: 5_000, maxBuffer: 4096,
      }, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr }));
      child.stdin!.on("error", () => {}); child.stdin!.end(input);
    });
    expect(await run(event())).toEqual({ stdout: "{}\n", stderr: "" });
    const before = await f.marker.read();
    expect(await run("not-json")).toEqual({ stdout: "{}\n", stderr: "" });
    expect(await run("x".repeat(MAX_LIFECYCLE_INPUT_BYTES * 2))).toEqual({ stdout: "{}\n", stderr: "" });
    expect(await f.marker.read()).toBe(before);
  }, 20_000);
});
