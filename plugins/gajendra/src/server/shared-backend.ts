import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, lstat, mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cacheScope } from "./metadata-cache.js";
import { resolveDataDirectory } from "./store.js";

export type BackendCommand = "snapshot" | "cached-snapshot" | "read" | "sync" | "mutate";
type Request = { command: BackendCommand; input: string };
const REQUEST_LIMIT = 64 * 1024;
const RESPONSE_LIMIT = 4 * 1024 * 1024;
const REQUEST_TIMEOUT = 80_000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const code = (error: unknown) => (error as NodeJS.ErrnoException)?.code;

/** Same build + account/data/config scope shares an owner, regardless of bundle installation path. */
export async function backendDirectory(env = process.env, executable = fileURLToPath(import.meta.url)): Promise<string> {
  const build = createHash("sha256").update(await readFile(executable)).digest("hex");
  const signature = createHash("sha256").update(JSON.stringify([build, resolveDataDirectory(env), await cacheScope(env),
    Object.entries(env).filter(([key]) => /^GAJENDRA_(CODEX_|CLAUDE_|CURSOR_|GROK_|SOURCE_COLLECTION_|SOURCES_CONFIG_|REVIEW_CACHE_|METADATA_CACHE$)/u.test(key)).sort(),
  ])).digest("hex").slice(0, 24);
  // Short POSIX path avoids macOS's 104-byte Unix socket path limit, even for long test data roots.
  return path.join("/tmp", `gajendra-${process.getuid?.() ?? "local"}-${signature}`);
}

async function privateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { mode: 0o700 }).catch(error => { if (code(error) !== "EEXIST") throw error; });
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)
    || (process.getuid && stat.uid !== process.getuid())) throw new Error("Unsafe backend directory.");
}

async function connect(socketPath: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    const fail = (error: Error) => { socket.destroy(); reject(error); };
    socket.once("error", fail);
    socket.setTimeout(1_000, () => fail(new Error("Backend connection timed out.")));
    socket.once("connect", () => { socket.removeListener("error", fail); socket.setTimeout(0); resolve(socket); });
  });
}

async function readySocket(directory: string, executable: string, env: NodeJS.ProcessEnv): Promise<Socket> {
  const socketPath = path.join(directory, "service.sock");
  try { return await connect(socketPath); }
  catch (error) { if (!["ENOENT", "ECONNREFUSED"].includes(code(error) ?? "")) throw error; }
  const lock = path.join(directory, "start");
  const lockOwner = path.join(lock, "pid");
  let owner = false;
  try { await mkdir(lock, { mode: 0o700 }); owner = true; }
  catch (error) {
    if (code(error) !== "EEXIST") throw error;
    const candidate = await lstat(lock);
    const pid = Number(await readFile(lockOwner, "utf8").catch(() => ""));
    let alive = false;
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); alive = true; } catch (failure) { if (code(failure) !== "ESRCH") alive = true; }
    }
    if (!alive && Date.now() - candidate.mtimeMs > 10_000 && (await lstat(lock)).ino === candidate.ino) {
      await unlink(lockOwner).catch(failure => { if (code(failure) !== "ENOENT") throw failure; });
      await rmdir(lock).catch(() => undefined);
      return readySocket(directory, executable, env);
    }
  }
  if (owner) {
    try {
      await writeFile(lockOwner, String(process.pid), { mode: 0o600 });
      // Recheck after winning election: another starter may have just published the socket.
      try { return await connect(socketPath); } catch (error) {
        if (!["ENOENT", "ECONNREFUSED"].includes(code(error) ?? "")) throw error;
      }
      await unlink(socketPath).catch(error => { if (code(error) !== "ENOENT") throw error; });
      const child = spawn(process.execPath, [executable, "--shared-backend"], {
        env, detached: true, stdio: "ignore",
      });
      let spawnError: Error | undefined;
      child.on("error", error => { spawnError = error; });
      child.unref();
      for (let attempt = 0; attempt < 100; attempt++) {
        if (spawnError) throw spawnError;
        try { return await connect(socketPath); } catch (error) {
          if (!["ENOENT", "ECONNREFUSED"].includes(code(error) ?? "")) throw error;
        }
        await delay(50);
      }
      throw new Error("Backend startup timed out.");
    } finally { await unlink(lockOwner).catch(() => undefined); await rmdir(lock).catch(() => undefined); }
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    try { return await connect(socketPath); } catch (error) {
      if (!["ENOENT", "ECONNREFUSED"].includes(code(error) ?? "")) throw error;
    }
    await delay(50);
  }
  // Never steal a possibly active startup lock. A crashed starter is a recoverable explicit error.
  throw new Error("Backend is still starting. Retry the request.");
}

export async function callSharedBackend(command: BackendCommand, input = "", env = process.env): Promise<unknown> {
  const executable = fileURLToPath(import.meta.url);
  const directory = await backendDirectory(env, executable);
  await privateDirectory(directory);
  const body = JSON.stringify({ command, input }) + "\n";
  if (Buffer.byteLength(body) > REQUEST_LIMIT) throw new Error("Backend request too large.");
  const socket = await readySocket(directory, executable, env);
  // Once sent, never automatically replay or fall back to another writer after an uncertain result.
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0; let complete = false;
    const fail = () => { if (!complete) { complete = true; socket.destroy(); reject(new Error("Local backend request failed. Retry with the same operation key.")); } };
    socket.on("error", fail); socket.setTimeout(REQUEST_TIMEOUT, fail);
    socket.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > RESPONSE_LIMIT) return fail();
      chunks.push(chunk);
    });
    socket.on("end", () => {
      if (complete) return;
      try {
        const response = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { ok: boolean; value: unknown };
        if (response.ok !== true) return fail();
        complete = true; socket.destroy(); resolve(response.value);
      } catch { fail(); }
    });
    socket.on("close", () => { if (!complete) fail(); });
    socket.write(body);
  });
}

export async function serveSharedBackend(handler: (command: BackendCommand, input: string) => Promise<unknown>,
  close: () => Promise<void>, env = process.env): Promise<void> {
  const directory = await backendDirectory(env);
  await privateDirectory(directory);
  const socketPath = path.join(directory, "service.sock");
  let active = 0, lastRequest = Date.now(), stopping = false;
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    socket.setTimeout(REQUEST_TIMEOUT, () => socket.destroy());
    let bytes = 0, input = "", dispatched = false;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      if (dispatched) return socket.destroy();
      bytes += Buffer.byteLength(chunk);
      if (bytes > REQUEST_LIMIT) return socket.destroy();
      input += chunk;
      if (!input.includes("\n")) return;
      dispatched = true; active++; lastRequest = Date.now();
      void (async () => {
        try {
          const request = JSON.parse(input) as Request;
          if (!request || !["snapshot", "cached-snapshot", "read", "sync", "mutate"].includes(request.command)
            || typeof request.input !== "string") throw new Error("Invalid backend request.");
          const result = JSON.stringify({ ok: true, value: await handler(request.command, request.input) });
          if (Buffer.byteLength(result) > RESPONSE_LIMIT) throw new Error("Backend response too large.");
          socket.end(result);
        } catch { socket.end(JSON.stringify({ ok: false })); }
        finally { active--; lastRequest = Date.now(); }
      })();
    });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(socketPath, resolve); });
  await chmod(socketPath, 0o600);
  await writeFile(path.join(directory, "pid"), String(process.pid), { mode: 0o600 });
  const stop = async () => {
    if (stopping) return; stopping = true; clearInterval(timer);
    server.close(); for (const socket of sockets) socket.destroy();
    await close();
    while (active > 0) await delay(10);
    // net.Server owns unlinking its socket. Never unlink by pathname after awaiting shutdown:
    // a new owner may already have bound that name while the old provider settles.
  };
  // Reversible session service: no launch agent, login item, network listener or persistent daemon.
  const timer = setInterval(() => { if (!active && Date.now() - lastRequest >= 300_000) void stop(); }, 30_000);
  process.once("SIGTERM", () => void stop()); process.once("SIGINT", () => void stop());
}
