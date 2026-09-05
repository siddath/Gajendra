import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";

import {
  readClaudeThreadMetadata,
  readGrokThreadMetadata,
  recentClaudeSessionFiles,
  recentGrokSummaryFiles,
  type DiscoveryMeasurement,
} from "../src/server/thread-sources.js";

const CANDIDATE_COUNT = boundedInteger(process.env.GAJENDRA_BENCHMARK_CANDIDATES, 1_000, 200, 1_800);
const PROJECT_COUNT = boundedInteger(process.env.GAJENDRA_BENCHMARK_PROJECTS, 20, 1, 100);
const RUN_COUNT = boundedInteger(process.env.GAJENDRA_BENCHMARK_RUNS, 7, 3, 20);
const entriesPerProject = Math.ceil(CANDIDATE_COUNT / PROJECT_COUNT);

const root = await mkdtemp(path.join(os.tmpdir(), "gajendra-source-benchmark-"));
const claudeProjects = path.join(root, "claude-projects");
const grokSessions = path.join(root, "grok-sessions");

try {
  await createFixtures();

  const claude = await benchmark(async () => {
    const measurement = emptyMeasurement();
    const files = await recentClaudeSessionFiles(claudeProjects, { measurement });
    assertSelection(files, false);
    const threads = await Promise.all(files.map((file) => readClaudeThreadMetadata(file, "/usr/bin/false")));
    assert.equal(threads.filter(Boolean).length, 200);
    return measurement;
  });
  const grok = await benchmark(async () => {
    const measurement = emptyMeasurement();
    const files = await recentGrokSummaryFiles(grokSessions, { measurement });
    assertSelection(files, true);
    const threads = await Promise.all(files.map((file) => readGrokThreadMetadata(file, "/usr/bin/false")));
    assert.equal(threads.filter(Boolean).length, 200);
    return measurement;
  });

  process.stdout.write(`${JSON.stringify({
    benchmark: "gajendra-source-discovery-v1",
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    candidates: CANDIDATE_COUNT,
    projects: PROJECT_COUNT,
    selectedPerSource: 200,
    runs: RUN_COUNT,
    claude,
    grok,
  }, null, 2)}\n`);
} finally {
  await rm(root, { recursive: true, force: true });
}

async function createFixtures(): Promise<void> {
  let created = 0;
  for (let projectIndex = 0; projectIndex < PROJECT_COUNT && created < CANDIDATE_COUNT; projectIndex += 1) {
    const claudeProject = path.join(claudeProjects, `project-${projectIndex.toString().padStart(3, "0")}`);
    const grokWorkspace = path.join(grokSessions, `workspace-${projectIndex.toString().padStart(3, "0")}`);
    await Promise.all([mkdir(claudeProject, { recursive: true }), mkdir(grokWorkspace, { recursive: true })]);
    for (let entryIndex = 0; entryIndex < entriesPerProject && created < CANDIDATE_COUNT; entryIndex += 1) {
      const id = created.toString().padStart(5, "0");
      const timestamp = 1_700_000_000 + created;
      const claudeFile = path.join(claudeProject, `session-${id}.jsonl`);
      const grokDirectory = path.join(grokWorkspace, `session-${id}`);
      const grokFile = path.join(grokDirectory, "summary.json");
      await mkdir(grokDirectory, { recursive: true });
      await Promise.all([
        writeFile(claudeFile, `${JSON.stringify({
          sessionId: `session-${id}`,
          cwd: `/workspace/project-${projectIndex}`,
          aiTitle: `Synthetic benchmark thread ${id}`,
          timestamp: new Date(timestamp * 1_000).toISOString(),
        })}\n`),
        writeFile(grokFile, JSON.stringify({
          info: { id: `session-${id}`, cwd: `/workspace/project-${projectIndex}` },
          generated_title: `Synthetic benchmark thread ${id}`,
          last_active_at: timestamp,
        })),
      ]);
      await Promise.all([utimes(claudeFile, timestamp, timestamp), utimes(grokFile, timestamp, timestamp)]);
      created += 1;
    }
  }
}

async function benchmark(operation: () => Promise<DiscoveryMeasurement>): Promise<{
  samplesMs: number[];
  medianMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  measurement: DiscoveryMeasurement;
}> {
  await operation();
  const durations: number[] = [];
  let measurement = emptyMeasurement();
  for (let run = 0; run < RUN_COUNT; run += 1) {
    const started = performance.now();
    measurement = await operation();
    durations.push(performance.now() - started);
  }
  const samplesMs = durations.map(round);
  durations.sort((left, right) => left - right);
  return {
    samplesMs,
    medianMs: round(percentile(durations, 0.5)),
    p95Ms: round(percentile(durations, 0.95)),
    minMs: round(durations[0] ?? 0),
    maxMs: round(durations.at(-1) ?? 0),
    measurement,
  };
}

function emptyMeasurement(): DiscoveryMeasurement {
  return { directoriesRead: 0, candidateFiles: 0, metadataStats: 0 };
}

function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function boundedInteger(raw: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function assertSelection(files: string[], grok: boolean): void {
  const selected = files.map((file) => Number.parseInt(
    path.basename(grok ? path.dirname(file) : file).replace("session-", ""), 10,
  ));
  assert.deepEqual(selected, Array.from({ length: 200 }, (_, index) => CANDIDATE_COUNT - 1 - index));
}
