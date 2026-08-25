import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchRoot = path.join(repositoryRoot, "evidence", "launch");
const assets = new Map([
  ["gajendra-hero-background.png", [1536, 1024]],
  ["gajendra-hero.png", [1536, 1024]],
  ["gajendra-launch-overview.png", [1520, 1360]],
  ["gajendra-launch-ready-for-review.png", [1520, 1360]],
  ["gajendra-launch-search.png", [1320, 1220]],
  ["gajendra-launch-queue-editing.png", [1320, 1220]],
  ["gajendra-launch-organizer.png", [1240, 1800]],
  ["gajendra-linkedin-ready-review-v2.png", [1536, 1024]],
  ["gajendra-ready-review-hero-background-v2.png", [1536, 1024]],
]);
const assetHashes = new Map();

for (const [name, expected] of assets) {
  const filePath = path.join(launchRoot, name);
  await access(filePath, constants.R_OK);
  const metadata = await stat(filePath);
  assert(metadata.size >= 10_000 && metadata.size <= 12_000_000, `${name} has an unsafe size`);
  const bytes = await readFile(filePath);
  const actual = pngDimensions(bytes);
  assert(
    actual[0] === expected[0] && actual[1] === expected[1],
    `${name} must be ${expected[0]}x${expected[1]}, received ${actual[0]}x${actual[1]}`,
  );
  assetHashes.set(name, createHash("sha256").update(bytes).digest("hex"));
}

const receipt = await readFile(path.join(launchRoot, "README.md"), "utf8");
for (const [name, hash] of assetHashes) {
  const line = receipt.split("\n").find((candidate) => candidate.startsWith(`| \`${name}\` |`));
  assert(line, `launch receipt is missing ${name}`);
  assert(line.includes(`\`${hash}\``), `launch receipt hash is stale for ${name}`);
}

const preview = await readFile(
  path.join(repositoryRoot, "companion", "macos", "Sources", "GajendraPreview", "main.swift"),
  "utf8",
);
const start = preview.indexOf("// Public launch captures");
const end = preview.indexOf("let arguments =", start);
assert(start >= 0 && end > start, "launch fixture boundary is missing");
const fixture = preview.slice(start, end);
for (const required of [
  "synthetic-launch-fixture",
  "Prepare Gajendra's public launch",
  "Polish the widget reopen flow",
  "Turn the build notes into a clear story",
  "Simplify the first-run setup guide",
  "Verify the public release checklist",
  "Review the launch screenshot set",
  'sourceName: "Codex"',
  'sourceName: "Claude"',
  'sourceName: "Demo Review Feed"',
  "https://example.invalid/",
]) {
  assert(fixture.includes(required), `launch fixture is missing ${required}`);
}
for (const forbidden of [
  /\/Users\/[A-Za-z0-9._-]+\//,
  /(?:^|\s)~\//m,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /https?:\/\/(?!example\.invalid)[^\s\"]+/,
]) {
  assert(!forbidden.test(fixture), `launch fixture contains private or non-synthetic data: ${forbidden}`);
}

const heroRenderer = await readFile(path.join(repositoryRoot, "scripts", "render-launch-hero.mjs"), "utf8");
for (const required of [
  "gajendra-launch-overview.png",
  "Actual app UI · Synthetic demo data",
  "One clear focus across your AI tools.",
  "Local-first macOS utility for Codex and Claude workflows",
  "Review is a decision, not an unread badge.",
  "gajendra-launch-ready-for-review.png",
  "gajendra-linkedin-ready-review-v2.png",
]) {
  assert(heroRenderer.includes(required), `hero renderer is missing ${required}`);
}

process.stdout.write(`Validated ${assets.size} privacy-safe launch assets.\n`);

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(buffer.subarray(0, 8).equals(signature), "launch asset is not a PNG");
  assert(buffer.toString("ascii", 12, 16) === "IHDR", "launch PNG has no IHDR header");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
