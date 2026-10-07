import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { CodexAppServerClient } from "../../src/server/codex-app-server.js";

it("uses the supported fast listing with one fallback for an older rejecting provider", async () => {
  if (process.platform === "win32") return;
  const dir = await mkdtemp(path.join(os.tmpdir(), "gajendra-fast-list-"));
  const executable = path.join(dir, "codex"); const log = path.join(dir, "requests.jsonl");
  await writeFile(executable, `#!${process.execPath}
const fs=require('node:fs');
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{
 const r=JSON.parse(line);if(typeof r.id!=='number')return;
 if(r.method==='thread/list'){
  fs.appendFileSync(process.env.TEST_LOG,JSON.stringify(r.params)+'\\n');
  if(r.params.useStateDbOnly){process.stdout.write(JSON.stringify({id:r.id,error:{code:-32602,message:'unknown useStateDbOnly'}})+'\\n');return;}
 }
 process.stdout.write(JSON.stringify({id:r.id,result:r.method==='thread/list'?{data:[],nextCursor:null}:{}})+'\\n');
});
`); await chmod(executable, 0o700);
  const client = new CodexAppServerClient(2_000, { ...process.env, GAJENDRA_CODEX_BIN: executable,
    GAJENDRA_DATA_DIR: dir, GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off", TEST_LOG: log });
  try {
    await client.listThreads(); await client.listThreads();
    const requests = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    expect(requests.map(request => request.useStateDbOnly ?? false)).toEqual([true, false, false]);
    expect(requests.every(request => request.archived === false && request.limit === 100)).toBe(true);
  } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
});
