import { access, readFile } from "node:fs/promises";
import path from "node:path";

const pluginRoot = path.resolve("plugins/gajendra");
const manifestPath = path.join(pluginRoot, ".codex-plugin/plugin.json");
const marketplacePath = path.resolve(".agents/plugins/marketplace.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
const brand = {
  name: "Gajendra",
  descriptor: "One clear focus across your AI tools.",
  promise: "One NOW. One short queue. One click back to the exact thread.",
};

assert(manifest.name === "gajendra", "plugin name must be gajendra");
assert(/^\d+\.\d+\.\d+$/u.test(manifest.version), "plugin version must be semantic");
assert(manifest.version === "0.3.1", "plugin release candidate must be version 0.3.1");
assert(manifest.description === brand.descriptor, "plugin description must use the approved Gajendra descriptor");
assert(manifest.interface?.displayName === brand.name, "plugin display name must use the Gajendra product identity");
assert(manifest.interface?.shortDescription === brand.descriptor, "plugin short description must use the approved descriptor");
assert(manifest.interface?.longDescription === brand.promise, "plugin long description must use the approved promise");
assert(marketplace.interface?.displayName === brand.name, "marketplace display name must use the Gajendra product identity");
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

const [adaptiveMark, appIcon, menuBarMark, webStyles, webMain, runtimeHtml, runtimeServer, publicBrandSurfaces] = await Promise.all([
  readFile(path.join(pluginRoot, "assets/gajendra.svg"), "utf8"),
  readFile(path.join(pluginRoot, "assets/gajendra-app-icon.svg"), "utf8"),
  readFile(path.join(pluginRoot, "assets/gajendra-menubar.svg"), "utf8"),
  readFile(path.join(pluginRoot, "src/ui/styles.css"), "utf8"),
  readFile(path.join(pluginRoot, "src/ui/main.ts"), "utf8"),
  readFile(path.join(pluginRoot, "dist/gajendra.html"), "utf8"),
  readFile(path.join(pluginRoot, "dist/server.mjs"), "utf8"),
  Promise.all([
    [".codex-plugin/plugin.json", manifestPath],
    [".mcp.json", path.join(pluginRoot, ".mcp.json")],
    ["package.json", path.join(pluginRoot, "package.json")],
    ["gajendra.html", path.join(pluginRoot, "gajendra.html")],
    ["assets/gajendra.svg", path.join(pluginRoot, "assets/gajendra.svg")],
    ["assets/gajendra-app-icon.svg", path.join(pluginRoot, "assets/gajendra-app-icon.svg")],
    ["assets/gajendra-menubar.svg", path.join(pluginRoot, "assets/gajendra-menubar.svg")],
    ["skills/gajendra/SKILL.md", path.join(pluginRoot, "skills/gajendra/SKILL.md")],
    ["src/ui/main.ts", path.join(pluginRoot, "src/ui/main.ts")],
    ["src/ui/motion.ts", path.join(pluginRoot, "src/ui/motion.ts")],
    ["src/ui/fixtures.ts", path.join(pluginRoot, "src/ui/fixtures.ts")],
    ["src/server/codex-app-server.ts", path.join(pluginRoot, "src/server/codex-app-server.ts")],
    ["src/server/index.ts", path.join(pluginRoot, "src/server/index.ts")],
    ["src/server/service.ts", path.join(pluginRoot, "src/server/service.ts")],
    ["src/server/store.ts", path.join(pluginRoot, "src/server/store.ts")],
    ["dist/gajendra.html", path.join(pluginRoot, "dist/gajendra.html")],
    ["dist/server.mjs", path.join(pluginRoot, "dist/server.mjs")],
  ].map(async ([relativePath, filePath]) => [relativePath, await readFile(filePath, "utf8")])),
]);
assert(adaptiveMark.includes(".main,.detail,.petal{fill:none;"), "adaptive elephant-and-lotus contours must remain outline-only");
assert(appIcon.includes('filter="url(#shadow)" fill="none"'), "app-icon mark must remain outline-only");
assert(menuBarMark.includes('<g fill="none"'), "menu-bar mark must remain outline-only");
assert(webStyles.includes(".gaja-mark-main, .gaja-mark-detail, .gaja-mark-petal { fill: none;"), "MCP App contours must remain outline-only");
assert(adaptiveMark.includes("stroke-width:3.55"), "adaptive elephant contour must keep its authored optical stroke");
assert(webStyles.includes("stroke-width: 3.55"), "MCP App elephant contour must keep its authored optical stroke");
assert(adaptiveMark.includes('<circle class="pupil"'), "adaptive mark must include the attentive eye pupil");
assert(appIcon.includes('class="gaja-mark-pupil"') || appIcon.includes('cx="63.1" cy="59"'), "app icon must include the attentive eye pupil");
assert(menuBarMark.includes('cx="63.1" cy="59"'), "menu-bar mark must include the attentive eye pupil");
assert(webMain.includes('class="gaja-mark-pupil"'), "MCP App mark must include the attentive eye pupil");
assert(webStyles.includes(".thread-search-footer"), "MCP App must keep the all-thread search footer visible");
assert(webStyles.includes(".deck-scroll-surface"), "MCP App must keep one bounded scroll surface above its search footer");
assert(webStyles.includes("grid-template-rows: minmax(0, 1fr) auto"), "MCP App search footer must remain a non-overlapping shell row");
assert(webMain.includes("data-running-toggle"), "MCP App Running section must remain expandable");
assert(webMain.includes("threadSearchFooter(snapshot, recent.length)"), "MCP App must render the all-thread search footer");
assert(webMain.includes('scrollIntoView({ block: "start" })'), "MCP App search must reveal its filtered results");
assert(webMain.includes("search.select()"), "MCP App search must synchronously select existing text when focused");
assert(webMain.includes('class="now-actions"'), "MCP App must align the NOW actions as one ordered group");
assert(webMain.includes('class="visual-settings"'), "MCP App must consolidate visual preferences under the header lotus");
assert(webMain.includes('aria-label="Open Gajendra settings"'), "MCP App header lotus settings needs an explicit accessible action");
assert(webMain.includes('class="brand-copy"'), "MCP App brand text and subtext must share one left-aligned stack beside the mark");
assert(webMain.includes('class="running-scope"'), "MCP App Running disclosure must expose its all-lanes scope as a visible control");
assert(webStyles.includes(".visual-settings-popover"), "MCP App must style the header-lotus settings disclosure near its control");
assert(webStyles.includes(".running-scope"), "MCP App must make the all-lanes Running disclosure visibly clickable");
assert(runtimeHtml.includes(`<title>${brand.name} — ${brand.descriptor}</title>`), "published MCP App title must use the approved Gajendra descriptor");
assert(runtimeHtml.includes(brand.promise), "published MCP App must include the approved Gajendra promise");
assert(runtimeServer.includes('title: "Gajendra"'), "published MCP server must expose the Gajendra app-server title");

// This is intentionally limited to product-facing and bundled runtime artifacts. Compatibility
// identifiers (for example data-gaja-theme, .gaja-mark, gajendra tool/package/storage names)
// and source-only tests are excluded because they are never rendered as product copy.
for (const [relativePath, contents] of publicBrandSurfaces) {
  for (const retiredPhrase of ["Gaja", "Elephant Focus for AI Power Users", "Double-star focus", "Focus ✦✦"]) {
    assert(!contents.includes(retiredPhrase), `${relativePath} retains retired public brand copy: ${retiredPhrase}`);
  }
}

const markPaths = [
  "M37 42C29 40 23 45 18 54C18 63 23 70 30 75C34 79 35 86 39 89C44 92 49 86 48 78C47 69 47 60 45 52C43 46 40 43 37 42Z",
  "M20 54C25 55 29 49 34 46C39 44 43 47 45 51C40 53 36 58 33 64",
  "M40 42C49 36 59 35 67 40C74 45 74 51 79 55C85 60 83 69 84 78C84 85 86 90 90 91C95 93 99 89 99 84C100 78 97 71 95 67C93 63 93 59 98 57C100 56 102 57 102 59",
  "M98 62C100 62 102 63 103 65C108 73 109 85 104 94C98 103 84 104 74 97C68 93 65 87 62 82",
  "M47 64C45 72 46 78 52 80C56 81 59 80 62 83",
  "M55 57C58 54 63 54 66 57",
  "M56 59C59 56 63 56 66 59C64 62 59 63 56 59Z",
  "M58 75C60 75 60 79 62 80C64 78 67 77 69 79",
  "M67 79C69 81 72 83 75 84C72 81 70 79 68 77",
  "M92 43C86 38 86 30 92 23C99 30 101 38 94 43C93 44 92 44 92 43Z",
  "M89 41C83 36 82 28 84 22C90 26 93 33 92 41",
  "M94 41C99 33 104 29 108 27C108 34 104 40 96 43",
  "M89 42C83 45 77 41 75 35C82 34 87 36 92 41",
  "M95 43C102 41 108 37 111 34C108 42 102 46 95 45",
  "M88 32C88 27 91 22 94 19C98 23 100 28 100 32",
  "M94 44C100 44 104 47 105 50C99 51 94 48 91 44",
  "M92 43C88 49 89 56 99 60.5",
];
for (const markPath of markPaths) {
  for (const [surface, source] of [
    ["adaptive SVG", adaptiveMark],
    ["app icon", appIcon],
    ["menu bar", menuBarMark],
    ["MCP App", webMain],
  ]) {
    assert(source.includes(markPath), `${surface} does not use the canonical elephant-and-lotus geometry: ${markPath}`);
  }
}
assert((adaptiveMark.match(/<path /gu) ?? []).length === 17, "adaptive mark must contain the reviewed seventeen-path elephant, eye, short tusk, trunk grip, curved stem, and lotus geometry");
assert((menuBarMark.match(/<path /gu) ?? []).length === 17, "menu-bar mark must contain the reviewed seventeen-path elephant, eye, short tusk, trunk grip, curved stem, and lotus geometry");

console.log(`Plugin validation passed: ${pluginRoot}`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
