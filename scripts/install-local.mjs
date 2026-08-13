import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codex = process.env.GAJENDRA_CODEX_BIN || "codex";
const artifactPaths = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "assets/gajendra.svg",
  "assets/gajendra-app-icon.svg",
  "assets/gajendra-menubar.svg",
  "assets/gajendra-icon.png",
  "dist/server.mjs",
  "dist/gajendra.html",
  "skills/gajendra/SKILL.md",
];

ensureMarketplace();
run("npm", ["run", "build"]);

for (let attempt = 1; attempt <= 2; attempt += 1) {
  const installed = JSON.parse(run(codex, ["plugin", "add", "gajendra@gajendra", "--json"], true));
  if (artifactsMatch(installed.installedPath)) {
    process.stdout.write(`Gajendra local plugin installed with matching artifacts: ${installed.installedPath}\n`);
    process.exit(0);
  }
  if (attempt === 1) {
    process.stdout.write("Local marketplace refresh omitted a built artifact; rebuilding once before retry.\n");
    run("npm", ["run", "build"]);
  }
}

throw new Error("Gajendra local plugin artifacts still do not match after the bounded rebuild retry.");

function ensureMarketplace() {
  const catalog = JSON.parse(run(codex, ["plugin", "marketplace", "list", "--json"], true));
  const existing = catalog.marketplaces?.find((marketplace) => marketplace.name === "gajendra");
  if (!existing) {
    run(codex, ["plugin", "marketplace", "add", repositoryRoot, "--json"]);
    return;
  }
  const root = existing.root || existing.marketplaceSource?.source;
  if (root && path.resolve(root) !== repositoryRoot) {
    throw new Error(`Marketplace 'gajendra' already points to a different root: ${root}`);
  }
}

function artifactsMatch(installedRoot) {
  if (!installedRoot) return false;
  return artifactPaths.every((relativePath) => {
    const source = path.join(repositoryRoot, "plugins", "gajendra", relativePath);
    const installed = path.join(installedRoot, relativePath);
    return existsSync(source) && existsSync(installed) && digest(source) === digest(installed);
  });
}

function digest(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${command} ${args.join(" ")} failed.`);
  }
  return result.stdout || "";
}
