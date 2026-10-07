import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const report = path.join(root, ".artifacts/evals/report.json");
const startedAt = new Date().toISOString();
await mkdir(path.dirname(report), { recursive: true });
// Replace the previous result before typechecking or loading the dataset. A crash cannot leave
// an old PASS looking like the current run, including while this run is still in progress.
await writeFile(report, JSON.stringify({ suite: "gajendra-product-evals-v1", status: "running", startedAt }) + "\n");
let failure;
for (const [stage, args] of [
  ["typecheck", [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "--project", "evals/tsconfig.json"]],
  ["scenarios", ["--import", "tsx", "evals/run.mts"]],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) { failure = { stage, exitCode: result.status ?? 1 }; break; }
}
const result = JSON.parse(await readFile(report, "utf8"));
if (failure || result.status !== "passed") {
  if (result.status !== "failed") {
    await writeFile(report, JSON.stringify({ suite: "gajendra-product-evals-v1", status: "failed", startedAt,
      completedAt: new Date().toISOString(), failure: failure ?? { stage: "report", reason: "No passing scenario report produced" }, results: [] }, null, 2) + "\n");
  }
  process.exitCode = failure?.exitCode ?? 1;
}
