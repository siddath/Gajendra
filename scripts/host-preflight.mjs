import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appPath = process.env.GAJENDRA_CODEX_APP ?? process.env.AADI_CODEX_APP ?? process.env.PRIORITY_DECK_CODEX_APP ?? "/Applications/ChatGPT.app";
const pluginId = "gajendra@gajendra";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const statePath = path.join(homedir(), "Library", "Application Support", "Gajendra", "gajendra.v2.json");

const app = inspectApp(appPath);
const plugin = inspectPlugin();
const processState = inspectProcess(appPath, plugin.cacheInstalledAtEpoch);
const cliFeatures = inspectCliFeatures();
const state = inspectState(statePath);
const artifacts = inspectArtifacts(plugin.cachePath);
const mcpInventory = await inspectMcpInventory(
  path.join(appPath, "Contents", "Resources", "codex"),
);

const hardChecks = {
  supportedPlatform: process.platform === "darwin",
  codexAppFound: app.found,
  expectedBundle: app.bundleIdentifier === "com.openai.codex",
  pluginInstalled: plugin.installed,
  pluginEnabled: plugin.enabled,
  installedArtifactsMatchSource: artifacts.status === "matched",
  pluginMcpServerRegistered: mcpInventory.status === "present",
  stateInvariantValid: state.status === "valid" || state.status === "uninitialized",
  statePermissionsPrivate:
    state.status === "uninitialized" || (state.fileMode === "600" && state.directoryMode === "700"),
};

const hardFailures = Object.entries(hardChecks)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

const nextActions = [];
if (!processState.running) nextActions.push("Launch Codex desktop.");
if (processState.hostReloadNeeded) {
  nextActions.push("Relaunch Codex so the running host starts after the plugin installation.");
}
if (hardChecks.statePermissionsPrivate === false) {
  nextActions.push("Restore owner-only permissions on the Gajendra state directory and file.");
}
if (hardFailures.length === 0) {
  nextActions.push("Hover the configured lotus and confirm it only highlights; click once and confirm the details card opens.");
  nextActions.push("Click the search capsule and confirm typing starts with a visible focus state.");
  nextActions.push("Use Open thread, then return and confirm the same global NOW remains selected.");
}

const report = {
  contractVersion: 1,
  observedAt: new Date().toISOString(),
  status: hardFailures.length === 0 ? "ready-for-visible-host-proof" : "failed",
  app,
  process: processState,
  plugin: {
    installed: plugin.installed,
    enabled: plugin.enabled,
    version: plugin.version,
  },
  cliFeatures,
  artifacts,
  mcpInventory,
  state,
  hardChecks,
  hardFailures,
  visibleProof: {
    status: "requires-primary-window-observation",
    required: [
      "the icon-only elephant-and-lotus mark remains visible at its configured hotspot",
      "hover does not open the card and primary click does",
      "the search capsule visibly accepts keyboard input",
      "Open thread resumes in the owning AI agent",
      "the same NOW choice persists after returning",
    ],
  },
  nextActions,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (hardFailures.length > 0) process.exitCode = 1;

function inspectApp(bundlePath) {
  const infoPath = path.join(bundlePath, "Contents", "Info.plist");
  if (!existsSync(infoPath)) {
    return { found: false, bundleIdentifier: null, version: null, build: null };
  }
  return {
    found: true,
    bundleIdentifier: plistValue(infoPath, "CFBundleIdentifier"),
    version: plistValue(infoPath, "CFBundleShortVersionString"),
    build: plistValue(infoPath, "CFBundleVersion"),
  };
}

function inspectPlugin() {
  try {
    const catalog = JSON.parse(run("codex", ["plugin", "list", "--json"]));
    const entry = catalog.installed?.find((candidate) => candidate.pluginId === pluginId);
    if (!entry) {
      return { installed: false, enabled: false, version: null, cachePath: null, cacheInstalledAtEpoch: null };
    }
    const cachePath = path.join(
      homedir(),
      ".codex",
      "plugins",
      "cache",
      entry.marketplaceName,
      entry.name,
      entry.version,
    );
    return {
      installed: entry.installed === true,
      enabled: entry.enabled === true,
      version: entry.version ?? null,
      cachePath,
      cacheInstalledAtEpoch: existsSync(cachePath) ? statSync(cachePath).mtimeMs : null,
    };
  } catch {
    return { installed: false, enabled: false, version: null, cachePath: null, cacheInstalledAtEpoch: null };
  }
}

function inspectProcess(bundlePath, cacheInstalledAtEpoch) {
  const executable = path.join(bundlePath, "Contents", "MacOS", "ChatGPT");
  let rows = [];
  try {
    rows = run("ps", ["-axo", "pid=,lstart=,command="])
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith(executable))
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.{24})\s+(.+)$/u);
        if (!match) return null;
        const launchedAt = new Date(match[2]);
        return {
          pid: Number(match[1]),
          launchedAt: Number.isNaN(launchedAt.valueOf()) ? null : launchedAt.toISOString(),
          launchedAtEpoch: Number.isNaN(launchedAt.valueOf()) ? null : launchedAt.valueOf(),
        };
      })
      .filter(Boolean);
  } catch {
    rows = [];
  }
  const newest = rows.sort((left, right) => (right.launchedAtEpoch ?? 0) - (left.launchedAtEpoch ?? 0))[0];
  const hostReloadNeeded = Boolean(
    newest?.launchedAtEpoch && cacheInstalledAtEpoch && newest.launchedAtEpoch < cacheInstalledAtEpoch,
  );
  return {
    running: rows.length > 0,
    instanceCount: rows.length,
    newestPid: newest?.pid ?? null,
    newestLaunchedAt: newest?.launchedAt ?? null,
    hostReloadNeeded,
  };
}

function inspectCliFeatures() {
  try {
    const selected = new Map();
    for (const line of run("codex", ["features", "list"]).split("\n")) {
      const match = line.match(/^(apps|plugins|enable_mcp_apps)\s+\S+(?:\s+\S+)*\s+(true|false)$/u);
      if (match) selected.set(match[1], match[2] === "true");
    }
    return {
      apps: selected.get("apps") ?? null,
      plugins: selected.get("plugins") ?? null,
      enableMcpApps: selected.get("enable_mcp_apps") ?? null,
      note: "CLI feature values do not prove the desktop account rollout gate.",
    };
  } catch {
    return { apps: null, plugins: null, enableMcpApps: null, note: "Codex CLI feature status unavailable." };
  }
}

function inspectArtifacts(cachePath) {
  if (!cachePath || !existsSync(cachePath)) return { status: "cache-missing", checked: 0 };
  const relativePaths = [
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
  const mismatches = [];
  let checked = 0;
  for (const relativePath of relativePaths) {
    const sourcePath = path.join(repositoryRoot, "plugins", "gajendra", relativePath);
    const installedPath = path.join(cachePath, relativePath);
    if (!existsSync(sourcePath) || !existsSync(installedPath) || digest(sourcePath) !== digest(installedPath)) {
      mismatches.push(relativePath);
    }
    checked += 1;
  }
  return { status: mismatches.length === 0 ? "matched" : "mismatched", checked, mismatches };
}

async function inspectMcpInventory(appServerBinary) {
  if (!existsSync(appServerBinary)) {
    return { status: "unavailable", totalServers: null, reason: "bundled-app-server-missing" };
  }

  return await new Promise((resolve) => {
    const child = spawn(appServerBinary, ["app-server", "--listen", "stdio://"], {
      detached: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    let settled = false;
    let stdout = "";
    let totalServers = 0;
    let match = null;
    let requestId = 2;
    let timeout;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin.end();
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
      resolve(result);
    };

    const send = (message) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const requestPage = (cursor = null) => {
      send({
        jsonrpc: "2.0",
        id: requestId,
        method: "mcpServerStatus/list",
        params: { cursor, limit: 200, detail: "full" },
      });
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      for (;;) {
        const newlineIndex = stdout.indexOf("\n");
        if (newlineIndex < 0) break;
        const line = stdout.slice(0, newlineIndex).trim();
        stdout = stdout.slice(newlineIndex + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }

        if (message.id === 1) {
          if (message.error) {
            finish({ status: "unavailable", totalServers: null, reason: "initialize-failed" });
            return;
          }
          send({ jsonrpc: "2.0", method: "initialized" });
          requestPage();
          continue;
        }

        if (message.id !== requestId) continue;
        if (message.error) {
          finish({ status: "unavailable", totalServers: null, reason: "inventory-request-failed" });
          return;
        }
        const rows = Array.isArray(message.result?.data) ? message.result.data : [];
        totalServers += rows.length;
        const candidate = rows.find(
          (server) =>
            server.name === "gajendra" ||
            server.serverInfo?.name === "gajendra" ||
            server.serverInfo?.title === "Gaja, Elephant Focus for AI Power Users",
        );
        if (candidate) match = summarizeGajendraServer(candidate);

        const nextCursor = message.result?.nextCursor;
        if (nextCursor) {
          requestId += 1;
          requestPage(nextCursor);
          continue;
        }
        finish({
          status: match ? "present" : "absent",
          totalServers,
          gajendra: match,
        });
      }
    });

    child.on("error", () => {
      finish({ status: "unavailable", totalServers: null, reason: "app-server-start-failed" });
    });
    child.on("exit", () => {
      if (!settled) finish({ status: "unavailable", totalServers: null, reason: "app-server-exited" });
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "gajendra-host-preflight",
          title: "Gajendra host preflight",
          version: "0.3.1",
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
          mcpServerOpenaiFormElicitation: false,
          optOutNotificationMethods: [],
        },
      },
    });

    timeout = setTimeout(() => {
      finish({ status: "unavailable", totalServers: null, reason: "inventory-timeout" });
    }, 20_000);
  });
}

function summarizeGajendraServer(server) {
  const tools = server.tools && typeof server.tools === "object" ? server.tools : {};
  const openTool = tools.gajendra_open;
  const entrypoints = openTool?._meta?.["openai/ui"]?.entrypoints;
  return {
    name: server.name,
    serverTitle: server.serverInfo?.title ?? null,
    serverVersion: server.serverInfo?.version ?? null,
    toolNames: Object.keys(tools).sort(),
    resourceCount: Array.isArray(server.resources) ? server.resources.length : 0,
    authStatus: server.authStatus ?? null,
    globalEntrypointAdvertised:
      Array.isArray(entrypoints) && entrypoints.some((entrypoint) => entrypoint?.type === "global"),
    uiResourceAdvertised: typeof openTool?._meta?.ui?.resourceUri === "string",
    appVisibilityAdvertised:
      Array.isArray(openTool?._meta?.ui?.visibility) && openTool._meta.ui.visibility.includes("app"),
  };
}

function inspectState(filePath) {
  if (!existsSync(filePath)) return { status: "uninitialized", entryCount: 0, hasNow: false };
  try {
    const document = JSON.parse(readFileSync(filePath, "utf8"));
    const entries = Array.isArray(document.entries) ? document.entries : [];
    const uniqueIds = new Set(entries.map((entry) => entry.threadId));
    const currentMatches = document.currentFocusThreadId
      ? entries.filter(
          (entry) => entry.threadId === document.currentFocusThreadId && entry.level === "focus",
        ).length
      : 0;
    const valid =
      document.version === 2 &&
      uniqueIds.size === entries.length &&
      (document.currentFocusThreadId == null || currentMatches === 1);
    return {
      status: valid ? "valid" : "invalid",
      entryCount: entries.length,
      hasNow: document.currentFocusThreadId != null,
      currentIsUniqueFocus: document.currentFocusThreadId == null || currentMatches === 1,
      fileMode: (statSync(filePath).mode & 0o777).toString(8).padStart(3, "0"),
      directoryMode: (statSync(path.dirname(filePath)).mode & 0o777).toString(8).padStart(3, "0"),
    };
  } catch {
    return { status: "invalid", entryCount: null, hasNow: null };
  }
}

function plistValue(infoPath, key) {
  try {
    return run("plutil", ["-extract", key, "raw", "-o", "-", infoPath]).trim();
  } catch {
    return null;
  }
}

function digest(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function run(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
