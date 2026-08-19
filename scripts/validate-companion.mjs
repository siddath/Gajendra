import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const product = {
  name: "Gajendra",
  descriptor: "One clear focus across your AI tools.",
  promise: "One NOW. One short queue. One click back to the exact thread.",
};
const app = path.resolve("build/Gajendra.app");
const executable = path.join(app, "Contents/MacOS/Gajendra");
const service = path.join(app, "Contents/Resources/server.mjs");
const bundledNode = path.join(app, "Contents/Resources/Runtime/node/bin/node");
const nodeLicense = path.join(app, "Contents/Resources/ThirdPartyNotices/Node-24.19.0-LICENSE");
const nodeNotices = path.join(app, "Contents/Resources/ThirdPartyNotices/Node-24.19.0-NOTICES.md");
const icon = path.join(app, "Contents/Resources/Gajendra.icns");
const menuBarIcon = path.join(app, "Contents/Resources/GajendraMenuBar.svg");
const info = path.join(app, "Contents/Info.plist");
const menuBarSource = path.resolve("companion/macos/Sources/GajendraApp/main.swift");
const contentSource = path.resolve("companion/macos/Sources/GajendraKit/DeckContentView.swift");
const overlaySource = path.resolve("companion/macos/Sources/GajendraKit/DeckWidgetView.swift");
const sourceOnboardingSource = path.resolve("companion/macos/Sources/GajendraKit/SourceOnboardingView.swift");
const modelsSource = path.resolve("companion/macos/Sources/GajendraKit/Models.swift");
const viewModelSource = path.resolve("companion/macos/Sources/GajendraKit/DeckViewModel.swift");
const deckClientSource = path.resolve("companion/macos/Sources/GajendraKit/DeckClient.swift");
const uiTestSource = path.resolve("companion/macos/Sources/GajendraUITest/main.swift");
const uiTestScript = path.resolve("companion/macos/scripts/test-ui.zsh");
const uiStoreFixture = path.resolve("plugins/gajendra/tests/fixtures/ui-interactions-store.json");
const uiSourcesFixture = path.resolve("plugins/gajendra/tests/fixtures/ui-interactions-sources.json");
const uiThreadsFixture = path.resolve("plugins/gajendra/tests/fixtures/ui-interactions-threads.json");
const codexSource = path.resolve("plugins/gajendra/src/server/codex-app-server.ts");
const threadSourcesSource = path.resolve("plugins/gajendra/src/server/thread-sources.ts");

await Promise.all([
  access(executable, constants.X_OK),
  access(service, constants.R_OK),
  access(bundledNode, constants.X_OK),
  access(nodeLicense, constants.R_OK),
  access(nodeNotices, constants.R_OK),
  access(icon, constants.R_OK),
  access(menuBarIcon, constants.R_OK),
  access(info, constants.R_OK),
  access(menuBarSource, constants.R_OK),
  access(contentSource, constants.R_OK),
  access(overlaySource, constants.R_OK),
  access(sourceOnboardingSource, constants.R_OK),
  access(modelsSource, constants.R_OK),
  access(viewModelSource, constants.R_OK),
  access(deckClientSource, constants.R_OK),
  access(uiTestSource, constants.R_OK),
  access(uiTestScript, constants.R_OK),
  access(uiStoreFixture, constants.R_OK),
  access(uiSourcesFixture, constants.R_OK),
  access(uiThreadsFixture, constants.R_OK),
  access(codexSource, constants.R_OK),
  access(threadSourcesSource, constants.R_OK),
]);

run("codesign", ["--verify", "--deep", "--strict", app]);
const plist = (key) => run("plutil", ["-extract", key, "raw", info]).stdout.trim();
assertEqual(plist("LSUIElement"), "false", "The bundle must retain Dock/window recovery.");
assertEqual(plist("CFBundleDisplayName"), product.name, "Visible bundle name drifted.");
assertEqual(plist("CFBundleName"), product.name, "Bundle name drifted.");
assertEqual(plist("CFBundleExecutable"), "Gajendra", "Executable compatibility identity drifted.");
assertEqual(plist("CFBundleIdentifier"), "dev.sid.gajendra", "Bundle identifier drifted.");
assertEqual(plist("LSMinimumSystemVersion"), "13.5", "macOS deployment floor drifted.");
assertEqual(plist("CFBundleURLTypes.0.CFBundleURLName"), "Gajendra Thread", "Visible URL type name drifted.");
assertEqual(plist("CFBundleURLTypes.0.CFBundleURLSchemes.0"), "gajendra", "URL-scheme compatibility identity drifted.");
if (!/^[0-9]+(?:[.][0-9]+){1,3}$/u.test(plist("CFBundleShortVersionString"))) {
  throw new Error("Bundle version must be a non-empty numeric release version.");
}
assertEqual(run(bundledNode, ["--version"]).stdout.trim(), "v24.19.0", "Bundled Node runtime drifted.");

const [menuBar, content, overlay, sourceOnboarding, models, viewModel, deckClient, codex, threadSources] = await Promise.all([
  readFile(menuBarSource, "utf8"),
  readFile(contentSource, "utf8"),
  readFile(overlaySource, "utf8"),
  readFile(sourceOnboardingSource, "utf8"),
  readFile(modelsSource, "utf8"),
  readFile(viewModelSource, "utf8"),
  readFile(deckClientSource, "utf8"),
  readFile(codexSource, "utf8"),
  readFile(threadSourcesSource, "utf8"),
]);
const [uiTest, uiTestHarness, uiStore, uiSources, uiThreads] = await Promise.all([
  readFile(uiTestSource, "utf8"),
  readFile(uiTestScript, "utf8"),
  readFile(uiStoreFixture, "utf8"),
  readFile(uiSourcesFixture, "utf8"),
  readFile(uiThreadsFixture, "utf8"),
]);
for (const [name, fixture] of [
  ["store", uiStore],
  ["sources", uiSources],
  ["threads", uiThreads],
]) {
  assert(Buffer.byteLength(fixture) <= 128 * 1024, `UI ${name} fixture exceeds 128 KiB`);
  JSON.parse(fixture);
  assertNoPrivateFixtureData(fixture, `UI ${name} fixture`);
}
assertContains(uiSources, [
  '"id": "ui-agent"',
  '"name": "Synthetic UI Agent"',
  '"catalog": "plugins/gajendra/tests/fixtures/ui-interactions-threads.json"',
], "synthetic UI source fixture");
assertContains(uiThreads, [
  '"project": "Synthetic UI fixture"',
  '"deepLink": "ui-agent://threads/',
], "synthetic UI thread fixture");

assertNoRetiredCopy([menuBar, content, overlay, sourceOnboarding, models, viewModel], "native source");
assertContains(models, [
  'public static let name = "Gajendra"',
  'public static let descriptor = "One clear focus across your AI tools."',
  'public static let promise = "One NOW. One short queue. One click back to the exact thread."',
  'public static func automaticAction() -> GajendraLaunchAtLoginAction { .readOnly }',
  '"move-before"',
  "currentThreadId",
  "expectedRevision",
  "idempotencyKey",
  '["javascript", "data", "file"]',
  "public struct ReviewSignal",
  "public var reviewReadyThreads",
  "public static let stationaryPressMilliseconds = 280",
  "public static let movementTolerance: CGFloat = 4",
], "native identity and mutation contract");
assertContains(menuBar, [
  "configureLaunchAtLogin()",
  "GajendraLaunchAtLoginToggle",
  "Launch Gajendra at Login",
  "Uninstall Gajendra",
  "Gajendra Details",
  "GajendraPillHostingView",
  "accessibilityPerformPress",
  "override func sendEvent(_ event: NSEvent)",
  "prepareCardPanel()",
  "refreshPresentedCardAfterReveal()",
  "GajendraHoverCardView(",
  'title: "Open Organizer"',
  "GajendraSurfaceRefreshPolicy.interval",
  "GajendraSurfacePresentationPolicy.shouldStopRefreshOnPopoverClose",
], "native menu and explicit-login contract");
const launchConfiguration = menuBar.slice(
  menuBar.indexOf("private func configureLaunchAtLogin"),
  menuBar.indexOf("private func updateLaunchAtLoginMenuState"),
);
if (!launchConfiguration || launchConfiguration.includes(".register()")) {
  throw new Error("Launch at Login must not register during automatic configuration.");
}
assertContains(viewModel, [
  "move-before",
  "expectedRevision",
  "idempotencyKey",
  "GajendraDeepLinkPolicy.isPermitted",
  "openReview",
], "native mutation/open boundary");
assertContains(deckClient, [
  "GajendraNodeResolver",
  "GAJENDRA_NODE_BIN",
  '.appendingPathComponent("Runtime", isDirectory: true)',
  'source: "bundled runtime"',
  "GajendraProcessLimits",
], "bundled runtime preference");
for (const source of [content, overlay]) {
  assertContains(source, [
    "GajendraBrandCopy.name",
    "GajendraBrandCopy.descriptor",
    "GajendraBrandCopy.promise",
    "contextBadge(",
    "Ready for Review",
    "No provider reports work ready for review.",
    "GajendraReviewStatusMark",
  ], "native visible brand/context contract");
}
assertContains(overlay, [
  "performPrimaryAction",
  "DragGesture(minimumDistance: GajendraOverlayPlacement.dragThreshold)",
  "Click to open priorities and finish moving",
  "GajendraStatusCountBadge",
  "GajendraQueueDragPreview",
  "GajendraQueueInteractionTuning",
  "selectedQueueThreadId",
  "GajendraSurfaceRefreshPolicy",
  "LongPressGesture(",
  "directQueueDragSurface",
  "Hold to select; keep holding to drag",
  '? "Dragging"',
  '? "Drop target"',
  ".onTapGesture(count: 2)",
], "launcher tap recovery contract");
assertContains(content, [
  "GajendraOrganizerTaskFramePreferenceKey",
  'DragGesture(minimumDistance: 3, coordinateSpace: .named("gajendra-organizer"))',
  "queueDragHandle",
  "GajendraStatusCountBadge",
  ".onTapGesture(count: 2)",
], "organizer drag and dock contract");
assertNotContains([content, overlay, models], [
  "GajendraQueueDragPayload",
  "GajendraQueueDragRegistry",
  "GajendraOrganizerDragCapture",
  "CoreTransferable",
  "NSPasteboard",
], "app-local queue drag contract");
assertContains(uiTest, [
  "microMovementTap",
  "edit-mode tap recovery",
  "AXUIElementPerformAction",
  "outer-edge open",
  "taskTapPreservesOpenMode",
  "taskLongPressSelected",
  "continuousHoldDrag",
  "dragWithIntermediateEvidence",
  "value: \"Dragging\"",
  "value: \"Drop target\"",
  "taskRowDragInEditMode",
  "queueDragAndDrop",
  "organizerQueueDragAndDrop",
  "dockSingleClickGuard",
  "runningDockDoubleClick",
  "reviewDockDoubleClick",
  "popupLatencyBudgetMet",
  "popupLatencyBudgetMilliseconds = 200",
  "waitForState",
], "process-level launcher UI regression");
assertContains(uiTestHarness, [
  "GAJENDRA_DATA_DIR",
  "ui-interactions-store.json",
  "ui-interactions-sources.json",
  "ui-interactions-threads.json",
  "GAJENDRA_UI_TEST_ASSERT_NO_ATTRIBUTE_CYCLES",
], "isolated launcher UI harness");

assertContains(codex, [
  "MAX_ROLLOUT_TAIL_BYTES = 256 * 1024",
  "DEFAULT_CODEX_APP_SERVER_MAX_LINE_BYTES = 512 * 1024",
  "MAX_CODEX_APP_SERVER_MAX_LINE_BYTES = 1_024 * 1_024",
  "GAJENDRA_CODEX_ACTIVITY_ENRICHMENT",
  "constants.O_NOFOLLOW",
  "realpath(",
  'event.payload?.type === "task_complete"',
  "MAX_CODEX_ENRICHMENT_CONCURRENCY",
  "MAX_CODEX_ENRICHMENT_DEADLINE_MS",
  '"thread/turns/list"',
  'itemsView: "notLoaded"',
  "requestAttestation: false",
  "isEligibleCodexReviewThread",
  "MAX_CODEX_REVIEW_CONCURRENCY",
  "MAX_CODEX_REVIEW_DEADLINE_MS",
  "classifyCodexReviewTurnPage",
  'summary.status !== "completed") return { kind: "not-ready" }',
  'summary.error !== null) return { kind: "invalid" }',
], "Codex enrichment boundary");
assertContains(threadSources, [
  "RESERVED_SOURCE_IDS",
  "Configured source ID is reserved.",
  "superRefine",
  "collectProcessOutput",
  "SIGTERM",
  "SIGKILL",
  "MAX_CURSOR_OUTPUT_BYTES",
  "MAX_BACKGROUND_THREADS_PER_SOURCE",
  "reviewSignalSchema",
  "Configured agent catalog contains a disallowed review destination.",
], "configured-source bounds");

const bundledService = await readFile(service);
const sourceService = await readFile(path.resolve("plugins/gajendra/dist/server.mjs"));
if (!bundledService.equals(sourceService)) {
  throw new Error("The bundled service does not match the generated plugin service.");
}

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "gajendra-companion-validation-"));
let snapshot;
let currentCount;
try {
  const dataDirectory = path.join(temporaryRoot, "gajendra");
  const catalogPath = path.join(temporaryRoot, "validator-threads.json");
  const sourcesConfigPath = path.join(temporaryRoot, "sources.json");
  const probeId = "validator:context-probe";
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
  await writeFile(catalogPath, JSON.stringify({
    version: 1,
    threads: [{
      id: "context-probe",
      title: "Synthetic context probe",
      project: "validator",
      updatedAt: "2026-08-18T00:00:00Z",
      status: "idle",
      deepLink: "validator://threads/context-probe",
      review: {
        state: "ready",
        kind: "diff",
        updatedAt: "2026-08-18T00:01:00Z",
        destination: { type: "url", url: "validator://reviews/context-probe" },
        providerStatus: "FINISHED",
      },
    }],
  }));
  await writeFile(sourcesConfigPath, JSON.stringify({
    version: 1,
    sources: [{
      id: "validator",
      name: "Companion validator",
      catalog: catalogPath,
      enabled: true,
      deepLinkSchemes: ["validator"],
    }],
  }));
  await writeFile(path.join(dataDirectory, "gajendra.v2.json"), JSON.stringify({
    version: 3,
    revision: 0,
    currentFocusThreadId: null,
    entries: [],
    collapsed: { focus: false, important: false },
    sourcePreferences: { codex: false, claude: false, cursor: false, grok: false, validator: true },
    idempotency: [],
  }), { mode: 0o600 });

  const isolatedServiceEnvironment = {
    ...process.env,
    GAJENDRA_DATA_DIR: dataDirectory,
    GAJENDRA_SOURCES_CONFIG: sourcesConfigPath,
    CODEX_HOME: path.join(temporaryRoot, "isolated-codex-home"),
    GAJENDRA_CODEX_ACTIVITY_ENRICHMENT: "off",
  };
  snapshot = runService(["--snapshot-json"], isolatedServiceEnvironment);
  currentCount = snapshot.focus.filter((thread) => thread.isCurrent).length;
  if (currentCount !== 0 || snapshot.current) {
    throw new Error("The isolated validator state was not empty before its synthetic mutation.");
  }
  if (snapshot.error) {
    throw new Error("Could not read isolated configured threads.");
  }
  if (!snapshot.sources.some((source) => source.id === "validator" && source.enabled && source.state === "ready" && source.threadCount === 1)) {
    throw new Error("The validator did not use its synthetic configured source.");
  }
  if (snapshot.available[0]?.review?.state !== "ready"
      || snapshot.available[0]?.review?.destination?.url !== "validator://reviews/context-probe") {
    throw new Error("The validator did not project its explicit configured review signal.");
  }
  for (const sourceId of ["codex", "claude", "cursor", "grok"]) {
    if (!snapshot.sources.some((source) => source.id === sourceId && !source.enabled && source.state === "disabled")) {
      throw new Error("The validator must disable every built-in source.");
    }
  }

  const mutationResult = runService(
    ["--mutate-json"],
    isolatedServiceEnvironment,
    JSON.stringify({
      protocolVersion: 1,
      expectedRevision: 0,
      idempotencyKey: "companion-validator-context-probe",
      mutation: {
        type: "move-before",
        threadId: probeId,
        level: "focus",
        context: "design",
        currentThreadId: probeId,
      },
    }),
  );
  if (mutationResult.outcome !== "applied" || mutationResult.revision !== 1) {
    throw new Error("The isolated mutation was not applied at revision 1.");
  }
  if (mutationResult.snapshot?.current?.id !== probeId || mutationResult.snapshot?.current?.context !== "design") {
    throw new Error("The isolated mutation returned an inconsistent context snapshot.");
  }
  snapshot = mutationResult.snapshot;
  currentCount = snapshot.focus.filter((thread) => thread.isCurrent).length;
  if (currentCount !== 1 || snapshot.current?.id !== probeId) {
    throw new Error("The synthetic snapshot exposed an invalid NOW task.");
  }

  const statePath = path.join(dataDirectory, "gajendra.v2.json");
  const stateContents = await readFile(statePath, "utf8");
  if (/title|preview|transcript|prompt|review|providerStatus|destination/iu.test(stateContents)) {
    throw new Error("The validator found persisted live thread content.");
  }
  if (!stateContents.includes('"context": "design"') || !stateContents.includes('"revision": 1')) {
    throw new Error("The validator did not persist the bounded design context and revision.");
  }
  if (((await stat(dataDirectory)).mode & 0o777) !== 0o700) {
    throw new Error("The isolated data directory is not private.");
  }
  if (((await stat(statePath)).mode & 0o777) !== 0o600) {
    throw new Error("The isolated state file is not private.");
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  status: "passed",
  validationScope: "local-bundle-and-source-contract",
  product,
  bundle: {
    executable: "Gajendra",
    identifier: "dev.sid.gajendra",
    urlScheme: "gajendra",
    macOSFloor: "13.5",
    bundledNode: "v24.19.0",
    codesignVerified: true,
    serviceMatchesGeneratedPlugin: true,
  },
  sourceContracts: {
    explicitLaunchAtLoginOnly: true,
    atomicMoveBefore: true,
    revisionCasAndIdempotency: true,
    safeOpenBoundary: true,
    codexTailBytes: 262144,
    codexEnrichmentKillSwitch: "GAJENDRA_CODEX_ACTIVITY_ENRICHMENT=off",
    configuredSourcesBoundedAndReservedIdsRejected: true,
    configuredReviewSignalsValidatedAndLiveOnly: true,
    appLocalQueueDragWithoutPasteboard: true,
    taskLongPressAndFullRowDrag: true,
    measuredWidgetPopupBudgetMilliseconds: 200,
    dockDoubleClickContract: true,
  },
  syntheticValidation: {
    configuredSourceOnly: true,
    builtInsDisabled: true,
    appliedMutationRevision: 1,
    persistedContext: "design",
    privateState: true,
    privateContentRecorded: false,
    reviewSignalPersisted: false,
    isolatedPointerFixturesPrivacyChecked: true,
  },
  evidenceBoundary: [
    "This validator does not assert installed-app, clean-Mac, physical accessibility, login-item, or manual human drag proof.",
    "This validator does not assert Developer ID, notarization, Gatekeeper, distribution, or publication proof.",
  ],
}));

function assertContains(source, required, label) {
  for (const value of required) {
    if (!source.includes(value)) throw new Error(label + " is missing: " + value);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNotContains(sources, forbidden, label) {
  for (const value of forbidden) {
    if (sources.some((source) => source.includes(value))) {
      throw new Error(label + " contains forbidden value: " + value);
    }
  }
}

function assertNoPrivateFixtureData(source, label) {
  const forbidden = [
    /\/Users\//u,
    /(?:^|\s)~\//mu,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
    /https?:\/\//iu,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error(`${label} contains private or non-synthetic data: ${pattern}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message + " Expected " + expected + ", got " + actual + ".");
}

function assertNoRetiredCopy(sources, label) {
  const retired = /(^|[^A-Za-z])Gaja([^A-Za-z]|$)|Elephant Focus for AI Power Users|Double-star focus|Focus ✦✦|Focus Now/u;
  if (sources.some((source) => retired.test(source))) {
    throw new Error(label + " contains retired visible copy.");
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || command + " failed.");
  return result;
}

function runService(args, env, input) {
  const child = spawnSync(process.execPath, [service, ...args], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    env,
    input,
  });
  if (child.status !== 0) {
    throw new Error(child.stderr.trim() || "The bundled Gajendra service failed.");
  }
  return JSON.parse(child.stdout);
}
