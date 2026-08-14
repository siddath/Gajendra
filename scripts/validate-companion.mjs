import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const app = path.resolve("build/Gajendra.app");
const executable = path.join(app, "Contents/MacOS/Gajendra");
const service = path.join(app, "Contents/Resources/server.mjs");
const icon = path.join(app, "Contents/Resources/Gajendra.icns");
const menuBarIcon = path.join(app, "Contents/Resources/GajendraMenuBar.svg");
const info = path.join(app, "Contents/Info.plist");
const menuBarSource = path.resolve("companion/macos/Sources/GajendraApp/main.swift");
const contentSource = path.resolve("companion/macos/Sources/GajendraKit/DeckContentView.swift");
const overlaySource = path.resolve("companion/macos/Sources/GajendraKit/DeckWidgetView.swift");
const visualSettingsSource = path.resolve("companion/macos/Sources/GajendraKit/GajendraVisualSettings.swift");

await Promise.all([
  access(executable, constants.X_OK),
  access(service, constants.R_OK),
  access(icon, constants.R_OK),
  access(menuBarIcon, constants.R_OK),
  access(info, constants.R_OK),
  access(menuBarSource, constants.R_OK),
  access(contentSource, constants.R_OK),
  access(overlaySource, constants.R_OK),
  access(visualSettingsSource, constants.R_OK),
]);

run("codesign", ["--verify", "--deep", "--strict", app]);
const lsui = run("plutil", ["-extract", "LSUIElement", "raw", info]).stdout.trim();
if (lsui !== "false") throw new Error("Gajendra must keep its visible Dock/window recovery path.");
const bundleExecutable = run("plutil", ["-extract", "CFBundleExecutable", "raw", info]).stdout.trim();
if (bundleExecutable !== "Gajendra") throw new Error("The bundle executable must retain the Gajendra compatibility identity.");
const bundleDisplayName = run("plutil", ["-extract", "CFBundleDisplayName", "raw", info]).stdout.trim();
if (bundleDisplayName !== "Gaja") throw new Error("The visible bundle name must use the Gaja product identity.");
const bundleVersion = run("plutil", ["-extract", "CFBundleShortVersionString", "raw", info]).stdout.trim();
if (bundleVersion !== "0.3.1") throw new Error("The Gaja bundle version must be 0.3.1.");

const [menuBar, content, overlay, visualSettings] = await Promise.all([
  readFile(menuBarSource, "utf8"),
  readFile(contentSource, "utf8"),
  readFile(overlaySource, "utf8"),
  readFile(visualSettingsSource, "utf8"),
]);
for (const required of [
  "showPill(on: preferredScreen())",
  "GajendraPillView",
  "GajendraHoverCardView",
  ".nonactivatingPanel",
  "panel.level = .floating",
  ".canJoinAllSpaces",
  ".canJoinAllApplications",
  "NSWorkspace.didActivateApplicationNotification",
  "NSApplication.didChangeScreenParametersNotification",
  "DispatchQueue.main.asyncAfter(deadline: .now() + 0.22",
  "SMAppService.mainApp.register()",
  "Launch Gaja at Login",
  "let enteredPill = hoverState.setPillHovered(hovered)",
  "if enteredPill && !pillEditController.isEditing { model.refresh() }",
  "if !wasVisible && !hoverState.pillHovered { model.refresh() }",
  "panel.orderFrontRegardless()",
  "NSAnimationContext.runAnimationGroup",
  "accessibilityDisplayShouldReduceMotion",
  "NSEvent.addLocalMonitorForEvents",
  "NSEvent.addGlobalMonitorForEvents",
  "removePillEditDismissalMonitors()",
  "NSEvent.pressedMouseButtons",
  "pollForOutsidePillEditClick()",
  "NSEvent.mouseLocation",
  "GajendraOverlayPlacement.draggedOrigin",
]) {
  if (!menuBar.includes(required)) throw new Error(`Gajendra overlay contract is missing: ${required}`);
}
for (const required of ["bottomTrailingOrigin", "cardOrigin", "pillHovered || cardHovered", ".onHover", ".glassEffect(", "#available(macOS 26.0", ".thinMaterial"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra hover contract is missing: ${required}`);
}
for (const required of ["GajendraPillEditController", "dismissIfOutside", "LongPressGesture(minimumDuration: 0.55)", "editController.acceptsDrag", "DragGesture(minimumDistance: 1)", "onDragChanged", "onHide", "clampedOrigin", "pointerStart", "draggedOrigin"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra pill edit contract is missing: ${required}`);
}
for (const required of [".draggable(threadId)", ".dropDestination(for: String.self)", "moveDroppedThread"]) {
  if (!content.includes(required)) throw new Error(`Gajendra organizer drag contract is missing: ${required}`);
}
for (const required of ["ThreadContext.allCases", ".setContext(threadId:", "contextBadge("]) {
  if (!content.includes(required)) throw new Error(`Gajendra context-label contract is missing: ${required}`);
}
for (const required of ['Picker("Hover card size"', "$visualSettings.hoverCardSize"]) {
  if (!content.includes(required)) throw new Error(`Gajendra organizer visual-settings contract is missing: ${required}`);
}
if (!overlay.includes("contextBadge(")) throw new Error("The Gaja hover card is missing bounded context labels.");
for (const required of ["queueColumn(", "threads.prefix(5)", "moreButton(", "hoveredThreadId", "providerBadge(", "openButtonForeground", "GajendraThreadRowButtonStyle", "showsTopDivider", "pressedColor", "Fresh on hover · Local metadata"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra redesigned hover card contract is missing: ${required}`);
}
if (overlay.includes("Divider().padding(.leading")) throw new Error("Hover-card queue dividers must span the complete clickable row width.");
for (const required of ['case nativePopover = "native-popover"', 'case focusDeck = "focus-deck"', "case automatic", "case light", "case dark", "case compact", "case comfortable", "case expanded", "hoverCardSizeKey", "GajendraHoverCardSizing"]) {
  if (!visualSettings.includes(required)) throw new Error(`Gajendra visual preference contract is missing: ${required}`);
}
if (visualSettings.includes("command-capsule")) throw new Error("Command Capsule must not be a production theme.");
for (const required of ["visualSettings: visualSettings", "configureAppearance()", "resizeCard(for:", "GajendraHoverCardSizing.size(", "gajendra.pill.hidden", "Hide Gaja Lotus", "Show Gaja Lotus"]) {
  if (!menuBar.includes(required)) throw new Error(`Gajendra shared visual or pill recovery contract is missing: ${required}`);
}
const markBody = overlay.slice(overlay.indexOf("public struct GajendraMark"), overlay.indexOf("public struct GajendraGlassSurface"));
if (markBody.includes(".fill(")) throw new Error("The native lotus petals must remain outline-only.");
if (!markBody.includes(".stroke(")) throw new Error("The native lotus is missing its outline stroke.");
for (const required of ["size * 0.042", "point(64, 24)", "point(31, 49)", "point(97, 49)", "point(11, 72)", "point(117, 72)", "point(24, 102)", "point(38, 113)"]) {
  if (!markBody.includes(required)) throw new Error(`The native lotus is missing canonical vector geometry: ${required}`);
}
const pillBody = overlay.slice(overlay.indexOf("public struct GajendraPillView"), overlay.indexOf("public struct GajendraHoverCardView"));
if (pillBody.includes('Text("Gaja")')) throw new Error("The persistent Gaja control must remain icon-only.");
if (!menuBar.includes("NSStatusBar.system.statusItem")) throw new Error("Gajendra must retain its menu-bar fallback.");
if (!menuBar.includes("applicationShouldHandleReopen")) throw new Error("Gajendra must reopen its organizer from the Dock.");
if (!content.includes(".menuIndicator(.hidden)")) throw new Error("Gajendra row menus must hide the automatic indicator.");

const serviceEnvironment = {
  ...process.env,
  GAJENDRA_CODEX_BIN: process.env.GAJENDRA_CODEX_BIN || "/Applications/ChatGPT.app/Contents/Resources/codex",
};
const snapshot = runService(["--snapshot-json"], serviceEnvironment);
const currentCount = snapshot.focus.filter((thread) => thread.isCurrent).length;
if (currentCount > 1) throw new Error("The companion snapshot exposed more than one NOW task.");
if (snapshot.current && currentCount !== 1) throw new Error("The current task is not the unique Focus task.");
if (snapshot.current && !snapshot.current.deepLink && !snapshot.current.resumeCommand) {
  throw new Error("The current thread has no resumable destination.");
}
if (!Array.isArray(snapshot.sources) || snapshot.sources.length < 4) throw new Error("The unified source registry is missing.");
if (snapshot.error) throw new Error(`Gaja could not read configured thread sources: ${snapshot.error}`);

const bundledService = await readFile(service);
const sourceService = await readFile(path.resolve("plugins/gajendra/dist/server.mjs"));
if (!bundledService.equals(sourceService)) throw new Error("The companion service does not match the plugin service.");

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "gajendra-companion-validation-"));
try {
  const dataDirectory = path.join(temporaryRoot, "gajendra");
  const legacyDirectory = path.join(temporaryRoot, "legacy");
  await writeFile(path.join(temporaryRoot, "placeholder"), "");
  const mutationSnapshot = runService(
    ["--mutate-json"],
    { ...serviceEnvironment, GAJENDRA_DATA_DIR: dataDirectory },
    JSON.stringify({ type: "set-collapsed", level: "focus", collapsed: true }),
  );
  if (!mutationSnapshot.collapsed.focus) throw new Error("The companion mutation did not persist collapse state.");
  runService(
    ["--mutate-json"],
    { ...serviceEnvironment, GAJENDRA_DATA_DIR: dataDirectory },
    JSON.stringify({ type: "set-level", threadId: "codex:context-probe", level: "focus" }),
  );
  runService(
    ["--mutate-json"],
    { ...serviceEnvironment, GAJENDRA_DATA_DIR: dataDirectory },
    JSON.stringify({ type: "set-context", threadId: "codex:context-probe", context: "design" }),
  );
  const statePath = path.join(dataDirectory, "gajendra.v2.json");
  const stateContents = await readFile(statePath, "utf8");
  if (/title|preview|transcript|prompt/iu.test(stateContents)) throw new Error("Gajendra persisted live thread content.");
  if (!stateContents.includes('"context": "design"')) throw new Error("Gajendra did not persist the bounded thread context.");
  if (((await stat(dataDirectory)).mode & 0o777) !== 0o700) throw new Error("The Gajendra data directory is not private.");
  if (((await stat(statePath)).mode & 0o777) !== 0o600) throw new Error("The Gajendra state file is not private.");
  void legacyDirectory;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: "passed",
  appBundle: "valid-ad-hoc-signature",
  persistentBottomRightIcon: true,
  hoverDetailsCard: true,
  hoverExitGracePeriod: true,
  overlayCrossAppAndSpaces: true,
  screenChangeRepositioning: true,
  nonactivatingPanels: true,
  dockRecoverable: true,
  menuBarFallback: true,
  refreshOnReveal: true,
  outsideClickEndsPillEdit: true,
  globalPointerDragCoordinates: true,
  adaptiveHoverCardSizing: true,
  visibleQueueLimitPerTier: 5,
  hoverCardSizes: ["compact", "comfortable", "expanded"],
  distinctNativeAndFocusDeckSurfaces: true,
  reversibleLaunchAtLogin: true,
  rowMenuIndicatorHidden: true,
  bundledServiceMatchesPlugin: true,
  source: snapshot.source,
  focusCount: snapshot.focus.length,
  importantCount: snapshot.important.length,
  availableCount: snapshot.available.length,
  currentCount,
  resumableDestinationValid: !snapshot.current || Boolean(snapshot.current.deepLink || snapshot.current.resumeCommand),
  sourceCount: snapshot.sources.length,
  liquidGlassAvailabilityGate: true,
  systemMaterialFallback: true,
  isolatedMutationPassed: true,
  isolatedStatePermissionsPrivate: true,
  privateTaskContentRecorded: false,
  productionThemeCount: 2,
  appearanceModes: ["automatic", "light", "dark"],
  longPressPillEditMode: true,
  organizerDragAndDrop: true,
  boundedThreadContexts: ["design", "engineering", "life"],
}));

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} failed.`);
  return result;
}

function runService(args, env, input) {
  const child = spawnSync(process.execPath, [service, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env,
    input,
  });
  if (child.status !== 0) throw new Error(child.stderr.trim() || "The bundled Gajendra service failed.");
  return JSON.parse(child.stdout);
}
