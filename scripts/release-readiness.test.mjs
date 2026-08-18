import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const readinessScript = path.join(scriptsDirectory, "release-readiness.mjs");
const stagingPrefix = "gajendra-release-readiness-";

async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "gajendra-release-readiness-test-"));
  try {
    const sourceApp = await makeFakeApp(path.join(root, "source"), "source-marker");
    const mismatchedApp = await makeFakeApp(path.join(root, "archive"), "older-marker");
    const mismatchedArchive = path.join(root, "older-gajendra.zip");
    zipDirectory(mismatchedApp, mismatchedArchive);

    const modeSourceApp = await makeFakeApp(path.join(root, "mode-source"), "same-marker");
    await chmod(modeSourceApp, 0o755);
    const modeArchiveApp = await makeFakeApp(path.join(root, "mode-archive"), "same-marker");
    await chmod(modeArchiveApp, 0o777);
    const modeMismatchArchive = path.join(root, "mode-mismatch-gajendra.zip");
    zipDirectory(modeArchiveApp, modeMismatchArchive);

    const extraPayloadRoot = path.join(root, "extra-payload");
    await makeFakeApp(extraPayloadRoot, "source-marker");
    await writeFile(path.join(extraPayloadRoot, "private-payload.bin"), "must not reach distribution readiness\n");
    const extraPayloadArchive = path.join(root, "extra-payload.zip");
    zipDirectory(extraPayloadRoot, extraPayloadArchive);

    const oversizedRoot = path.join(root, "oversized-resource");
    await makeFakeApp(oversizedRoot, "x".repeat(128 * 1024));
    const oversizedArchive = path.join(root, "oversized-resource.zip");
    zipDirectory(oversizedRoot, oversizedArchive);

    const unrelatedRoot = path.join(root, "unrelated");
    await mkdir(unrelatedRoot, { recursive: true });
    await writeFile(path.join(unrelatedRoot, "README.txt"), "not an app\n");
    const unrelatedArchive = path.join(root, "unrelated.zip");
    zipDirectory(unrelatedRoot, unrelatedArchive);

    const textArchive = path.join(root, "not-an-archive.zip");
    await writeFile(textArchive, "this is deliberately not a ZIP archive\n");

    const beforeStaging = await stagingEntries();
    assertFailure(
      [
        "distribution",
        "--app", sourceApp,
        "--archive", textArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "valid, readable .zip archive"
    );
    assertFailure(
      [
        "distribution",
        "--app", sourceApp,
        "--archive", unrelatedArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "exactly one Gajendra.app"
    );
    assertFailure(
      [
        "distribution",
        "--app", sourceApp,
        "--archive", mismatchedArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "complete parity"
    );
    assertFailure(
      [
        "distribution",
        "--app", sourceApp,
        "--archive", extraPayloadArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "outside the single Gajendra.app"
    );
    assertFailure(
      [
        "distribution",
        "--app", sourceApp,
        "--archive", oversizedArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "uncompressed resource bytes"
    );
    assertFailure(
      [
        "distribution",
        "--app", modeSourceApp,
        "--archive", modeMismatchArchive,
        "--identity", "Developer ID Application: Test (TEAM)",
        "--team-id", "TEAM",
      ],
      "complete parity"
    );
    const afterStaging = await stagingEntries();
    for (const entry of afterStaging) {
      if (!beforeStaging.has(entry)) throw new Error(`release-readiness left temporary data behind: ${entry}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
  process.stdout.write("release-readiness archive regressions passed\n");
}

async function makeFakeApp(parent, marker) {
  const app = path.join(parent, "Gajendra.app");
  await mkdir(path.join(app, "Contents", "Resources"), { recursive: true });
  await writeFile(path.join(app, "Contents", "Resources", "marker.txt"), `${marker}\n`);
  return app;
}

function zipDirectory(directory, archive) {
  const command = process.platform === "darwin" ? "/usr/bin/zip" : "zip";
  const result = spawnSync(command, ["-q", "-r", archive, path.basename(directory)], {
    cwd: path.dirname(directory),
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Could not create deterministic ZIP fixture: ${result.stderr || result.error?.message || "unknown error"}`);
  }
}

function assertFailure(args, expectedMessage) {
  const result = spawnSync(process.execPath, [readinessScript, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status === 0) throw new Error(`Expected release-readiness failure for ${args.join(" ")}.`);
  const receipt = JSON.parse(result.stderr.trim().split(/\r?\n/u).at(-1));
  if (receipt.distributionReady !== false) throw new Error("Failed distribution validation reported distributionReady=true.");
  if (!receipt.error?.includes(expectedMessage)) {
    throw new Error(`Expected failure containing ${expectedMessage}; got ${receipt.error ?? "no error"}.`);
  }
}

async function stagingEntries() {
  return new Set((await readdir(tmpdir())).filter((entry) => entry.startsWith(stagingPrefix)));
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
