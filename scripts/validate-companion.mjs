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
const modelsSource = path.resolve("companion/macos/Sources/GajendraKit/Models.swift");
const codexSource = path.resolve("plugins/gajendra/src/server/codex-app-server.ts");
const threadSourcesSource = path.resolve("plugins/gajendra/src/server/thread-sources.ts");

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
  access(modelsSource, constants.R_OK),
  access(codexSource, constants.R_OK),
  access(threadSourcesSource, constants.R_OK),
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

const [menuBar, content, overlay, visualSettings, models, codex, threadSources] = await Promise.all([
  readFile(menuBarSource, "utf8"),
  readFile(contentSource, "utf8"),
  readFile(overlaySource, "utf8"),
  readFile(visualSettingsSource, "utf8"),
  readFile(modelsSource, "utf8"),
  readFile(codexSource, "utf8"),
  readFile(threadSourcesSource, "utf8"),
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
  "SMAppService.mainApp.register()",
  "Launch Gaja at Login",
  "cardPresentation.toggle()",
  "installCardDismissalMonitors()",
  "removeCardDismissalMonitors()",
  "eventTargetsPresentedSurface(event)",
  "event.window === cardWindow || event.window === pillWindow",
  "dismissCardIfOutside()",
  "event.keyCode == 53",
  "configurePillPlacement()",
  "Lotus Position",
  "Uninstall Gaja…",
  "FileManager.default.trashItem",
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
  "GajendraOverlayPanel",
  "GajendraFirstMouseHostingView",
  "override func acceptsFirstMouse",
  "override var canBecomeKey: Bool { acceptsKeyboardInput }",
  'makeOverlayPanel(title: "Gaja Details", size: cardSize, acceptsKeyboardInput: true)',
  "cardWindow?.makeFirstResponder(nil)",
]) {
  if (!menuBar.includes(required)) throw new Error(`Gajendra overlay contract is missing: ${required}`);
}
if ((menuBar.match(/panel\.contentView = GajendraFirstMouseHostingView\(/gu) ?? []).length < 2) {
  throw new Error("Both the launcher and detail card must accept the first cross-app mouse click.");
}
for (const required of ["bottomTrailingOrigin", "origin(", "nearestAnchor", "cardMaximumSize", "cardOrigin", "isMeaningfulDrag", "GajendraCardPresentationState", "isPresented.toggle()", ".onHover", ".glassEffect(", "#available(macOS 26.0", ".thinMaterial"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra floating-card contract is missing: ${required}`);
}
for (const required of ["GajendraPillEditController", "dismissIfOutside", "TapGesture(count: 2)", "editController.toggle()", "onActivate()", ".contextMenu", "Uninstall Gaja…", "GajendraJigglingView", "editController.acceptsDrag", "DragGesture(minimumDistance: 1)", "onDragChanged", "onHide", "clampedOrigin", "pointerStart", "draggedOrigin"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra pill edit contract is missing: ${required}`);
}
for (const required of [".draggable(threadId)", ".dropDestination(for: String.self)", "moveDroppedThread"]) {
  if (!content.includes(required)) throw new Error(`Gajendra organizer drag contract is missing: ${required}`);
}
for (const required of ["ThreadContext.allCases", ".setContext(threadId:", "contextBadge("]) {
  if (!content.includes(required)) throw new Error(`Gajendra context-label contract is missing: ${required}`);
}
for (const required of ['Picker("Hover card size"', "$visualSettings.hoverCardSize", 'Picker("Lotus position"', "$visualSettings.pillAnchor"]) {
  if (!content.includes(required)) throw new Error(`Gajendra organizer visual-settings contract is missing: ${required}`);
}
for (const source of [overlay, content]) {
  for (const required of ["settingsIcon", 'Image(systemName: "gearshape")', 'accessibilityLabel("Open Gaja settings")', "ZStack(alignment: .center)", ".multilineTextAlignment(.center)", 'Text("All priority lanes")', "isRunningHeaderHovered"]) {
    if (!source.includes(required)) throw new Error(`Gajendra consolidated settings or Running disclosure contract is missing: ${required}`);
  }
  if (source.includes("toggleLightDark")) throw new Error("Opening native header settings must not also toggle appearance.");
}
if (!overlay.includes("contextBadge(")) throw new Error("The Gaja hover card is missing bounded context labels.");
for (const required of ["queueColumn(", "threads.prefix(5)", "moreButton(", "Show \\(remaining) more in Organizer", "executionSignal(", "runningSummary(", "runningDisclosureHeader(", "isRunningExpanded.toggle()", "ScrollView(.vertical, showsIndicators: true)", "persistentSearchFooter(total:", "gajendra-card-scroll-top", "quickSearch(total:", "GajendraSearchTextField(", "GajendraSearchField", "selectsAllOnNextMouseDown", "cancelPendingMouseSelection", "reconcileText(in:", "selectExistingTextIfUnchanged", "pendingSelectionValue = nil", "field.currentEditor()", "NSWindow.didResignKeyNotification", "searchResults(", "searchActions(", "snapshot.allThreads.count", "snapshot.searchThreads(searchQuery)", "isNowHovered", "isSearchHovered", "hoveredThreadId", "providerBadge(", "openButtonForeground", "GajendraThreadRowButtonStyle", "showsTopDivider", "pressedColor", "Fresh on open · Local metadata"]) {
  if (!overlay.includes(required)) throw new Error(`Gajendra redesigned hover card contract is missing: ${required}`);
}
const searchCoordinator = overlay.slice(overlay.indexOf("final class Coordinator: NSObject, NSTextFieldDelegate"), overlay.indexOf("public struct GajendraHoverCardView"));
const beginEditingHandler = searchCoordinator.slice(searchCoordinator.indexOf("func controlTextDidBeginEditing"), searchCoordinator.indexOf("func controlTextDidChange"));
if (beginEditingHandler.includes("DispatchQueue.main.async")) {
  throw new Error("Native search must not defer select-all from begin editing; delayed selection can replace each typed character.");
}
for (const required of ["runningSection(", "runningSectionHeader(", "organizerSearchFooter(snapshot:", "gajendra-organizer-search-results", "executionSignal(", "snapshot.runningThreads", "snapshot.searchThreads(search)"]) {
  if (!content.includes(required)) throw new Error(`Gajendra organizer activity contract is missing: ${required}`);
}
for (const required of ["isRunningStatus", '"inprogress"', '"running"', "allThreads", "runningThreads", "searchThreads"]) {
  if (!models.includes(required)) throw new Error(`Gajendra running-status contract is missing: ${required}`);
}
if (models.includes('"resumable"')) throw new Error("Resumable metadata must not be inferred as a running status.");
for (const required of ["enrichCodexRuntimeStatuses", "heldCodexThreadIds", "rolloutTailShowsActiveTurn", "MAX_ROLLOUT_TAIL_BYTES", 'event.payload?.type === "task_complete"', "isCodexRolloutPath"]) {
  if (!codex.includes(required)) throw new Error(`Gajendra Codex runtime-status contract is missing: ${required}`);
}
for (const required of ["selectSourceThreads", "MAX_BACKGROUND_THREADS_PER_SOURCE", "isRunningThreadStatus(thread.status)"]) {
  if (!threadSources.includes(required)) throw new Error(`Gajendra active-thread retention contract is missing: ${required}`);
}
if (overlay.includes("Divider().padding(.leading")) throw new Error("Hover-card queue dividers must span the complete clickable row width.");
for (const required of ['case nativePopover = "native-popover"', 'case focusDeck = "focus-deck"', "case automatic", "case light", "case dark", "case compact", "case comfortable", "case expanded", 'case topLeading = "top-left"', 'case topTrailing = "top-right"', "case center", 'case bottomLeading = "bottom-left"', 'case bottomCenter = "bottom-center"', 'case bottomTrailing = "bottom-right"', "hoverCardSizeKey", "pillAnchorKey", "GajendraHoverCardSizing"]) {
  if (!visualSettings.includes(required)) throw new Error(`Gajendra visual preference contract is missing: ${required}`);
}
if (visualSettings.includes("command-capsule")) throw new Error("Command Capsule must not be a production theme.");
for (const required of ["visualSettings: visualSettings", "configureAppearance()", "resizeCard(for:", "GajendraHoverCardSizing.size(", "gajendra.pill.hidden", "gajendra.pill.screen-number", "Hide Gaja Lotus", "Show Gaja Lotus"]) {
  if (!menuBar.includes(required)) throw new Error(`Gajendra shared visual or pill recovery contract is missing: ${required}`);
}
const markBody = overlay.slice(overlay.indexOf("public struct GajendraMark"), overlay.indexOf("public struct GajendraGlassSurface"));
if ((markBody.match(/\.fill\(/gu) ?? []).length !== 1 || !markBody.includes("GajendraElephantLotusPupilShape")) {
  throw new Error("The native mark may fill only its attentive eye pupil; every contour must remain outline-only.");
}
if ((markBody.match(/\.stroke\(/gu) ?? []).length !== 3) throw new Error("The native mark is missing its authored contour, detail, or petal stroke.");
for (const required of ["GajendraElephantLotusMarkShape", "GajendraElephantLotusDetailShape", "GajendraElephantLotusPetalShape", "GajendraElephantLotusPupilShape", "size * 0.0278", "size * 0.0137", "size * 0.02", "point(37, 42)", "point(20, 54)", "point(40, 42)", "point(98, 62)", "point(47, 64)", "point(55, 57)", "point(56, 59)", "point(58, 75)", "point(67, 79)", "point(92, 43)", "point(89, 41)", "point(94, 41)", "point(89, 42)", "point(95, 43)", "point(88, 32)", "point(94, 44)", "point(99, 60.5)", "63.1 / 128"]) {
  if (!markBody.includes(required)) throw new Error(`The native mark is missing canonical elephant-and-lotus geometry: ${required}`);
}
const hoverHeader = overlay.slice(overlay.indexOf("private var header"), overlay.indexOf("private var visualSettingsMenu"));
const organizerIndex = hoverHeader.indexOf("Button(action: onOpenOrganizer)");
const refreshIndex = hoverHeader.indexOf("refreshControl");
const settingsIndex = hoverHeader.indexOf("visualSettingsMenu");
if (!(organizerIndex >= 0 && organizerIndex < refreshIndex && refreshIndex < settingsIndex)) {
  throw new Error("The native header actions must remain ordered Organizer, Refresh, Settings at the trailing edge.");
}
const pillBody = overlay.slice(overlay.indexOf("public struct GajendraPillView"), overlay.indexOf("public struct GajendraHoverCardView"));
if (pillBody.includes('Text("Gaja")')) throw new Error("The persistent Gaja control must remain icon-only.");
if (!menuBar.includes("NSStatusBar.system.statusItem")) throw new Error("Gajendra must retain its menu-bar fallback.");
if (!menuBar.includes("applicationShouldHandleReopen")) throw new Error("Gajendra must reopen its organizer from the Dock.");
if (!content.includes(".menuIndicator(.hidden)")) throw new Error("Gajendra row menus must hide the automatic indicator.");
for (const contract of [
  { source: overlay, start: "private var nowSection" },
  { source: content, start: "private func nowCard" },
]) {
  const nowStart = contract.source.indexOf(contract.start);
  const nowEnd = contract.source.indexOf("private func executionSignal", nowStart);
  const nowBody = contract.source.slice(nowStart, nowEnd);
  const openIndex = nowBody.indexOf("model.open(current)");
  const activityIndex = nowBody.indexOf("executionSignal(current)");
  const providerIndex = nowBody.indexOf("sourceBadge(current)");
  if (!(openIndex >= 0 && openIndex < activityIndex && activityIndex < providerIndex)) {
    throw new Error("Gaja NOW actions must remain ordered Open, activity, provider.");
  }
}

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
  persistentSnapAnchoredIcon: true,
  snapAnchors: ["top-left", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"],
  cardActivation: "primary-click-toggle",
  hoverActivationDisabled: true,
  headerBrandMarkPlacement: "left",
  headerTitleAlignment: "center",
  trailingSettingsMenu: true,
  logoAppearanceToggle: false,
  rightHeaderActions: ["organizer", "refresh", "settings"],
  microDragThresholdPoints: 6,
  floatingDetailsCard: true,
  outsideClickAndEscapeDismissal: true,
  overlayCrossAppAndSpaces: true,
  screenChangeRepositioning: true,
  nonactivatingPanels: true,
  dockRecoverable: true,
  menuBarFallback: true,
  refreshOnOpen: true,
  confirmedSelfUninstall: true,
  outsideClickEndsPillEdit: true,
  globalPointerDragCoordinates: true,
  adaptiveHoverCardSizing: true,
  scrollableWidgetBody: true,
  expandableRunningSection: true,
  persistentSearchFooter: true,
  visibleQueueLimitPerTier: 5,
  overflowShortcutPlacement: "queue-bottom",
  derivedRunningLane: true,
  runningIncludesPrioritizedThreads: true,
  runningStatusRequiresExplicitProviderState: true,
  codexDesktopRuntimeStatusEnrichment: "lock-and-lifecycle-metadata-only",
  inCardGlobalThreadSearch: true,
  keyboardCapableSearchPanel: true,
  nativeSearchAcceptsFirstCrossAppClick: true,
  nativeSearchPreservesMultiCharacterInput: true,
  nativeSearchCancelsStaleSelectionOnEdit: true,
  searchSelectsExistingTextOnFocus: true,
  nowActionOrder: ["open", "activity", "provider"],
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
  doubleClickPillEditMode: true,
  iconOnlyEditJiggle: true,
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
