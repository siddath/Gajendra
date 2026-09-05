import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const startedAt = new Date();
const gates = [
  { id: "repository-scripts", command: "npm", args: ["run", "check:scripts"] },
  { id: "static", command: "npm", args: ["--workspace", "gajendra", "run", "typecheck"] },
  { id: "behavior", command: "npm", args: ["test"] },
  { id: "build", command: "npm", args: ["run", "build"] },
  { id: "plugin", command: "npm", args: ["run", "validate:plugin"] },
  { id: "live-mcp", command: "npm", args: ["run", "probe:live"] },
  { id: "companion-self-test", command: "npm", args: ["run", "companion:test"] },
  { id: "companion-build", command: "npm", args: ["run", "companion:build"] },
  { id: "companion-ui", command: "npm", args: ["run", "companion:ui-test"] },
  { id: "companion-full-screen", command: "npm", args: ["run", "companion:ui-fullscreen-test"] },
  { id: "companion-widget-performance", command: "npm", args: ["run", "companion:ui-performance-test"] },
  { id: "companion-live", command: "npm", args: ["run", "companion:validate"] },
  { id: "ui", command: "npm", args: ["run", "test:e2e"] },
  { id: "reliability-unit", command: "npm", args: ["test"], repeat: 5 },
  {
    id: "reliability-ui",
    command: "npm",
    args: ["--workspace", "gajendra", "run", "test:e2e", "--", "--repeat-each=5"],
  },
  { id: "final-artifacts", command: "npm", args: ["run", "validate:plugin"] },
  { id: "dependency-audit", command: "npm", args: ["audit", "--omit=dev", "--audit-level=high"] },
];

const results = [];
for (const gate of gates) {
  const repetitions = gate.repeat ?? 1;
  for (let trial = 1; trial <= repetitions; trial += 1) {
    const before = performance.now();
    const result = spawnSync(gate.command, gate.args, { stdio: "inherit", env: process.env });
    const receipt = {
      gate: gate.id,
      trial,
      status: result.status === 0 ? "passed" : "failed",
      durationMs: Math.round(performance.now() - before),
    };
    results.push(receipt);
    if (result.status !== 0) {
      await writeReport("failed");
      process.exit(result.status ?? 1);
    }
  }
}

await writeReport("passed");
console.log(`Gauntlet passed: ${results.length} gate receipts recorded.`);

async function writeReport(status) {
  const evidenceDirectory = path.resolve("evidence/gauntlet");
  await mkdir(evidenceDirectory, { recursive: true });
  const report = {
    contractVersion: 1,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    hardFailurePolicy: "Any failed gate stops the run; soft visual judgment cannot erase a hard failure.",
    results,
  };
  await writeFile(path.join(evidenceDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
