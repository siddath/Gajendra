import { access, readFile } from "node:fs/promises";
import path from "node:path";

const pluginRoot = path.resolve("plugins/gajendra");
const manifestPath = path.join(pluginRoot, ".codex-plugin/plugin.json");
const marketplacePath = path.resolve(".agents/plugins/marketplace.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));

assert(manifest.name === "gajendra", "plugin name must be gajendra");
assert(/^\d+\.\d+\.\d+$/u.test(manifest.version), "plugin version must be semantic");
assert(manifest.version === "0.3.1", "plugin release candidate must be version 0.3.1");
assert(manifest.interface?.displayName === "Gaja, Elephant Focus for AI Power Users", "plugin display name must use the Gaja product identity");
assert(manifest.mcpServers === "./.mcp.json", "plugin must declare its bundled MCP server");
assert(manifest.skills === "./skills/", "plugin must declare its bundled skill directory");
assert(manifest.license === "MIT", "plugin must declare the repository license");
assert(
  marketplace.plugins?.some(
    (entry) =>
      entry.name === manifest.name &&
      entry.source?.source === "local" &&
      entry.source?.path === "./plugins/gajendra",
  ),
  "marketplace must point to the plugin using a contained relative path",
);

for (const relativePath of [
  ".mcp.json",
  "assets/gajendra.svg",
  "assets/gajendra-app-icon.svg",
  "assets/gajendra-menubar.svg",
  "assets/gajendra-icon.png",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "third_party_licenses/modelcontextprotocol-ext-apps-LICENSE",
  "third_party_licenses/modelcontextprotocol-sdk-LICENSE",
  "third_party_licenses/gsap-LICENSE-NOTICE",
  "third_party_licenses/zod-LICENSE",
  "dist/server.mjs",
  "dist/gajendra.html",
  "skills/gajendra/SKILL.md",
]) {
  await access(path.join(pluginRoot, relativePath));
}

const [adaptiveMark, appIcon, menuBarMark, webStyles, webMain] = await Promise.all([
  readFile(path.join(pluginRoot, "assets/gajendra.svg"), "utf8"),
  readFile(path.join(pluginRoot, "assets/gajendra-app-icon.svg"), "utf8"),
  readFile(path.join(pluginRoot, "assets/gajendra-menubar.svg"), "utf8"),
  readFile(path.join(pluginRoot, "src/ui/styles.css"), "utf8"),
  readFile(path.join(pluginRoot, "src/ui/main.ts"), "utf8"),
]);
assert(adaptiveMark.includes(".petal{fill:none;"), "adaptive lotus petals must remain outline-only");
assert(appIcon.includes('filter="url(#shadow)" fill="none"'), "app-icon lotus petals must remain outline-only");
assert(menuBarMark.includes('<g fill="none"'), "menu-bar lotus petals must remain outline-only");
assert(webStyles.includes(".lotus-petal { fill: none;"), "MCP App lotus petals must remain outline-only");
assert(adaptiveMark.includes("stroke-width:2.25"), "adaptive lotus must keep its elegant thin-line stroke");
assert(webStyles.includes("stroke-width: 2.25"), "MCP App lotus must keep its elegant thin-line stroke");

const lotusPaths = [
  "M64 101C48 83 49 47 64 24C79 47 80 83 64 101Z",
  "M61 101C42 91 29 70 31 49C49 56 61 73 64 96",
  "M67 101C86 91 99 70 97 49C79 56 67 73 64 96",
  "M59 105C38 105 18 92 11 72C31 70 50 82 63 103",
  "M69 105C90 105 110 92 117 72C97 70 78 82 65 103",
  "M24 102C42 116 86 116 104 102",
  "M38 113C51 121 77 121 90 113",
];
for (const lotusPath of lotusPaths) {
  for (const [surface, source] of [
    ["adaptive SVG", adaptiveMark],
    ["app icon", appIcon],
    ["menu bar", menuBarMark],
    ["MCP App", webMain],
  ]) {
    assert(source.includes(lotusPath), `${surface} does not use the canonical lotus geometry: ${lotusPath}`);
  }
}
assert((adaptiveMark.match(/<path /gu) ?? []).length === 7, "adaptive lotus must contain exactly seven strokes");
assert((menuBarMark.match(/<path /gu) ?? []).length === 7, "menu-bar lotus must contain exactly seven strokes");

console.log(`Plugin validation passed: ${pluginRoot}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
