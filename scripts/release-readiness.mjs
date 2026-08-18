import { spawnSync } from "node:child_process";
import { constants, createReadStream } from "node:fs";
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const sourceInfoPlist = path.join(repositoryRoot, "companion/macos/Resources/Info.plist");
const sourceService = path.join(repositoryRoot, "plugins/gajendra/dist/server.mjs");
const sourceMenuBarMark = path.join(repositoryRoot, "plugins/gajendra/assets/gajendra-menubar.svg");
const sourceRuntimeNotices = path.join(repositoryRoot, "companion/macos/Resources/NODE_RUNTIME_NOTICES.md");

const bundleContract = {
  displayName: "Gajendra",
  bundleName: "Gajendra",
  bundleIdentifier: "dev.sid.gajendra",
  executable: "Gajendra",
  minimumMacOS: "13.5",
  urlName: "Gajendra Thread",
  urlScheme: "gajendra",
  nodeVersion: "24.19.0",
};

// These are source-derived archive safety guardrails, not bundle-size claims: the
// source manifest supplies the payload bound and this small cushion covers ZIP
// directory entries and macOS metadata without allowing arbitrary extra payload.
const archiveSafety = Object.freeze({
  extractionTimeoutMs: 30_000,
  maxEntryMultiplier: 4,
  maxEntryFloor: 32,
  maxMetadataBytesFloor: 64 * 1024,
  maxMetadataByteRatio: 0.01,
});

let mode = "local";
try {
  const cli = parseCli(process.argv.slice(2));
  mode = cli.mode;
  if (cli.help) {
    printUsage();
    process.exit(0);
  }
  const receipt = cli.mode === "distribution"
    ? await validateDistributionReadiness(cli)
    : await validateLocalBundleReadiness(cli);
  await emitReceipt(receipt, cli.receipt);
} catch (error) {
  const message = error instanceof Error ? error.message : "Release readiness validation failed.";
  process.stderr.write(`${JSON.stringify({ status: "failed", mode, distributionReady: false, error: message })}\n`);
  process.exitCode = 1;
}

async function validateLocalBundleReadiness(cli) {
  const app = resolveLocalApp(cli.app);
  const bundle = await inspectBundle(app);
  return {
    status: "passed",
    mode: "local",
    app: artifactLabel(app),
    distributionReady: false,
    distributionStatus: "not-verified",
    signing: bundle.signing,
    bundle: bundle.metadata,
    checksums: bundle.checksums,
    bundleChecksum: bundle.bundleChecksum,
    completeBundleChecksum: bundle.completeBundleChecksum,
  };
}

async function validateDistributionReadiness(cli) {
  const app = requireExplicitPath(cli.app, "--app");
  const archive = requireExplicitPath(cli.archive, "--archive");
  const identity = requireNonEmpty(cli.identity, "--identity");
  const teamId = requireNonEmpty(cli.teamId, "--team-id");
  await assertReadableDirectory(app, "--app");
  if (path.extname(archive).toLowerCase() !== ".zip") {
    throw new Error("Distribution archive format must be .zip.");
  }
  await access(archive, constants.R_OK);
  const archiveInfo = await lstat(archive);
  if (archiveInfo.isSymbolicLink()) throw new Error("Distribution archive must not be a symbolic link.");
  if (!archiveInfo.isFile() || archiveInfo.size === 0) throw new Error("Distribution archive must be a non-empty readable file.");

  const sourceManifest = await bundleManifest(app);
  const archiveChecksum = await sha256File(archive);
  const verifiedArchive = await withExtractedArchive(archive, sourceManifest, async ({ path: embeddedApp, appRelativePath }) => {
    const parity = await assertCompleteBundleParity(app, embeddedApp, sourceManifest);
    const bundle = await inspectBundle(embeddedApp);
    assertDeveloperIdSigning(bundle.signing, identity, teamId);
    // These gates intentionally target the app found inside the supplied archive, not merely
    // the separately supplied --app directory.
    run("spctl", ["--assess", "--type", "execute", "--verbose=4", embeddedApp], "Gatekeeper assessment of embedded app");
    run("xcrun", ["stapler", "validate", embeddedApp], "notarization ticket validation of embedded app");
    return { bundle, parity, appRelativePath };
  });

  return {
    status: "passed",
    mode: "distribution",
    app: artifactLabel(app),
    embeddedApp: `archive:${verifiedArchive.appRelativePath}`,
    archive: artifactLabel(archive),
    distributionReady: true,
    distributionStatus: "verified-not-published",
    signing: verifiedArchive.bundle.signing,
    bundle: verifiedArchive.bundle.metadata,
    checksums: verifiedArchive.bundle.checksums,
    bundleChecksum: verifiedArchive.bundle.bundleChecksum,
    completeBundleChecksum: verifiedArchive.parity.embeddedChecksum,
    archiveParity: "complete-match",
    archiveChecksum: `sha256:${archiveChecksum}`,
    developerId: { identity, teamId },
    gatekeeper: "embedded-app-accepted",
    notarization: "embedded-app-stapled-ticket-validated",
  };
}

async function assertReadableDirectory(candidate, option) {
  const info = await lstat(candidate);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`${option} must point to a readable app directory.`);
  }
  await access(candidate, constants.R_OK);
}

async function withExtractedArchive(archive, sourceManifest, callback) {
  const listing = listZipEntries(archive);
  const appRoots = validateZipEntryPaths(listing.entries);
  assertArchiveResourceBounds(listing, sourceManifest);
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "gajendra-release-readiness-"));
  try {
    await chmod(stagingRoot, 0o700);
    run(unzipCommand(), ["-q", "-o", archive, "-d", stagingRoot], "ZIP archive extraction", { timeoutMs: archiveSafety.extractionTimeoutMs });
    const embeddedApps = await findEmbeddedApps(stagingRoot);
    if (embeddedApps.length !== 1) {
      throw new Error(`Distribution archive must contain exactly one Gajendra.app; found ${embeddedApps.length}.`);
    }
    const [embeddedApp] = embeddedApps;
    if (!appRoots.has(embeddedApp.appRelativePath)) {
      throw new Error("Extracted Gajendra.app path did not match the validated ZIP structure.");
    }
    return await callback(embeddedApp);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 20 });
  }
}

function listZipEntries(archive) {
  let result;
  let metadata;
  try {
    result = run(unzipCommand(), ["-Z1", archive], "ZIP archive listing", { timeoutMs: archiveSafety.extractionTimeoutMs });
    metadata = run(unzipCommand(), ["-Z", "-l", archive], "ZIP archive metadata listing", { timeoutMs: archiveSafety.extractionTimeoutMs });
  } catch {
    throw new Error("Distribution archive must be a valid, readable .zip archive.");
  }
  if (metadata.stdout.split(/\r?\n/u).some((line) => /^l[rwxstST-]{9}\s/u.test(line))) {
    throw new Error("Distribution archive must not contain symbolic links.");
  }
  const entries = result.stdout.split(/\r?\n/u).filter(Boolean);
  if (entries.length === 0) throw new Error("Distribution archive must not be empty.");
  const summary = metadata.stdout.match(/^\s*([\d,]+)\s+files?,\s+([\d,]+)\s+bytes uncompressed,/mu);
  if (!summary) throw new Error("Distribution archive metadata is incomplete.");
  const entryCount = parseArchiveInteger(summary[1], "entry count");
  const uncompressedBytes = parseArchiveInteger(summary[2], "uncompressed byte count");
  if (entryCount !== entries.length) throw new Error("Distribution archive central-directory entry count is inconsistent.");
  return { entries, entryCount, uncompressedBytes };
}

function validateZipEntryPaths(entries) {
  const seen = new Set();
  const appRoots = new Set();
  const parsedEntries = [];
  for (const rawEntry of entries) {
    const entry = rawEntry.endsWith("/") ? rawEntry.slice(0, -1) : rawEntry;
    if (!entry || entry.includes("\0") || entry.includes("\\")) {
      throw new Error("Distribution archive contains an invalid entry path.");
    }
    if (entry.startsWith("/") || /^[A-Za-z]:/u.test(entry) || entry.startsWith("~")) {
      throw new Error("Distribution archive contains an absolute entry path.");
    }
    const components = entry.split("/");
    if (components.some((component) => !component || component === "." || component === "..")) {
      throw new Error("Distribution archive contains an unsafe entry path.");
    }
    const normalized = components.join("/");
    if (seen.has(normalized)) throw new Error("Distribution archive contains duplicate entry paths.");
    seen.add(normalized);
    parsedEntries.push({ entry: normalized, directoryEntry: rawEntry.endsWith("/") });

    components.forEach((component, index) => {
      if (component.endsWith(".app") && component !== "Gajendra.app") {
        throw new Error("Distribution archive contains an unsupported application bundle.");
      }
      if (component === "Gajendra.app" && components[0] !== "__MACOSX") {
        appRoots.add(components.slice(0, index + 1).join("/"));
      }
    });
  }
  if (appRoots.size !== 1) {
    throw new Error(`Distribution archive must contain exactly one Gajendra.app; found ${appRoots.size}.`);
  }
  const [appRoot] = appRoots;
  for (const { entry, directoryEntry } of parsedEntries) {
    if (isArchiveMetadataEntry(entry, directoryEntry)) continue;
    const insideApp = entry === appRoot || entry.startsWith(`${appRoot}/`);
    const leadingDirectory = directoryEntry && appRoot.startsWith(`${entry}/`);
    if (!insideApp && !leadingDirectory) {
      throw new Error("Distribution archive contains payload outside the single Gajendra.app.");
    }
  }
  return appRoots;
}

function isArchiveMetadataEntry(entry, directoryEntry) {
  if (entry === "__MACOSX") return true;
  if (!entry.startsWith("__MACOSX/")) return false;
  return directoryEntry || entry.split("/").at(-1).startsWith("._");
}

function assertArchiveResourceBounds(listing, sourceManifest) {
  const sourceEntryCount = sourceManifest.length;
  const sourceFileBytes = sourceManifest
    .filter((entry) => entry.kind === "file")
    .reduce((total, entry) => total + entry.size, 0);
  const maxEntryCount = Math.max(
    sourceEntryCount * archiveSafety.maxEntryMultiplier,
    sourceEntryCount + archiveSafety.maxEntryFloor,
  );
  const maxUncompressedBytes = sourceFileBytes + Math.max(
    archiveSafety.maxMetadataBytesFloor,
    Math.ceil(sourceFileBytes * archiveSafety.maxMetadataByteRatio),
  );
  if (listing.entryCount > maxEntryCount) {
    throw new Error(`Distribution archive central-directory entry count exceeds the source-app bound (${listing.entryCount} > ${maxEntryCount}).`);
  }
  if (listing.uncompressedBytes > maxUncompressedBytes) {
    throw new Error(`Distribution archive uncompressed resource bytes exceed the source-app bound (${listing.uncompressedBytes} > ${maxUncompressedBytes}).`);
  }
}

function parseArchiveInteger(value, label) {
  const parsed = Number(value.replaceAll(",", ""));
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Distribution archive ${label} is invalid.`);
  return parsed;
}

async function findEmbeddedApps(stagingRoot) {
  const matches = [];
  async function walk(directory, metadataPath = false) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      const info = await lstat(candidate);
      if (info.isSymbolicLink()) {
        throw new Error("Distribution archive must not contain symbolic links.");
      }
      const childMetadataPath = metadataPath || (directory === stagingRoot && entry.name === "__MACOSX");
      if (entry.name === "Gajendra.app" && !childMetadataPath) {
        if (!info.isDirectory()) throw new Error("Distribution archive contains a non-directory Gajendra.app.");
        matches.push({
          path: candidate,
          appRelativePath: path.relative(stagingRoot, candidate).split(path.sep).join("/"),
        });
      }
      if (info.isDirectory()) await walk(candidate, childMetadataPath);
    }
  }
  await walk(stagingRoot);
  return matches;
}

async function assertCompleteBundleParity(sourceApp, embeddedApp, knownSourceManifest = null) {
  const [sourceManifest, embeddedManifest] = await Promise.all([
    knownSourceManifest ?? bundleManifest(sourceApp),
    bundleManifest(embeddedApp),
  ]);
  const sourceChecksum = checksumManifest(sourceManifest);
  const embeddedChecksum = checksumManifest(embeddedManifest);
  if (JSON.stringify(sourceManifest) !== JSON.stringify(embeddedManifest)) {
    throw new Error("Embedded Gajendra.app does not have complete parity with --app (content, signature, permissions, or resources differ).");
  }
  return { sourceChecksum, embeddedChecksum };
}

async function bundleManifest(bundle) {
  const rootInfo = await lstat(bundle);
  if (!rootInfo.isDirectory()) throw new Error("Bundle root must be a directory.");
  const manifest = [{ path: "", kind: "directory", mode: rootInfo.mode & 0o7777 }];
  async function walk(directory, relativeDirectory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name).split(path.sep).join("/");
      const info = await lstat(candidate);
      const mode = info.mode & 0o7777;
      if (info.isSymbolicLink()) {
        manifest.push({ path: relativePath, kind: "symlink", mode, target: await readlink(candidate) });
      } else if (info.isDirectory()) {
        manifest.push({ path: relativePath, kind: "directory", mode });
        await walk(candidate, relativePath);
      } else if (info.isFile()) {
        manifest.push({
          path: relativePath,
          kind: "file",
          mode,
          size: info.size,
          sha256: await sha256File(candidate),
        });
      } else {
        throw new Error(`Bundle contains an unsupported filesystem entry: ${relativePath}.`);
      }
    }
  }
  await walk(bundle, "");
  return manifest;
}

function checksumManifest(manifest) {
  return `sha256:${sha256(Buffer.from(JSON.stringify(manifest)))}`;
}

function unzipCommand() {
  return process.platform === "darwin" ? "/usr/bin/unzip" : "unzip";
}

async function inspectBundle(app) {
  const contents = path.join(app, "Contents");
  const info = path.join(contents, "Info.plist");
  const executable = path.join(contents, "MacOS", bundleContract.executable);
  const service = path.join(contents, "Resources/server.mjs");
  const node = path.join(contents, "Resources/Runtime/node/bin/node");
  const icon = path.join(contents, "Resources/Gajendra.icns");
  const menuBarMark = path.join(contents, "Resources/GajendraMenuBar.svg");
  const nodeLicense = path.join(contents, `Resources/ThirdPartyNotices/Node-${bundleContract.nodeVersion}-LICENSE`);
  const nodeNotices = path.join(contents, `Resources/ThirdPartyNotices/Node-${bundleContract.nodeVersion}-NOTICES.md`);

  await Promise.all([
    access(app, constants.R_OK),
    access(info, constants.R_OK),
    access(executable, constants.X_OK),
    access(service, constants.R_OK),
    access(node, constants.X_OK),
    access(icon, constants.R_OK),
    access(menuBarMark, constants.R_OK),
    access(nodeLicense, constants.R_OK),
    access(nodeNotices, constants.R_OK),
    access(sourceInfoPlist, constants.R_OK),
    access(sourceService, constants.R_OK),
    access(sourceMenuBarMark, constants.R_OK),
    access(sourceRuntimeNotices, constants.R_OK),
  ]);

  const plistChecks = [
    ["CFBundleDisplayName", bundleContract.displayName],
    ["CFBundleName", bundleContract.bundleName],
    ["CFBundleIdentifier", bundleContract.bundleIdentifier],
    ["CFBundleExecutable", bundleContract.executable],
    ["LSMinimumSystemVersion", bundleContract.minimumMacOS],
    ["CFBundleURLTypes.0.CFBundleURLName", bundleContract.urlName],
    ["CFBundleURLTypes.0.CFBundleURLSchemes.0", bundleContract.urlScheme],
    ["LSUIElement", "false"],
  ];
  for (const [key, expected] of plistChecks) {
    const sourceValue = plistValue(sourceInfoPlist, key);
    const bundledValue = plistValue(info, key);
    if (sourceValue !== expected) throw new Error(`Source Info.plist must retain ${key}=${expected}.`);
    if (bundledValue !== sourceValue) throw new Error(`Bundle Info.plist does not match the source-controlled ${key}.`);
  }

  const [bundledService, expectedService, bundledMenuBarMark, expectedMenuBarMark, notices, expectedNotices, nodeLicenseContents] = await Promise.all([
    readFile(service),
    readFile(sourceService),
    readFile(menuBarMark),
    readFile(sourceMenuBarMark),
    readFile(nodeNotices, "utf8"),
    readFile(sourceRuntimeNotices, "utf8"),
    readFile(nodeLicense),
  ]);
  if (!bundledService.equals(expectedService)) throw new Error("Bundled service does not match plugins/gajendra/dist/server.mjs.");
  if (!bundledMenuBarMark.equals(expectedMenuBarMark)) throw new Error("Bundled menu-bar artwork does not match its source-controlled asset.");
  if (notices !== expectedNotices || !notices.includes(`v${bundleContract.nodeVersion}`) || !notices.includes("SHA-256")) {
    throw new Error("Bundled Node runtime notices are missing or do not match the source-controlled notice.");
  }
  if (nodeLicenseContents.byteLength === 0) throw new Error("Bundled Node runtime license must not be empty.");

  run("codesign", ["--verify", "--deep", "--strict", app], "strict code-signature verification");
  const signing = classifySigning(run("codesign", ["-dv", "--verbose=4", app], "code-signature inspection"));
  const nodeVersion = run(node, ["--version"], "bundled Node runtime inspection").stdout.trim();
  if (nodeVersion !== `v${bundleContract.nodeVersion}`) {
    throw new Error(`Bundled Node runtime must be v${bundleContract.nodeVersion}.`);
  }

  const checksums = Object.fromEntries(await Promise.all([
    ["Contents/Info.plist", info],
    ["Contents/MacOS/Gajendra", executable],
    ["Contents/Resources/server.mjs", service],
    ["Contents/Resources/Runtime/node/bin/node", node],
    ["Contents/Resources/Gajendra.icns", icon],
    ["Contents/Resources/GajendraMenuBar.svg", menuBarMark],
    [`Contents/Resources/ThirdPartyNotices/Node-${bundleContract.nodeVersion}-LICENSE`, nodeLicense],
    [`Contents/Resources/ThirdPartyNotices/Node-${bundleContract.nodeVersion}-NOTICES.md`, nodeNotices],
  ].map(async ([relativePath, filePath]) => [relativePath, `sha256:${await sha256File(filePath)}`])));
  const bundleChecksum = `sha256:${sha256(Buffer.from(JSON.stringify(Object.entries(checksums).sort(([left], [right]) => left.localeCompare(right)))))}`;
  const completeBundleChecksum = checksumManifest(await bundleManifest(app));

  return {
    metadata: {
      displayName: bundleContract.displayName,
      bundleIdentifier: bundleContract.bundleIdentifier,
      executable: bundleContract.executable,
      urlScheme: bundleContract.urlScheme,
      minimumMacOS: bundleContract.minimumMacOS,
      nodeVersion: `v${bundleContract.nodeVersion}`,
    },
    signing,
    checksums,
    bundleChecksum,
    completeBundleChecksum,
  };
}

function assertDeveloperIdSigning(signing, identity, teamId) {
  if (signing.kind !== "developer-id") {
    throw new Error("Distribution mode requires a Developer ID signed bundle, not an ad-hoc or unknown signature.");
  }
  if (signing.identity !== identity) throw new Error("Bundle Developer ID identity does not match the explicit --identity input.");
  if (signing.teamId !== teamId) throw new Error("Bundle Developer ID team does not match the explicit --team-id input.");
}

function classifySigning(result) {
  const details = `${result.stdout}\n${result.stderr}`;
  const signature = matchCodeSignField(details, "Signature");
  const teamId = matchCodeSignField(details, "TeamIdentifier");
  const authorities = [...details.matchAll(/^Authority=(.+)$/gmu)].map((match) => match[1].trim());
  const developerIdentity = authorities.find((authority) => authority.startsWith("Developer ID Application:")) ?? null;
  const adHoc = signature?.toLowerCase() === "adhoc" || authorities.includes("Ad Hoc Signing");
  return {
    kind: adHoc ? "ad-hoc" : developerIdentity ? "developer-id" : "unknown",
    identity: developerIdentity,
    teamId: !teamId || teamId === "not set" ? null : teamId,
    strictVerification: "passed",
  };
}

function matchCodeSignField(details, key) {
  const match = details.match(new RegExp(`^${key}=(.+)$`, "mu"));
  return match?.[1].trim() ?? null;
}

function plistValue(file, key) {
  return run("plutil", ["-extract", key, "raw", file], `plist extraction for ${key}`).stdout.trim();
}

function run(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    ...(options.timeoutMs ? { timeout: options.timeoutMs, killSignal: "SIGKILL" } : {}),
  });
  if (result.error?.code === "ETIMEDOUT") throw new Error(`${label} exceeded its bounded deadline.`);
  if (result.error || result.status !== 0) throw new Error(`${label} failed.`);
  return result;
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function requireExplicitPath(value, option) {
  if (!value) throw new Error(`Distribution mode requires an explicit ${option} input.`);
  return path.resolve(value);
}

function requireNonEmpty(value, option) {
  if (!value?.trim()) throw new Error(`Distribution mode requires an explicit ${option} input.`);
  return value.trim();
}

function resolveLocalApp(option) {
  return path.resolve(option ?? process.env.GAJENDRA_RELEASE_APP ?? path.join(repositoryRoot, "build/Gajendra.app"));
}

function artifactLabel(file) {
  const relative = path.relative(repositoryRoot, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : path.basename(file);
}

async function emitReceipt(receipt, receiptPath) {
  if (receiptPath) {
    const destination = path.resolve(receiptPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, `${JSON.stringify(receipt)}\n`, { mode: 0o644 });
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

function parseCli(argv) {
  const values = [...argv];
  if (values[0] === "--help" || values[0] === "-h") return { mode: "local", help: true };
  const mode = values[0] === "local" || values[0] === "distribution" ? values.shift() : "local";
  const options = { mode, help: false, app: null, archive: null, identity: null, teamId: null, receipt: null };
  while (values.length > 0) {
    const flag = values.shift();
    if (flag === "--help" || flag === "-h") {
      options.help = true;
      continue;
    }
    const value = values.shift();
    if (!value || !flag?.startsWith("--")) throw new Error(`Unsupported release-readiness argument: ${flag ?? ""}`);
    if (flag === "--app") options.app = value;
    else if (flag === "--archive") options.archive = value;
    else if (flag === "--identity") options.identity = value;
    else if (flag === "--team-id") options.teamId = value;
    else if (flag === "--receipt") options.receipt = value;
    else throw new Error(`Unsupported release-readiness argument: ${flag}`);
  }
  return options;
}

function printUsage() {
  process.stdout.write([
    "Usage:",
    "  node scripts/release-readiness.mjs local [--app build/Gajendra.app] [--receipt receipt.json]",
    "  node scripts/release-readiness.mjs distribution --app APP --archive ARCHIVE --identity 'Developer ID Application: …' --team-id TEAM [--receipt receipt.json]",
    "",
    "Local mode verifies a source-built, strictly signed bundle and emits a non-distribution receipt.",
    "Distribution mode supports .zip archives only; it extracts one embedded Gajendra.app for complete parity and gate checks.",
    "Distribution mode only verifies explicit existing artifacts; it never signs, notarizes, staples, uploads, or contacts release services.",
  ].join("\n") + "\n");
}
