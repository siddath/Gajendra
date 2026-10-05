import { App, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";

import {
  allDeckThreads,
  productDeckProjection,
  isDeckMutationResult,
  isPermittedDeepLink,
  isRunningThreadStatus,
  MUTATION_PROTOCOL_VERSION,
  normalizeDeckSelection,
  type DeckSnapshot,
  type DeckThread,
  type PriorityLevel,
  type ThreadContext,
} from "../shared/contracts.js";
import { fixtureSnapshot } from "./fixtures.js";
import { createDeckMotion, type DeckLayoutState, type RenderReason } from "./motion.js";
import { ReviewAcknowledgements, preserveNewerReviewEvidence, type ReviewAcknowledgement } from "./review-acknowledgements.js";
import "./styles.css";

const queriedRoot = document.querySelector<HTMLDivElement>("#app");
if (!queriedRoot) throw new Error("Gajendra root was not found.");
const root: HTMLDivElement = queriedRoot;
const motion = createDeckMotion(root);

type VisualTheme = "native" | "focus-deck";
type AppearancePreference = "auto" | "light" | "dark";
type ResolvedAppearance = "light" | "dark";
type HostTestHooks = {
  createApp?: () => App;
  navigate?: (url: string) => void;
};
type OpenRouteIntent = "thread" | "review";
type AuthoritativeOpenTarget = { url: string; thread: DeckThread };
type CapturedOpenIntent = { threadId: string; route: OpenRouteIntent; destination: string };

const themeStorageKey = "gajendra.ui.theme.v1";
const appearanceStorageKey = "gajendra.ui.appearance.v1";
const systemDarkMode = window.matchMedia("(prefers-color-scheme: dark)");

let visualTheme: VisualTheme = readEnumPreference(themeStorageKey, ["native", "focus-deck"], "native");
let appearancePreference: AppearancePreference = readEnumPreference(appearanceStorageKey, ["auto", "light", "dark"], "auto");
let hostAppearance: ResolvedAppearance | null = null;
let hostStyles: Parameters<typeof applyHostStyleVariables>[0] = {};
const hostStyleMap = {
  "--canvas": "--color-background-primary",
  "--surface": "--color-background-secondary",
  "--surface-raised": "--color-background-primary",
  "--text": "--color-text-primary",
  "--muted": "--color-text-secondary",
  "--border": "--color-border-primary",
} as const;
let searchQuery = "";
let historyExpanded = false;
let historyFilter: "all" | "reviewed" | "finished" = "all";
let continuationThreadId: string | null = null;
let undoAction: { tool: string; args: Record<string, unknown>; label: string } | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let checkingRevision = false;
let lastProviderRefresh = Date.now();
let refreshing = false;
let syncFailed = false;
const fixtureReviewed = new Map<string, NonNullable<DeckThread["review"]>>();
const reviewAcknowledgements = new ReviewAcknowledgements();
let reviewQueue: Promise<void> = Promise.resolve();
let snapshotGeneration = 0;
let fixtureReviewAttempt = 0;

let snapshot: DeckSnapshot | null = null;
let app: App | null = null;
let connected = false;
let busy = false;
let runningExpanded = true;
let reviewExpanded = true;
let draggedThreadId: string | null = null;
const fixtureNow = new Date("2026-08-11T15:00:00.000Z").valueOf();

applyVisualPreferences();
systemDarkMode.addEventListener("change", handleSystemAppearanceChange);
root.addEventListener("keydown", handleSearchShortcut);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void checkSharedRevision(); });

window.addEventListener("pagehide", () => {
  if (syncTimer) clearInterval(syncTimer);
  systemDarkMode.removeEventListener("change", handleSystemAppearanceChange);
  root.removeEventListener("keydown", handleSearchShortcut);
  motion.destroy();
}, { once: true });

void start();

async function start(): Promise<void> {
  if (shouldUseFixture()) {
    snapshot = normalizeDeckSelection(structuredClone(fixtureSnapshot));
    render("initial");
    return;
  }

  if (busy) return;
  busy = true;
  connected = false;
  app = hostTestHooks()?.createApp?.() ?? new App({ name: "Gajendra", version: "0.4.0" });
  const connectingApp = app;
  app.addEventListener("hostcontextchanged", (context) => {
    if (app === connectingApp) acceptHostAppearance(context);
  });
  app.ontoolresult = (result) => {
    if (app !== connectingApp || (busy && connected && snapshot !== null)) return;
    try { acceptSnapshot(result.structuredContent, snapshot ? "external" : "initial"); }
    catch (error) { renderRecoverableError(error, motion.captureLayout()); }
  };
  renderLoading();
  try {
    await app.connect();
    connected = true;
    acceptHostAppearance(app.getHostContext());
    if (!syncTimer) syncTimer = setInterval(() => void checkSharedRevision(), 5000);
    // Entrypoints deliver the initial result through the bridge. Do not throw it
    // away and run another full provider scan before showing the user's queues.
    // If a host fails to deliver it, the loading view offers an explicit retry.
  } catch (error) {
    renderConnectionError(error);
  } finally {
    busy = false;
    motion.setBusy(false);
  }
  if (snapshot?.cachedAt) void refresh(true, true);
}

function shouldUseFixture(): boolean {
  const parameters = new URLSearchParams(window.location.search);
  return parameters.has("fixture") || (window.parent === window && !parameters.has("host-test"));
}

/**
 * The host-test query only enables a Playwright-injected test double; normal standalone pages
 * retain fixture mode and embedded MCP Apps always instantiate the real App transport.
 */
function hostTestHooks(): HostTestHooks | null {
  if (!new URLSearchParams(window.location.search).has("host-test")) return null;
  return (window as Window & { __gajendraHostTest?: HostTestHooks }).__gajendraHostTest ?? null;
}

function acceptSnapshot(value: unknown, reason: RenderReason, layoutState: DeckLayoutState | null = motion.captureLayout()): void {
  if (isDeckMutationResult(value)) {
    if (snapshot && value.snapshot.revision < snapshot.revision) return;
    if (snapshot && value.snapshot.revision !== snapshot.revision) undoAction = null;
    snapshot = normalizeDeckSelection({
      ...value.snapshot,
      error: value.error?.message ?? value.snapshot.error,
    });
    reviewAcknowledgements.observe(snapshot);
    snapshotGeneration += 1;
    render(reason, layoutState);
    return;
  }
  if (!value || typeof value !== "object" || !("focus" in value)
    || !Array.isArray(value.focus) || !("important" in value) || !Array.isArray(value.important)
    || !("available" in value) || !Array.isArray(value.available)
    || !("sources" in value) || !Array.isArray(value.sources)) {
    throw new Error("Gajendra received no usable thread data. Try again to reconnect.");
  }
  if (snapshot && "revision" in value && typeof value.revision === "number" && value.revision < snapshot.revision) return;
  if (snapshot && "revision" in value && value.revision !== snapshot.revision) undoAction = null;
  snapshot = normalizeDeckSelection(value as DeckSnapshot);
  reviewAcknowledgements.observe(snapshot);
  snapshotGeneration += 1;
  render(reason, layoutState);
}

function render(reason: RenderReason = "external", layoutState: DeckLayoutState | null = null): void {
  if (!snapshot) return renderLoading();
  const previousSearch = root.querySelector<HTMLInputElement>("#task-search");
  const previousFocus = document.activeElement as HTMLElement | null;
  const focusAction = previousFocus?.dataset.action;
  const focusThreadId = previousFocus?.dataset.threadId;
  const focusReviewToggle = previousFocus?.hasAttribute("data-review-toggle");
  const searchWasFocused = previousSearch === document.activeElement;
  const searchSelection = [previousSearch?.selectionStart ?? 0, previousSearch?.selectionEnd ?? 0] as const;
  const focusedSource = (document.activeElement as HTMLElement | null)?.matches("button[data-action=source-toggle]")
    ? (document.activeElement as HTMLElement).dataset.sourceId : undefined;
  const settingsWereOpen = root.querySelector<HTMLDetailsElement>(".visual-settings")?.open ?? false;
  const scrollTop = root.querySelector<HTMLElement>(".deck-scroll-surface")?.scrollTop ?? 0;
  const openMenus = [...root.querySelectorAll<HTMLDetailsElement>(".row-menu[open]")].map((menu) => menu.closest<HTMLElement>("[data-thread-id]")?.dataset.threadId).filter(Boolean);
  const previousContinuation = root.querySelector<HTMLInputElement>("#continuation-search");
  const continuationQuery = previousContinuation?.value ?? "";
  const continuationWasFocused = previousContinuation === document.activeElement;
  const product = snapshot.product ?? productDeckProjection(snapshot);
  const running = product.running;
  const reviewReady = reviewAcknowledgements.ready(snapshot);
  const recent = product?.history ?? snapshot.available.filter((thread) => !isRunningThreadStatus(thread.status) && thread.review?.state !== "ready");
  const pendingHistory = allDeckThreads(snapshot).filter(thread => thread.review?.identity
    && reviewAcknowledgements.operations.get(thread.review.identity)?.state === "pending"
    && !recent.some(row => row.id === thread.id));
  const ongoing = product?.continue ?? [...snapshot.focus, ...snapshot.important];
  const ongoingIds = new Set(ongoing.map((thread) => thread.id));
  root.innerHTML = `
    <div class="deck-scroll-surface" aria-label="Scrollable Gajendra task overview">
      <header class="deck-header">
        <div class="deck-header-top">
          <div class="brand-lockup">
            ${brandMark()}
            <div class="brand-copy">
              <h1>Gajendra</h1>
              <p class="lede">Your work, within reach.</p>
            </div>
          </div>
          <button class="refresh-action" type="button" data-action="refresh" aria-label="Refresh Gajendra">
            <span data-refresh-label>Refresh</span>
          </button>
        </div>
        <span class="visually-hidden" role="status" aria-live="polite" data-refresh-status>Ready</span>
      </header>
      ${snapshot.error ? errorPanel(snapshot.error) : ""}
      ${reviewFeedback()}
      ${syncFailed ? '<p class="source-notice" role="status">Sync interrupted. Showing the last saved view. Use Refresh to reconnect.</p>' : ""}
      ${undoAction ? `<div class="action-receipt" role="status"><span>${escapeHtml(undoAction.label)}</span><button type="button" class="text-action" data-action="undo-work">Undo</button></div>` : ""}
      ${snapshot.staleEntryCount > 0 ? `<p class="source-notice" role="status">${snapshot.staleEntryCount} saved ${snapshot.staleEntryCount === 1 ? "priority is" : "priorities are"} outside the available source results. Your saved choices have not been removed.</p>` : ""}
      ${currentPanel(snapshot.current)}
      ${reviewSection(reviewReady)}
      ${product?.needsInput.length ? needsInputSection(product.needsInput) : ""}
      ${runningSection(running)}
      <section class="continue-section" aria-labelledby="continue-heading">
        <h2 id="continue-heading">Your priorities</h2>
        ${section("focus", "Focus", "", snapshot.focus.filter((thread) => ongoingIds.has(thread.id)))}
        ${section("important", "Important", "", snapshot.important.filter((thread) => ongoingIds.has(thread.id)))}
      </section>
      ${continuationPicker()}
      ${availableSection(snapshot, [...recent, ...pendingHistory])}
      ${sourcesPanel(snapshot.sources)}
      <footer class="deck-footer">
        <span>${snapshot.cachedAt ? `Saved view · ${escapeHtml(new Date(snapshot.cachedAt).toLocaleString())}` : syncFailed ? "Sync unavailable" : "Changes sync with the Mac app"}</span>
        <span>Local to this Mac</span>
      </footer>
    </div>
    ${threadSearchFooter(snapshot, recent.length)}
  `;
  bindInteractions();
  applySearch(false);
  const settings = root.querySelector<HTMLDetailsElement>(".visual-settings");
  if (settings) settings.open = settingsWereOpen;
  root.querySelectorAll<HTMLDetailsElement>(".row-menu").forEach((menu) => {
    if (openMenus.includes(menu.closest<HTMLElement>("[data-thread-id]")?.dataset.threadId)) menu.open = true;
  });
  const scrollSurface = root.querySelector<HTMLElement>(".deck-scroll-surface");
  if (scrollSurface) scrollSurface.scrollTop = scrollTop;
  if (continuationWasFocused) {
    const input = root.querySelector<HTMLInputElement>("#continuation-search");
    if (input) { input.value = continuationQuery; input.dispatchEvent(new Event("input")); input.focus({ preventScroll: true }); }
  } else if (searchWasFocused) {
    const search = root.querySelector<HTMLInputElement>("#task-search");
    search?.focus({ preventScroll: true });
    search?.setSelectionRange(...searchSelection);
  } else if (focusedSource) {
    root.querySelector<HTMLButtonElement>(`button[data-action=source-toggle][data-source-id="${CSS.escape(focusedSource)}"]`)?.focus({ preventScroll: true });
  } else if (focusAction) {
    root.querySelector<HTMLButtonElement>(`button[data-action="${CSS.escape(focusAction)}"]${focusThreadId ? `[data-thread-id="${CSS.escape(focusThreadId)}"]` : ""}`)?.focus({ preventScroll: true });
  } else if (focusReviewToggle) {
    root.querySelector<HTMLButtonElement>("button[data-review-toggle]")?.focus({ preventScroll: true });
  }
  motion.setBusy(busy);
  if (reviewAcknowledgements.pending) {
    // Keep review, navigation, disclosure and Refresh usable while serializing store writes.
    root.querySelectorAll<HTMLButtonElement>("button[data-collapse], button[data-action]").forEach(button => {
      if (button.hasAttribute("data-collapse") || /^(undo-work|source-toggle|current|move-|level-|finish-work|reopen-work|confirm-link|unlink-next)/u.test(button.dataset.action ?? "")) button.disabled = true;
    });
    root.querySelectorAll<HTMLSelectElement>("select[data-context-thread-id]").forEach(select => { select.disabled = true; });
  }
  motion.animateRender(layoutState, reason);
}

function currentPanel(current: DeckThread | null): string {
  if (!current) {
    return `<section class="now-card now-empty" aria-labelledby="now-heading">
      <div><h2 id="now-heading">Choose your next focus</h2></div>
      <p>Pick a chat below and choose Make Now.</p>
    </section>`;
  }
  return `<section class="now-card" aria-labelledby="now-heading">
    <div class="now-topline"><p class="now-label"><strong>NOW</strong><small>${escapeHtml(current.sourceName)}</small></p></div>
    <div class="now-content">
      <div><h2 class="record-title" id="now-heading" title="${escapeAttribute(current.title)}">${recordTitle(current.title)}</h2><p class="thread-meta">${escapeHtml(current.project)} ${contextBadge(current)}</p></div>
      <div class="now-actions" aria-label="Current task actions">
        <a class="primary-action" ${openThreadAttributes(current)} aria-current="true">Open thread <span data-open-arrow aria-hidden="true">→</span></a>
        ${activitySignal(current)}
        ${workActions(current)}
      </div>
    </div>
  </section>`;
}

function activitySignal(thread: DeckThread): string {
  const running = isRunningThreadStatus(thread.status);
  const ready = !running && thread.review?.state === "ready";
  const label = running ? "Running now" : ready ? "Ready for Review" : "Ready to resume";
  const date = ready ? relativeDate(thread.review?.updatedAt ?? thread.updatedAt) : relativeDate(thread.updatedAt);
  return `<div class="activity-signal" data-running="${String(running)}" aria-label="${label}. ${date}">
    <span class="activity-symbol" aria-hidden="true">${running ? "●" : ready ? reviewTrayIcon() : "◷"}</span>
    <span><strong>${label}</strong><small>${date}</small></span>
  </div>`;
}

function headingIcon(kind: PriorityLevel | "running" | "review"): string {
  const paths = kind === "running"
    ? '<path data-hover-part="wave" d="M5 9v6"/><path data-hover-part="wave" d="M10 5v10"/><path data-hover-part="wave" d="M15 7v8"/>'
    : kind === "review"
      ? '<g class="heading-letter" data-hover-part="letter"><rect x="6" y="6" width="8" height="6" rx="1"/><path d="m6 7 4 3 4-3"/></g><path class="heading-tray" d="M3 10h4l2 3h2l2-3h4v6H3z"/>'
      : kind === "focus"
        ? '<path class="heading-fill" d="m10 2 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>'
        : '<path class="heading-fill" data-hover-part="bookmark" d="M6 3h8v14l-4-3-4 3z"/>';
  return `<svg class="heading-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function section(level: PriorityLevel, title: string, description: string, threads: DeckThread[]): string {
  const isCollapsed = snapshot?.collapsed[level] ?? false;
  const warning = level === "focus" && snapshot?.focusOverGuide
    ? `<p class="section-warning" role="status">You have more than the ${snapshot.focusGuide}-task focus guide. Choose what you want to continue.</p>`
    : "";
  return `<section class="deck-section" data-drop-level="${level}" aria-labelledby="${level}-heading">
    <button class="section-toggle" type="button" data-heading-hover="${level}" data-collapse="${level}" aria-expanded="${String(!isCollapsed)}" aria-controls="${level}-list">
      <span><span class="section-heading"><span class="section-title" id="${level}-heading">${headingIcon(level)}${escapeHtml(title)}</span><span class="section-count">${threads.length}</span></span>${description ? `<span class="section-description">${escapeHtml(description)}</span>` : ""}</span>
      <span class="chevron" aria-hidden="true">${chevronIcon()}</span>
    </button>
    ${warning}
    <ol class="thread-list" id="${level}-list" data-drop-level="${level}" ${isCollapsed ? "hidden" : ""}>
      ${threads.length ? threads.map((thread, index) => threadRow(thread, index, threads.length)).join("") : emptyRow(level)}
    </ol>
  </section>`;
}

function threadRow(thread: DeckThread, index: number, count: number): string {
  return `<li class="thread-row ${thread.isCurrent ? "is-current" : ""}" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-level="${escapeAttribute(thread.level ?? "")}" data-flip-id="thread-${escapeAttribute(thread.id)}">
    <div class="thread-main">
      <div class="thread-heading-line">
        ${thread.isCurrent ? '<span class="now-pill">NOW</span>' : ""}
        <a class="record-title" title="${escapeAttribute(thread.title)}" ${openThreadAttributes(thread)}>${recordTitle(thread.title)}</a>
      </div>
      <p class="thread-meta">${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${contextBadge(thread)} ${sourceBadge(thread)}</p>${chatHistory(thread)}
    </div>
    <div class="row-actions" aria-label="Actions for ${escapeAttribute(thread.title)}">
      <details class="row-menu"><summary>Actions<span class="visually-hidden"> for ${escapeHtml(thread.title)}</span></summary><div class="row-menu-actions">
      ${contextSelector(thread)}
      ${thread.level === "focus" && !thread.isCurrent ? actionButton("Make Now", "current", thread.id) : ""}
      ${moveButtons(thread.id, index, count)}
      ${thread.isCurrent ? "" : thread.level === "focus" ? actionButton("Important", "level-important", thread.id) : actionButton("Focus", "level-focus", thread.id)}
      ${thread.isCurrent ? "" : actionButton("Remove", "level-none", thread.id)}
      ${workActionButtons(thread)}
      </div></details>
    </div>
  </li>`;
}

function runningSection(threads: DeckThread[]): string {
  return `<section class="running-section deck-section" aria-labelledby="running-heading">
    <button class="running-heading running-toggle" type="button" data-heading-hover="running" data-running-toggle aria-expanded="${String(runningExpanded)}" aria-controls="running-list" ${threads.length ? "" : "disabled"}>
      <span><span class="running-title">${headingIcon("running")}<span id="running-heading">Running</span><span class="section-count">${threads.length}</span></span></span>
      ${threads.length ? `<span class="running-chevron chevron" aria-hidden="true">${chevronIcon()}</span>` : ""}
    </button>
    <ul class="running-list thread-list" id="running-list" ${runningExpanded ? "" : "hidden"}>
      ${threads.length ? threads.map(runningRow).join("") : `<li class="empty-row">${snapshot?.cachedAt ? "Checking live activity. Your saved work is available below." : "No provider reports active work."}</li>`}
    </ul>
  </section>`;
}

function runningRow(thread: DeckThread): string {
  return `<li class="available-row running-row" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="running-${escapeAttribute(thread.id)}">
    <div><a class="record-title" title="${escapeAttribute(thread.title)}" ${openThreadAttributes(thread)}>${recordTitle(thread.title)}</a><p class="thread-meta">${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${sourceBadge(thread)} ${placementBadge(thread)}</p></div>
    <div class="available-actions">${threadActions(thread)}</div>
  </li>`;
}

function reviewSection(threads: DeckThread[]): string {
  return `<section class="review-section deck-section" aria-labelledby="review-heading">
    <button class="running-heading review-heading" type="button" data-heading-hover="review" data-review-toggle aria-expanded="${String(reviewExpanded)}" aria-controls="review-list">
      <span><span class="running-title review-title">${headingIcon("review")}<span id="review-heading">Ready for Review</span><span class="section-count">${threads.length}</span></span></span>
      ${threads.length ? `<span class="review-chevron chevron" aria-hidden="true">${chevronIcon()}</span>` : ""}
    </button>
    <ul class="running-list review-list thread-list" id="review-list" ${reviewExpanded ? "" : "hidden"}>
      ${threads.length ? threads.map(reviewRow).join("") : `<li class="empty-row">${snapshot?.cachedAt ? "Checking for results. Your saved work is available below." : "No results waiting for review."}</li>`}
    </ul>
  </section>`;
}

function reviewRow(thread: DeckThread): string {
  return `<li class="available-row review-row" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="review-${escapeAttribute(thread.id)}">
    <div class="review-row-main"><a class="review-primary" title="${escapeAttribute(thread.title)}" ${openReviewAttributes(thread)}><span><strong class="record-title">${recordTitle(thread.title)}</strong><small>${relativeDate(thread.review?.updatedAt ?? 0)}</small></span></a><p class="thread-meta">${sourceBadge(thread)} ${placementBadge(thread)}</p></div>
    <div class="available-actions">${reviewDoneButton(thread)}${threadActions(thread)}</div>
  </li>`;
}

function availableSection(deck: DeckSnapshot, recent: DeckThread[]): string {
  const recentIds = new Set(recent.map((thread) => thread.id));
  const threads = allDeckThreads(deck).sort((left, right) => right.updatedAt - left.updatedAt);
  return `<section class="available-section" aria-labelledby="available-heading">
    <div class="available-heading"><h2 id="available-heading">History</h2><button type="button" class="text-action" data-action="toggle-history" aria-expanded="${historyExpanded || Boolean(searchQuery)}" aria-controls="available-list">${historyExpanded ? "Hide" : "Show"} <span data-search-count>${recent.length}</span> <span data-search-noun>${recent.length === 1 ? "chat" : "chats"}</span></button></div>
    <div class="history-filters" role="group" aria-label="Filter History" ${historyExpanded && !searchQuery ? "" : "hidden"}>${(["all", "reviewed", "finished"] as const).map(filter => `<button type="button" class="text-action" data-action="history-${filter}" aria-pressed="${historyFilter === filter}">${filter === "all" ? "All" : filter === "reviewed" ? "Reviewed" : "Finished"}</button>`).join("")}</div>
    <ul class="available-list" id="available-list" ${historyExpanded || searchQuery ? "" : "hidden"}>
      ${threads.map((thread) => availableRow(thread, recentIds.has(thread.id))).join("") || '<li class="empty-row">No threads are available.</li>'}
    </ul>
    <p class="empty-row history-empty" hidden></p>
  </section>`;
}

function threadSearchFooter(deck: DeckSnapshot, visibleCount: number): string {
  const total = allDeckThreads(deck).length;
  return `<section class="thread-search-footer" role="search" aria-label="All-thread search">
    <label class="visually-hidden" for="task-search">Search all ${total} threads</label>
    <input id="task-search" type="search" placeholder="Search all ${total} threads" value="${escapeAttribute(searchQuery)}" autocomplete="off" aria-describedby="thread-search-status" aria-keyshortcuts="Control+k Meta+k /" title="Search tasks (Command+K or Control+K)" />
    <span class="thread-search-status" id="thread-search-status" data-search-status aria-live="polite">${visibleCount} recent</span>
  </section>`;
}

function availableRow(thread: DeckThread, isRecent: boolean): string {
  return `<li class="available-row history-row" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="search-${escapeAttribute(thread.id)}" data-search-value="${escapeAttribute(searchableThreadMetadata(thread))}" data-is-recent="${String(isRecent)}" data-reviewed="${thread.reviewAcknowledged === true}" data-finished="${thread.workState === "completed"}" ${isRecent ? "" : "hidden"}>
    <div><a class="record-title" title="${escapeAttribute(thread.title)}" ${openThreadAttributes(thread)}>${recordTitle(thread.title)}</a><p class="history-status">${historyStatus(thread)}</p><p class="thread-meta">${sourceBadge(thread)} ${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${placementBadge(thread)}</p>${chatHistory(thread)}</div>
    <div class="available-actions">${threadActions(thread)}</div>
  </li>`;
}

/** Search stays local to the rendered metadata snapshot; it never fetches a provider or turn. */
function searchableThreadMetadata(thread: DeckThread): string {
  const placement = thread.isCurrent ? "now current" : thread.level ?? "";
  const activity = isRunningThreadStatus(thread.status) ? "running active" : thread.status;
  const review = thread.review?.state === "ready" && !isRunningThreadStatus(thread.status)
    ? `ready review ${thread.review.providerStatus}`
    : "";
  const context = thread.context ? `context ${thread.context} tag ${thread.context} label ${thread.context}` : "context tag label";
  return [
    thread.title,
    "provider",
    thread.sourceName,
    thread.sourceId,
    "project",
    thread.project,
    thread.id,
    activity,
    placement,
    review,
    context,
  ].join(" ").toLowerCase();
}

function placementBadge(thread: DeckThread): string {
  const placement = thread.isCurrent ? "NOW" : thread.level === "focus" ? "Focus" : thread.level === "important" ? "Important" : "";
  return placement ? `<span class="placement-badge">${placement}</span>` : "";
}

function reviewDoneButton(thread: DeckThread): string {
  if (!thread.review?.identity || isRunningThreadStatus(thread.status)) return "";
  return `<button type="button" class="icon-action review-done" data-action="review-done" data-thread-id="${escapeAttribute(thread.id)}" data-review-updated-at="${thread.review.updatedAt}" data-review-identity="${escapeAttribute(thread.review.identity)}" aria-label="Mark ${escapeAttribute(thread.title)} reviewed" title="Mark reviewed"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg><span class="review-tooltip" role="tooltip">Mark reviewed</span></button>`;
}

function historyStatus(thread: DeckThread): string {
  const pending = [...reviewAcknowledgements.operations.values()].some(operation => operation.thread.id === thread.id && operation.state === "pending");
  const active = isRunningThreadStatus(thread.status) || thread.review?.state === "ready" || thread.attention === "needs-input";
  const response = pending ? "Saving review…" : isRunningThreadStatus(thread.status) ? "Running" : thread.review?.state === "ready" ? "Ready for Review" : thread.reviewAcknowledged ? "Reviewed" : "";
  const work = thread.workState === "completed" ? "Finished" : thread.continuationThreadId ? "Continued" : thread.level || active ? "Open" : "Open · inactive";
  return `<span>${response ? `${response} · ` : ""}${work}</span>`;
}

function reviewFeedback(): string {
  const operations = [...reviewAcknowledgements.operations.values()];
  const saving = operations.some(operation => operation.state === "pending");
  return `${saving ? '<p class="source-notice" role="status">Saving review…</p>' : ""}${operations.filter(operation => operation.state === "failed").map(operation => `<section class="error-panel review-error" role="alert"><span>Couldn’t confirm review was saved for ${escapeHtml(operation.thread.title)}. ${escapeHtml(operation.error ?? "Try again.")}${operation.superseded ? " A newer result or activity is shown below." : ""}</span>${operation.superseded ? "" : `<button type="button" data-action="review-retry" data-thread-id="${escapeAttribute(operation.thread.id)}" data-review-identity="${escapeAttribute(operation.identity)}">Retry</button>`}</section>`).join("")}`;
}

function reviewTrayIcon(): string {
  return '<svg class="review-symbol" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-2 14H6L4 5Z"/><path d="M7 13h3l2 2 2-2h3"/></svg>';
}

function chevronIcon(): string {
  return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
}

function workActionButtons(thread: DeckThread): string {
  if ((thread.currentThreadId ?? thread.id) !== thread.id) {
    const current = snapshot && allDeckThreads(snapshot).find(candidate => candidate.id === thread.currentThreadId);
    return `${current ? `<a class="text-action" ${openThreadAttributes(current)}>Open current chat</a>` : ""}
      ${thread.continuationThreadId === thread.currentThreadId ? actionButton("Unlink next chat", "unlink-next", thread.id) : ""}`;
  }
  return `${actionButton(thread.workState === "completed" ? "Reopen" : "Finish work", thread.workState === "completed" ? "work-reopen" : "work-finish", thread.id)}
    ${thread.workState !== "completed" ? actionButton("Link next chat…", "link-next", thread.id) : ""}`;
}

function workActions(thread: DeckThread): string {
  return `<details class="row-menu" data-thread-id="${escapeAttribute(thread.id)}"><summary>Actions<span class="visually-hidden"> for ${escapeHtml(thread.title)}</span></summary><div class="row-menu-actions">${workActionButtons(thread)}</div></details>`;
}

function chatHistory(thread: DeckThread): string {
  if (!snapshot) return "";
  const ids = thread.predecessorThreadIds ?? [];
  if (!ids.length) return "";
  const byId = new Map(allDeckThreads(snapshot).map((candidate) => [candidate.id, candidate]));
  return `<details class="chat-history"><summary>${ids.length} earlier ${ids.length === 1 ? "chat" : "chats"}</summary><ul>${ids.map((id) => {
    const earlier = byId.get(id);
    return `<li>${earlier ? `<a ${openThreadAttributes(earlier)}>${escapeHtml(earlier.title)}</a>` : "Earlier chat is unavailable from its source"}</li>`;
  }).join("")}</ul></details>`;
}

function needsInputSection(threads: DeckThread[]): string {
  return `<section class="deck-section" aria-labelledby="input-heading"><h2 id="input-heading">Needs input</h2><ul class="thread-list">${threads.map(runningRow).join("")}</ul></section>`;
}

function continuationPicker(): string {
  if (!snapshot || !continuationThreadId) return "";
  const threads = allDeckThreads(snapshot);
  const predecessor = threads.find((thread) => thread.id === continuationThreadId);
  if (!predecessor) return "";
  return `<section class="continuation-picker" aria-labelledby="link-heading"><h2 id="link-heading">Choose the next chat</h2><p>Continue ${escapeHtml(predecessor.title)} in an existing chat. Its priority moves with it.</p>
    <label for="continuation-search">Find a chat</label><input type="search" id="continuation-search" placeholder="Search by title, project or provider" autocomplete="off" />
    <ul>${threads.filter((thread) => thread.id !== predecessor.id && !thread.level && thread.workState !== "completed" && (thread.currentThreadId ?? thread.id) === thread.id && !(thread.predecessorThreadIds?.length) && !predecessor.predecessorThreadIds?.includes(thread.id)).map((thread) => `<li data-continuation-search="${escapeAttribute(searchableThreadMetadata(thread))}" hidden><button type="button" class="text-action" data-action="confirm-link" data-thread-id="${escapeAttribute(predecessor.id)}" data-next-thread-id="${escapeAttribute(thread.id)}">${escapeHtml(thread.title)}<small>${escapeHtml(thread.project)} · ${escapeHtml(thread.sourceName)}</small></button></li>`).join("")}</ul>
    <p data-continuation-count>Type to find the exact chat.</p><button type="button" class="text-action" data-action="cancel-link">Cancel</button>
  </section>`;
}

function threadActions(thread: DeckThread): string {
  return `<details class="row-menu"><summary>Actions<span class="visually-hidden"> for ${escapeHtml(thread.title)}</span></summary><div class="row-menu-actions">${thread.isCurrent || thread.workState === "completed" || (thread.currentThreadId ?? thread.id) !== thread.id ? "" : [
    actionButton("Make Now", "current", thread.id),
    thread.level === "important" ? "" : actionButton("Important", "level-important", thread.id),
    thread.level === "focus" ? "" : actionButton("Focus", "level-focus", thread.id, true),
    thread.level ? actionButton("Remove", "level-none", thread.id) : "",
  ].join("")}${workActionButtons(thread)}</div></details>`;
}

function actionButton(label: string, action: string, threadId: string, emphasized = false): string {
  return `<button type="button" class="text-action ${emphasized ? "emphasized" : ""}" data-action="${action}" data-thread-id="${escapeAttribute(threadId)}">${escapeHtml(label)}</button>`;
}

function moveButtons(threadId: string, index: number, count: number): string {
  return `<button type="button" class="icon-action" data-action="move-up" data-thread-id="${escapeAttribute(threadId)}" ${index === 0 ? "disabled" : ""} aria-label="Move task up">↑</button><button type="button" class="icon-action" data-action="move-down" data-thread-id="${escapeAttribute(threadId)}" ${index === count - 1 ? "disabled" : ""} aria-label="Move task down">↓</button>`;
}

function emptyRow(level: PriorityLevel): string {
  return `<li class="empty-row">No ${level} work yet. Choose a chat from History or Search.</li>`;
}

function errorPanel(message: string): string {
  return `<section class="error-panel" role="alert"><strong>Gajendra needs attention.</strong><span>${escapeHtml(message)}</span><button type="button" data-action="retry">Try again</button></section>`;
}

function sourcesPanel(sources: DeckSnapshot["sources"]): string {
  return `<section class="sources-strip" aria-label="Thread sources">
    <div class="sources-label"><span>${sources.filter((source) => source.state === "ready").length} sources ready</span><button class="text-action" type="button" data-action="manage-sources">Manage sources</button></div>
    <div class="source-chips">${sources.map((source) => `<span class="source-chip state-${source.state}" data-source-id="${escapeAttribute(source.id)}" aria-label="${escapeAttribute(`${source.name}: ${source.state}`)}" title="${escapeAttribute(source.detail ?? source.state)}"><span class="source-dot" aria-hidden="true"></span>${escapeHtml(source.name)}<span class="source-count">${source.threadCount}</span></span>`).join("")}</div>
    ${sources.filter((source) => source.enabled && source.state !== "ready").map((source) => `<p class="source-notice" role="status">${escapeHtml(source.name)}: ${escapeHtml(source.detail ?? "Unavailable. Refresh to try again.")}</p>`).join("")}
  </section>`;
}

function sourceSettings(): string {
  if (!snapshot) return "";
  return `<fieldset class="source-settings"><legend>Thread sources</legend>
    ${snapshot.sources.map((source) => `<button type="button" role="switch" aria-checked="${String(source.enabled)}" aria-label="${escapeAttribute(source.name)} source" data-action="source-toggle" data-source-id="${escapeAttribute(source.id)}" data-source-enabled="${String(source.enabled)}"><span>${escapeHtml(source.name)}</span><span>${source.enabled ? "On" : "Off"}</span></button>`).join("")}
  </fieldset>`;
}

function applySearch(animate: boolean): void {
  const terms = searchQuery.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  const list = root.querySelector<HTMLElement>("#available-list");
  if (list) list.hidden = !historyExpanded && !terms.length;
  let visibleCount = 0;
  root.querySelectorAll<HTMLElement>("#available-list .available-row").forEach((row) => {
    const visible = terms.length
      ? terms.every((term) => row.dataset.searchValue?.includes(term))
      : row.dataset.isRecent === "true" && (historyFilter === "all" || (historyFilter === "reviewed" ? row.dataset.reviewed : row.dataset.finished) === "true");
    if (visible) visibleCount += 1;
    if (animate) motion.filterRow(row, visible);
    else row.hidden = !visible;
  });
  root.querySelectorAll<HTMLElement>("[data-search-count]").forEach((count) => { count.textContent = String(visibleCount); });
  const noun = root.querySelector<HTMLElement>("[data-search-noun]");
  if (noun) noun.textContent = visibleCount === 1 ? "chat" : "chats";
  const status = root.querySelector<HTMLElement>("[data-search-status]");
  if (status) status.textContent = terms.length ? `${visibleCount} ${visibleCount === 1 ? "match" : "matches"}` : `${visibleCount} in history`;
  const filters = root.querySelector<HTMLElement>(".history-filters");
  if (filters) filters.hidden = !historyExpanded || Boolean(terms.length);
  const empty = root.querySelector<HTMLElement>(".history-empty");
  if (empty) {
    empty.hidden = visibleCount > 0 || (!historyExpanded && !terms.length);
    empty.textContent = terms.length ? "No matching chats." : historyFilter === "reviewed" ? "No reviewed responses in History." : historyFilter === "finished" ? "No finished work in History." : "No chats in History yet.";
  }
  if (animate && terms.length) root.querySelector<HTMLElement>(".available-section")?.scrollIntoView({ block: "start" });
}

function handleSearchShortcut(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing) return;
  const search = root.querySelector<HTMLInputElement>("#task-search");
  if (!search) return;
  if (event.key === "Escape" && document.activeElement === search) {
    event.preventDefault();
    searchQuery = search.value = "";
    applySearch(true);
    return;
  }
  const editing = (event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]");
  const command = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k";
  const slash = event.key === "/" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (command || slash) {
    event.preventDefault();
    search.focus();
    search.select();
  }
}

function sourceBadge(thread: DeckThread): string {
  return `<a class="source-badge" ${openThreadAttributes(thread)} data-source-id="${escapeAttribute(thread.sourceId)}" aria-label="Open ${escapeAttribute(thread.title)} in ${escapeAttribute(thread.sourceName)}">${escapeHtml(thread.sourceName)}</a>`;
}

function openThreadAttributes(thread: DeckThread): string {
  const permitted = isPermittedDeepLink(thread.deepLink, thread.allowedDeepLinkSchemes ?? []);
  return `href="${permitted ? escapeAttribute(thread.deepLink) : "#"}" data-open-thread="${escapeAttribute(thread.deepLink)}" data-open-thread-id="${escapeAttribute(thread.id)}" data-open-route="thread"${permitted ? "" : ' aria-disabled="true"'}`;
}

function openReviewAttributes(thread: DeckThread): string {
  const destination = thread.review?.destination.type === "thread"
    ? thread.review.destination.deepLink
    : thread.review?.destination.url ?? "";
  const permitted = thread.review?.state === "ready"
    && !isRunningThreadStatus(thread.status)
    && isPermittedDeepLink(destination, thread.allowedDeepLinkSchemes ?? []);
  return `href="${permitted ? escapeAttribute(destination) : "#"}" data-open-thread="${escapeAttribute(destination)}" data-open-thread-id="${escapeAttribute(thread.id)}" data-open-route="review"${permitted ? "" : ' aria-disabled="true"'}`;
}

function contextBadge(thread: DeckThread): string {
  if (!thread.context) return "";
  return `<span class="context-badge" data-context="${thread.context}">${contextTitle(thread.context)}</span>`;
}

function contextSelector(thread: DeckThread): string {
  return `<label class="context-control">
    <span class="visually-hidden">Context for ${escapeHtml(thread.title)}</span>
    <select data-context-thread-id="${escapeAttribute(thread.id)}" aria-label="Context for ${escapeAttribute(thread.title)}">
      <option value="" ${thread.context ? "" : "selected"}>Context</option>
      ${(["design", "engineering", "life"] as const).map((context) => `<option value="${context}" ${thread.context === context ? "selected" : ""}>${contextTitle(context)}</option>`).join("")}
    </select>
  </label>`;
}

function contextTitle(context: ThreadContext): string {
  return context[0]?.toUpperCase() + context.slice(1);
}

function visualPreferenceControls(): string {
  return `<div class="visual-controls" aria-label="Gajendra visual preferences">
    <span class="visual-control-label">Theme</span>
    <div class="segmented-control" role="group" aria-label="Theme">
      <button type="button" data-action="theme-native" aria-pressed="${String(visualTheme === "native")}">Native</button>
      <button type="button" data-action="theme-focus-deck" aria-pressed="${String(visualTheme === "focus-deck")}">Focus Deck</button>
    </div>
    <span class="visual-control-label">Appearance</span>
    <div class="segmented-control" role="group" aria-label="Appearance">
      ${(["auto", "light", "dark"] as const).map((appearance) => `<button type="button" data-action="appearance-${appearance}" aria-pressed="${String(appearancePreference === appearance)}">${appearance[0]?.toUpperCase()}${appearance.slice(1)}</button>`).join("")}
    </div>
  </div>`;
}

function bindInteractions(): void {
  root.querySelector<HTMLInputElement>("#continuation-search")?.addEventListener("input", (event) => {
    const query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
    let count = 0;
    root.querySelectorAll<HTMLElement>("[data-continuation-search]").forEach((row) => {
      const matches = Boolean(query) && query.split(/\s+/u).every((term) => row.dataset.continuationSearch?.includes(term));
      row.hidden = !matches || count >= 20;
      if (matches) count += 1;
    });
    const status = root.querySelector<HTMLElement>("[data-continuation-count]");
    if (status) status.textContent = !query ? "Type to find the exact chat." : count > 20 ? `${count} matches. Refine your search to see the right chat.` : `${count} matches`;
  });
  const visualSettings = root.querySelector<HTMLDetailsElement>(".visual-settings");
  const visualSettingsButton = visualSettings?.querySelector<HTMLElement>("summary.brand-mark");
  const syncVisualSettingsDisclosure = (): void => {
    visualSettingsButton?.setAttribute("aria-expanded", String(visualSettings?.open ?? false));
  };
  visualSettings?.addEventListener("toggle", syncVisualSettingsDisclosure);
  syncVisualSettingsDisclosure();

  root.querySelectorAll<HTMLButtonElement>("button[data-collapse]").forEach((button) => {
    button.addEventListener("click", () => void handleCollapse(button));
  });

  root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => void handleAction(button));
  });

  root.querySelector<HTMLButtonElement>("button[data-running-toggle]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    runningExpanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(runningExpanded));
    const list = root.querySelector<HTMLElement>("#running-list");
    if (list) list.hidden = !runningExpanded;
  });

  root.querySelector<HTMLButtonElement>("button[data-review-toggle]")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    reviewExpanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(reviewExpanded));
    const list = root.querySelector<HTMLElement>("#review-list");
    if (list) list.hidden = !reviewExpanded;
  });

  const search = root.querySelector<HTMLInputElement>("#task-search");
  search?.addEventListener("focus", () => {
    search.select();
  });
  root.querySelector<HTMLElement>(".thread-search-footer")?.addEventListener("click", () => {
    search?.focus();
  });
  search?.addEventListener("input", (event) => {
    searchQuery = (event.currentTarget as HTMLInputElement).value;
    applySearch(true);
  });

  root.querySelectorAll<HTMLSelectElement>("select[data-context-thread-id]").forEach((select) => {
    select.addEventListener("change", () => void handleContextChange(select));
  });

  root.querySelectorAll<HTMLAnchorElement>("a[data-open-thread]").forEach((anchor) => {
    // The three data attributes are display output and can be edited together after render. Keep
    // the snapshot-authorized intent in this listener closure, then reject any subsequent DOM
    // drift before asking either the host or browser to open anything.
    const capturedIntent = captureOpenIntent(anchor);
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      // Resolve the captured intent at the action boundary. Cosmetic feedback must never delay
      // navigation or keep it pending when Reduce Motion cancels an animation.
      const target = resolveCapturedOpenTarget(anchor, capturedIntent);
      if (!target) return rejectOpenDestination();
      if (event.detail !== 0) motion.acknowledgeOpen(anchor);
      await openThreadLink(target.url, target.thread);
    });
  });

  root.querySelectorAll<HTMLElement>("button, a").forEach((element) => motion.bindPress(element));
  root.querySelectorAll<HTMLButtonElement>("[data-heading-hover]").forEach((element) => motion.bindHeadingHover(element));
  bindDragAndDrop();

  root.querySelector<HTMLElement>(".now-card")?.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("a, button, input")) return;
    const current = snapshot?.current;
    if (current) void openThreadLink(current.deepLink, current);
  });
}

async function handleContextChange(select: HTMLSelectElement): Promise<void> {
  const threadId = select.dataset.contextThreadId;
  if (!threadId) return;
  const value = select.value;
  const context = value === "design" || value === "engineering" || value === "life" ? value : null;
  await mutate("gajendra_set_context", { threadId, context });
}

function bindDragAndDrop(): void {
  root.querySelectorAll<HTMLElement>(".thread-row[draggable=true], .available-row[draggable=true]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      const threadId = row.dataset.threadId;
      if (!threadId || !event.dataTransfer) return;
      draggedThreadId = threadId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", threadId);
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", clearDragState);
  });

  root.querySelectorAll<HTMLElement>(".deck-section[data-drop-level]").forEach((sectionElement) => {
    sectionElement.addEventListener("dragover", (event) => {
      if (busy || !event.dataTransfer?.types.includes("text/plain")) return;
      const level = sectionElement.dataset.dropLevel as PriorityLevel | undefined;
      if (!level || (snapshot?.current?.id === draggedThreadId && level !== "focus")) {
        event.dataTransfer.dropEffect = "none";
        clearDropTargets();
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropTargets();
      (event.target as HTMLElement).closest<HTMLElement>(".thread-row")?.classList.add("is-drop-target");
      sectionElement.classList.add("is-drop-zone");
    });
    sectionElement.addEventListener("dragleave", (event) => {
      if (!sectionElement.contains(event.relatedTarget as Node | null)) sectionElement.classList.remove("is-drop-zone");
    });
    sectionElement.addEventListener("drop", (event) => {
      event.preventDefault();
      const threadId = event.dataTransfer?.getData("text/plain");
      const level = sectionElement.dataset.dropLevel as PriorityLevel | undefined;
      const targetRow = (event.target as HTMLElement).closest<HTMLElement>(".thread-row");
      const beforeId = targetRow?.dataset.threadId;
      clearDragState();
      if (threadId && level) void moveDroppedThread(threadId, level, beforeId);
    });
  });
}

function clearDropTargets(): void {
  root.querySelectorAll(".is-drop-target").forEach((element) => element.classList.remove("is-drop-target"));
}

function clearDragState(): void {
  draggedThreadId = null;
  root.querySelectorAll(".is-dragging, .is-drop-target, .is-drop-zone").forEach((element) => {
    element.classList.remove("is-dragging", "is-drop-target", "is-drop-zone");
  });
}

async function moveDroppedThread(threadId: string, level: PriorityLevel, beforeId?: string): Promise<void> {
  if (!snapshot || busy || !allDeckThreads(snapshot).some((candidate) => candidate.id === threadId)) return;
  if (snapshot.current?.id === threadId && level !== "focus") return;
  if (beforeId === threadId) return;
  await mutate("gajendra_move_before", {
    threadId,
    level,
    beforeThreadId: beforeId ?? null,
  });
}

async function handleCollapse(button: HTMLButtonElement): Promise<void> {
  if (busy) return;
  const restoreFocus = document.activeElement === button;
  const level = button.dataset.collapse as PriorityLevel;
  const collapsed = button.getAttribute("aria-expanded") === "true";
  const list = root.querySelector<HTMLElement>(`#${level}-list`);
  motion.animateCollapse(button, list, collapsed);
  await mutate(
    "gajendra_set_collapsed",
    { level, collapsed },
    () => {
      if (snapshot) snapshot.collapsed[level] = collapsed;
    },
    collapsed ? "collapse" : "expand",
  );
  if (restoreFocus && (document.activeElement === document.body || document.activeElement === button)) {
    root.querySelector<HTMLButtonElement>(`button[data-collapse="${level}"]`)?.focus({ preventScroll: true });
  }
}

async function handleAction(button: HTMLButtonElement): Promise<void> {
  const action = button.dataset.action;
  const threadId = button.dataset.threadId;
  if (action?.startsWith("history-")) {
    const filter = action.slice(8);
    if (filter === "all" || filter === "reviewed" || filter === "finished") historyFilter = filter;
    render();
    root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (action === "toggle-history") {
    historyExpanded = !historyExpanded;
    render();
    root.querySelector<HTMLButtonElement>('button[data-action="toggle-history"]')?.focus({ preventScroll: true });
    return;
  }
  if (action === "cancel-link") {
    continuationThreadId = null;
    render();
    return;
  }
  if (action === "undo-work" && undoAction) {
    const undo = undoAction;
    return mutate(undo.tool, undo.args, undefined, "mutation", () => {
      if (undo.tool === "gajendra_set_review_acknowledged") reviewAcknowledgements.forget(String(undo.args.reviewIdentity));
      undoAction = null;
      render();
    });
  }
  if (action?.startsWith("theme-")) {
    setVisualTheme(action === "theme-focus-deck" ? "focus-deck" : "native");
    return;
  }
  if (action?.startsWith("appearance-")) {
    const appearance = action.slice("appearance-".length);
    if (appearance === "auto" || appearance === "light" || appearance === "dark") setAppearancePreference(appearance);
    return;
  }
  if (action === "retry" || action === "refresh") return refresh();
  if (action === "manage-sources") {
    const settings = root.querySelector<HTMLDetailsElement>(".visual-settings");
    if (settings) {
      settings.open = true;
      settings.scrollIntoView({ block: "nearest" });
      settings.querySelector<HTMLButtonElement>("[data-action=source-toggle]")?.focus();
    }
    return;
  }
  if (action === "source-toggle") {
    const sourceId = button.dataset.sourceId;
    if (!sourceId) return;
    await mutate("gajendra_set_source_enabled", { sourceId, enabled: button.dataset.sourceEnabled !== "true" });
    root.querySelector<HTMLButtonElement>(`button[data-action=source-toggle][data-source-id="${CSS.escape(sourceId)}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (!threadId || !action) return;
  if (action === "link-next") {
    continuationThreadId = threadId;
    render();
    root.querySelector<HTMLInputElement>("#continuation-search")?.focus();
    return;
  }
  if (action === "work-finish" || action === "work-reopen") {
    const wasCurrent = snapshot?.current?.id === threadId;
    const completed = action === "work-finish";
    return mutate("gajendra_set_work_completed", { threadId, completed }, undefined, "mutation", () => {
      undoAction = { tool: "gajendra_set_work_completed", args: { threadId, completed: !completed, ...(wasCurrent ? { currentThreadId: threadId } : {}) }, label: completed ? "Work finished. It remains in History." : "Work reopened." };
      render();
    });
  }
  if (action === "confirm-link" || action === "unlink-next") {
    const nextId = action === "unlink-next" ? null : button.dataset.nextThreadId;
    if (nextId === undefined) return;
    return mutate("gajendra_link_continuation", { threadId, currentThreadId: nextId }, undefined, "mutation", () => {
      continuationThreadId = null;
      undoAction = null;
      render();
    });
  }
  if (action === "review-retry") {
    const operation = reviewAcknowledgements.operations.get(button.dataset.reviewIdentity ?? "");
    if (operation?.state === "failed" && !operation.superseded) queueReviewAcknowledgement(operation.thread, button);
    return;
  }
  if (action === "review-done") {
    const reviewUpdatedAt = Number(button.dataset.reviewUpdatedAt);
    const reviewIdentity = button.dataset.reviewIdentity;
    if (!Number.isFinite(reviewUpdatedAt)
      || reviewUpdatedAt < 0
      || !reviewIdentity
      || !/^[a-f0-9]{64}$/iu.test(reviewIdentity)) return;
    const thread = snapshot && reviewAcknowledgements.ready(snapshot).find(candidate => candidate.id === threadId
      && candidate.review?.identity === reviewIdentity && candidate.review.updatedAt === reviewUpdatedAt);
    if (thread) queueReviewAcknowledgement(thread, button);
    return;
  }
  if (action === "current") return mutate("gajendra_set_current", { threadId });
  if (action === "move-up" || action === "move-down") {
    return mutate("gajendra_move", { threadId, direction: action === "move-up" ? "up" : "down" });
  }
  if (action.startsWith("level-")) {
    const value = action.slice(6);
    const level = value === "none" ? null : value;
    return mutate("gajendra_set_level", { threadId, level });
  }
}

function queueReviewAcknowledgement(thread: DeckThread, button: HTMLButtonElement): void {
  if (busy) return;
  const readyButtons = [...root.querySelectorAll<HTMLButtonElement>("button.review-done")];
  const index = Math.max(0, readyButtons.findIndex(candidate => candidate.dataset.threadId === thread.id));
  const operation = reviewAcknowledgements.begin(thread, mutationKey(), index);
  if (!operation) return;
  const shouldMoveFocus = document.activeElement === button;
  snapshotGeneration += 1; // A refresh started before this intent cannot restore the removed row.
  undoAction = null;
  render("external");
  if (shouldMoveFocus) {
    const nextButtons = [...root.querySelectorAll<HTMLButtonElement>("button.review-done")];
    (nextButtons[Math.min(index, nextButtons.length - 1)]
      ?? root.querySelector<HTMLButtonElement>("button[data-review-toggle]"))?.focus({ preventScroll: true });
  }
  // Store writes stay sequential; every check still dismisses immediately, including keyboard use.
  reviewQueue = reviewQueue.then(() => saveReviewAcknowledgement(operation));
}

async function saveReviewAcknowledgement(operation: ReviewAcknowledgement): Promise<void> {
  const args = { threadId: operation.thread.id, reviewUpdatedAt: operation.updatedAt, reviewIdentity: operation.identity, acknowledged: true };
  const generation = snapshotGeneration;
  const requestSnapshot = snapshot;
  try {
    if (!app) {
      await fixtureReviewFeedback(operation);
      if (snapshot && operation.superseded && operation.thread.review) {
        // The synthetic delayed receipt can finish after its newer provider generation arrives.
        fixtureReviewed.set(operation.thread.id, operation.thread.review);
        snapshot.revision += 1;
      } else applyFixtureMutation("gajendra_set_review_acknowledged", args);
      if (snapshot) snapshot.product = productDeckProjection(snapshot);
    } else {
      const result = await app.callServerTool({ name: "gajendra_set_review_acknowledged", arguments: {
        ...args, protocolVersion: MUTATION_PROTOCOL_VERSION, expectedRevision: snapshot?.revision,
        idempotencyKey: operation.idempotencyKey,
      } });
      const content = result.structuredContent;
      if (!isDeckMutationResult(content)) throw new Error("The save could not be confirmed. Retry to confirm it safely.");
      const next = snapshot && generation !== snapshotGeneration
        ? preserveNewerReviewEvidence(content.snapshot, snapshot, operation, requestSnapshot ?? undefined) : content.snapshot;
      acceptSnapshot(next, "external", null);
      if (content.outcome !== "applied" && content.outcome !== "replayed") {
        // A typed rejection is definitely uncommitted; the next attempt may use the fresh revision.
        operation.idempotencyKey = mutationKey();
        throw new Error(content.error?.message ?? "The save was not applied. Retry with the latest view.");
      }
    }
    reviewAcknowledgements.complete(operation);
    if (snapshot) reviewAcknowledgements.observe(snapshot);
    snapshotGeneration += 1;
    undoAction = { tool: "gajendra_set_review_acknowledged", args: { ...args, acknowledged: false }, label: "Review saved." };
    render("external");
    const status = root.querySelector<HTMLElement>("[data-refresh-status]");
    if (status) status.textContent = "Review saved";
  } catch (error) {
    reviewAcknowledgements.fail(operation, error instanceof Error ? error.message : "Try again.");
    render("external");
  }
}

/** Explicit standalone synthetic-fixture controls for real-interface acceptance, never host writes. */
async function fixtureReviewFeedback(operation: ReviewAcknowledgement): Promise<void> {
  const parameters = new URLSearchParams(window.location.search);
  if (app || !parameters.has("fixture")) return;
  const firstAttempt = ++fixtureReviewAttempt === 1;
  const delayed = parameters.get("review-delay") === "1";
  if (firstAttempt && delayed && parameters.get("review-newer") === "1") {
    setTimeout(() => {
      if (!snapshot) return;
      const target = allDeckThreads(snapshot).find(thread => thread.id === operation.thread.id);
      if (!target?.review) return;
      target.review = { ...target.review, identity: "e".repeat(64), updatedAt: target.review.updatedAt + 60 };
      snapshot.product = productDeckProjection(snapshot);
      reviewAcknowledgements.observe(snapshot);
      snapshotGeneration += 1;
      render("external");
    }, 2000);
  }
  if (delayed) await new Promise(resolve => setTimeout(resolve, 8000));
  if (firstAttempt && parameters.get("review-fail-once") === "1") throw new Error("Synthetic connection interruption. Retry to save this review.");
}

async function mutate(
  tool: string,
  args: Record<string, unknown>,
  fixtureMutation?: () => void,
  reason: RenderReason = "mutation",
  onSuccess?: () => void,
): Promise<void> {
  if (busy || reviewAcknowledgements.pending) return;
  const layoutState = motion.captureLayout();
  let succeeded = false;
  busy = true;
  motion.setBusy(true, "Updating Gajendra");
  try {
    if (!app) {
      fixtureMutation?.();
      applyFixtureMutation(tool, args);
      if (snapshot) snapshot.product = productDeckProjection(snapshot);
      render(reason, layoutState);
      succeeded = true;
    } else {
      const result = await app.callServerTool({
        name: tool,
        arguments: {
          ...args,
          protocolVersion: MUTATION_PROTOCOL_VERSION,
          ...(snapshot ? { expectedRevision: snapshot.revision } : {}),
          idempotencyKey: mutationKey(),
        },
      });
      acceptSnapshot(result.structuredContent, reason, layoutState);
      succeeded = isDeckMutationResult(result.structuredContent)
        && result.structuredContent.revision === snapshot?.revision
        && (result.structuredContent.outcome === "applied" || result.structuredContent.outcome === "replayed");
    }
  } catch (error) {
    renderRecoverableError(error, layoutState);
  } finally {
    busy = false;
    motion.setBusy(false);
  }
  if (succeeded) onSuccess?.();
}

function applyFixtureMutation(tool: string, args: Record<string, unknown>): void {
  if (!snapshot) return;
  if (tool === "gajendra_set_source_enabled") {
    const source = snapshot.sources.find((candidate) => candidate.id === String(args.sourceId ?? ""));
    if (source) {
      source.enabled = Boolean(args.enabled);
      source.state = source.enabled ? "ready" : "disabled";
    }
    snapshot.revision += 1;
    return;
  }
  const id = String(args.threadId ?? "");
  const all = [...snapshot.focus, ...snapshot.important, ...snapshot.available];
  const target = all.find((thread) => thread.id === id);
  if (tool === "gajendra_set_collapsed") {
    snapshot.revision += 1;
    return;
  }
  if (!target) return;
  if (tool === "gajendra_set_work_completed") {
    target.workState = args.completed === true ? "completed" : "open";
    if (args.completed && snapshot.current?.id === id) snapshot.current = null;
    if (args.currentThreadId === id && !args.completed) snapshot.current = target;
    snapshot = normalizeDeckSelection(snapshot);
    snapshot.revision += 1;
    return;
  }
  if (tool === "gajendra_link_continuation") {
    const movePriority = (from: DeckThread, to: DeckThread) => {
      const level = from.level;
      const ordered = level === "focus" ? snapshot!.focus : snapshot!.important;
      const index = ordered.findIndex(thread => thread.id === from.id);
      snapshot!.focus = snapshot!.focus.filter(thread => thread.id !== from.id && thread.id !== to.id);
      snapshot!.important = snapshot!.important.filter(thread => thread.id !== from.id && thread.id !== to.id);
      snapshot!.available = snapshot!.available.filter(thread => thread.id !== from.id && thread.id !== to.id);
      to.level = level;
      to.context = from.context;
      from.level = null;
      from.context = null;
      const destination = level === "focus" ? snapshot!.focus : level === "important" ? snapshot!.important : snapshot!.available;
      destination.splice(Math.max(0, index), 0, to);
      snapshot!.available.push(from);
      if (snapshot!.current?.id === from.id) snapshot!.current = to;
    };
    if (args.currentThreadId === null) {
      const next = all.find(thread => thread.id === target.continuationThreadId);
      if (next) {
        movePriority(next, target);
        next.predecessorThreadIds = [];
      }
      target.continuationThreadId = null;
      target.currentThreadId = target.id;
    } else {
      const next = all.find(thread => thread.id === args.currentThreadId);
      if (!next || next.id === target.id || next.level || next.workState === "completed") return;
      target.continuationThreadId = next.id;
      target.currentThreadId = next.id;
      next.currentThreadId = next.id;
      next.predecessorThreadIds = [...(target.predecessorThreadIds ?? []), target.id];
      movePriority(target, next);
    }
    snapshot = normalizeDeckSelection(snapshot);
    snapshot.revision += 1;
    return;
  }
  if (tool === "gajendra_set_review_acknowledged") {
    if (args.acknowledged === false) {
      const review = fixtureReviewed.get(id);
      if (review && review.identity === args.reviewIdentity && review.updatedAt === Number(args.reviewUpdatedAt)) {
        if (!target.review) { target.review = review; delete target.reviewAcknowledged; }
        fixtureReviewed.delete(id);
      }
      snapshot.revision += 1;
      return;
    }
    if (target.review?.updatedAt !== Number(args.reviewUpdatedAt)
      || target.review.identity !== args.reviewIdentity
      || args.acknowledged !== true) return;
    fixtureReviewed.set(id, target.review);
    delete target.review;
    target.reviewAcknowledged = true;
    snapshot.revision += 1;
    return;
  }
  if (tool === "gajendra_set_context") {
    const value = args.context;
    target.context = value === "design" || value === "engineering" || value === "life" ? value : null;
    snapshot.revision += 1;
    return;
  }
  if (tool === "gajendra_move") {
    const list = target.level === "focus" ? snapshot.focus : snapshot.important;
    const from = list.findIndex((thread) => thread.id === id);
    const offset = args.direction === "up" ? -1 : 1;
    const to = Math.max(0, Math.min(list.length - 1, from + offset));
    if (from >= 0 && from !== to) [list[from], list[to]] = [list[to]!, list[from]!];
    snapshot.revision += 1;
    return;
  }
  if (tool === "gajendra_move_before") {
    const level = args.level === "focus" || args.level === "important" ? args.level : null;
    const beforeId = typeof args.beforeThreadId === "string" ? args.beforeThreadId : null;
    if (snapshot.current?.id === id && level !== "focus") return;
    snapshot.focus = snapshot.focus.filter((thread) => thread.id !== id);
    snapshot.important = snapshot.important.filter((thread) => thread.id !== id);
    snapshot.available = snapshot.available.filter((thread) => thread.id !== id);
    target.isCurrent = false;
    if (!level) {
      if (snapshot.current?.id === id) snapshot.current = snapshot.focus[0] ?? null;
      if (snapshot.current) snapshot.current.isCurrent = true;
      snapshot.revision += 1;
      return;
    }
    target.level = level;
    const list = level === "focus" ? snapshot.focus : snapshot.important;
    const beforeIndex = beforeId ? list.findIndex((thread) => thread.id === beforeId) : -1;
    if (beforeIndex >= 0) list.splice(beforeIndex, 0, target);
    else list.push(target);
    if (Object.hasOwn(args, "currentThreadId")) {
      const requestedCurrentId = typeof args.currentThreadId === "string" ? args.currentThreadId : null;
      const nextCurrent = requestedCurrentId
        ? snapshot.focus.find((thread) => thread.id === requestedCurrentId) ?? null
        : snapshot.focus[0] ?? null;
      snapshot.focus.forEach((thread) => (thread.isCurrent = thread.id === nextCurrent?.id));
      snapshot.important.forEach((thread) => (thread.isCurrent = false));
      snapshot.current = nextCurrent;
    } else if (args.isCurrent === true) {
      snapshot.focus.forEach((thread) => (thread.isCurrent = false));
      target.isCurrent = true;
      snapshot.current = target;
    } else if (snapshot.current?.id === id && level !== "focus") {
      snapshot.current = snapshot.focus[0] ?? null;
      if (snapshot.current) snapshot.current.isCurrent = true;
    }
    snapshot.revision += 1;
    snapshot.focusOverGuide = snapshot.focus.length > snapshot.focusGuide;
    return;
  }
  snapshot.focus = snapshot.focus.filter((thread) => thread.id !== id);
  snapshot.important = snapshot.important.filter((thread) => thread.id !== id);
  snapshot.available = snapshot.available.filter((thread) => thread.id !== id);
  if (tool === "gajendra_set_current") {
    snapshot.focus.forEach((thread) => (thread.isCurrent = false));
    target.level = "focus";
    target.isCurrent = true;
    snapshot.focus.unshift(target);
    snapshot.current = target;
  } else if (tool === "gajendra_set_level") {
    const level = args.level === "focus" || args.level === "important" ? args.level : null;
    if (snapshot.current?.id === id && level !== "focus") return;
    target.isCurrent = false;
    target.level = level;
    if (!target.level) target.context = null;
    (target.level === "focus" ? snapshot.focus : target.level === "important" ? snapshot.important : snapshot.available).push(target);
    if (snapshot.current?.id === id) {
      const next = snapshot.focus[0] ?? null;
      if (next) next.isCurrent = true;
      snapshot.current = next;
    }
  }
  snapshot.focusOverGuide = snapshot.focus.length > snapshot.focusGuide;
  snapshot.revision += 1;
}

async function refresh(background = false, prepared = false): Promise<void> {
  if (busy || refreshing) return;
  if (app && !connected) return start();
  const layoutState = motion.captureLayout();
  const generation = snapshotGeneration;
  refreshing = true;
  if (!background) motion.setBusy(true, "Refreshing Gajendra");
  try {
    if (!app) {
      render("refresh", layoutState);
      return;
    }
    const result = await app.callServerTool({ name: "gajendra_open", arguments: { refresh: !prepared } });
    if (generation !== snapshotGeneration) return;
    acceptSnapshot(result.structuredContent, "refresh", layoutState);
    if (!prepared) lastProviderRefresh = Date.now();
    syncFailed = false;
  } catch (error) {
    renderRecoverableError(error, layoutState);
  } finally {
    refreshing = false;
    if (!background) motion.setBusy(false);
  }
}

async function checkSharedRevision(): Promise<void> {
  if (!app || !connected || busy || refreshing || checkingRevision || draggedThreadId || !snapshot || document.visibilityState === "hidden") return;
  checkingRevision = true;
  try {
    const result = await app.callServerTool({ name: "gajendra_sync", arguments: {} });
    const metadata = result.structuredContent;
    if (!metadata || typeof metadata !== "object" || !("revision" in metadata) || !Number.isSafeInteger(metadata.revision)) throw new Error("Invalid sync response");
    const activityRevision = "activityRevision" in metadata ? metadata.activityRevision : undefined;
    if (activityRevision !== undefined && typeof activityRevision !== "string") throw new Error("Invalid activity revision");
    const catalogRevision = "catalogRevision" in metadata ? metadata.catalogRevision : undefined;
    if (catalogRevision !== undefined && !Number.isSafeInteger(catalogRevision)) throw new Error("Invalid catalog revision");
    if (Date.now() - lastProviderRefresh >= 30_000) {
      lastProviderRefresh = Date.now();
      await refresh(true, true);
    }
    else if (metadata.revision !== snapshot.revision || activityRevision !== snapshot.activityRevision
      || catalogRevision !== snapshot.catalogRevision) await refresh(true, true);
    if (syncFailed) { syncFailed = false; render(); }
  } catch {
    if (!syncFailed) { syncFailed = true; render(); }
  } finally {
    checkingRevision = false;
  }
}

function resolveAuthoritativeOpenTarget(
  threadId: string | undefined,
  route: string | undefined,
  requestedUrl: string | undefined,
): AuthoritativeOpenTarget | null {
  if (!snapshot || !threadId || !requestedUrl || !isOpenRouteIntent(route)) return null;
  const thread = allDeckThreads(snapshot).find((candidate) => candidate.id === threadId);
  if (!thread) return null;
  const expectedUrl = route === "thread" ? thread.deepLink : currentReviewDestination(thread);
  if (!expectedUrl || requestedUrl !== expectedUrl) return null;
  if (!isPermittedDeepLink(expectedUrl, thread.allowedDeepLinkSchemes ?? ["https"])) return null;
  return { url: expectedUrl, thread };
}

function captureOpenIntent(anchor: HTMLAnchorElement): CapturedOpenIntent | null {
  const route = anchor.dataset.openRoute;
  const target = resolveAuthoritativeOpenTarget(anchor.dataset.openThreadId, route, anchor.dataset.openThread);
  if (!target || !isOpenRouteIntent(route) || anchor.getAttribute("href") !== target.url) return null;
  return { threadId: target.thread.id, route, destination: target.url };
}

function hasOpenAttributeDrift(anchor: HTMLAnchorElement, captured: CapturedOpenIntent): boolean {
  return anchor.dataset.openThreadId !== captured.threadId
    || anchor.dataset.openRoute !== captured.route
    || anchor.dataset.openThread !== captured.destination
    || anchor.getAttribute("href") !== captured.destination;
}

function resolveCapturedOpenTarget(anchor: HTMLAnchorElement, captured: CapturedOpenIntent | null): AuthoritativeOpenTarget | null {
  if (!captured || hasOpenAttributeDrift(anchor, captured)) return null;
  // The current snapshot can change after render. It must still authorize the original captured
  // destination, rather than whichever values mutable DOM or an old card now advertises.
  return resolveAuthoritativeOpenTarget(captured.threadId, captured.route, captured.destination);
}

function isOpenRouteIntent(value: string | undefined): value is OpenRouteIntent {
  return value === "thread" || value === "review";
}

function currentReviewDestination(thread: DeckThread): string | null {
  const review = thread.review;
  if (!review || review.state !== "ready" || isRunningThreadStatus(thread.status)) return null;
  if (review.destination.type === "thread") return typeof review.destination.deepLink === "string" ? review.destination.deepLink : null;
  return review.destination.type === "url" && typeof review.destination.url === "string" ? review.destination.url : null;
}

function rejectOpenDestination(): void {
  renderRecoverableError(new Error("Gajendra blocked an unsafe thread destination."), motion.captureLayout());
}

function mutationKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `gaja-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function openThreadLink(url: string, thread: DeckThread): Promise<void> {
  if (!isPermittedDeepLink(url, thread.allowedDeepLinkSchemes ?? ["https"])) return rejectOpenDestination();
  if (!app && shouldUseFixture()) {
    root.dataset.lastOpenedThread = url;
    return;
  }
  const candidate = app as (App & { openLink?(input: { url: string }): Promise<unknown> }) | null;
  try {
    if (!candidate?.openLink) throw new Error("Host navigation is unavailable.");
    const result = await candidate.openLink({ url }) as { isError?: boolean } | undefined;
    if (result?.isError) throw new Error("Host navigation failed.");
  } catch {
    // Navigating this sandboxed iframe can silently do nothing or replace the
    // app. A host failure must remain visible and must not bypass its decision.
    renderRecoverableError(new Error(`The host could not open this thread in ${thread.sourceName}. Open it from the Gajendra Mac app, or retry after reconnecting the plugin.`), motion.captureLayout());
  }
}

function renderLoading(): void {
  root.innerHTML = `<section class="loading-state" role="status">${brandMark()}<h1>Opening your work</h1><p>Loading the saved view and checking your connected sources.</p><div class="loading-skeleton" aria-hidden="true"></div><div class="loading-skeleton" aria-hidden="true"></div><button type="button" data-action="retry-loading">Retry loading</button></section>`;
  root.querySelector<HTMLButtonElement>("[data-action=retry-loading]")?.addEventListener("click", () => void refresh());
}

function renderConnectionError(error: unknown): void {
  const message = error instanceof Error ? error.message : "The MCP App connection failed.";
  root.innerHTML = `<section class="loading-state error" role="alert">${brandMark()}<h1>Gajendra could not open</h1><p>${escapeHtml(message)}</p><button type="button" data-action="retry">Try again</button></section>`;
  root.querySelector<HTMLButtonElement>("[data-action=retry]")?.addEventListener("click", () => void refresh());
}

function renderRecoverableError(error: unknown, layoutState: DeckLayoutState | null): void {
  const message = error instanceof Error ? error.message : "The MCP App connection failed.";
  if (!snapshot) return renderConnectionError(error);
  snapshot = { ...snapshot, error: message };
  render("error", layoutState);
}

function relativeDate(timestamp: number): string {
  if (!timestamp) return "Unknown update";
  const now = shouldUseFixture() ? fixtureNow : Date.now();
  const days = Math.max(0, Math.round((now - timestamp * 1000) / 86_400_000));
  if (days === 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

function readEnumPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? value as T : fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sandboxed MCP hosts may deny storage. The in-memory preference still applies for this mount.
  }
}

function normalizeAppearance(value: unknown): ResolvedAppearance | null {
  return value === "light" || value === "dark" ? value : null;
}

function resolvedAppearance(): ResolvedAppearance {
  if (appearancePreference !== "auto") return appearancePreference;
  return hostAppearance ?? (systemDarkMode.matches ? "dark" : "light");
}

function applyVisualPreferences(): void {
  const appearance = resolvedAppearance();
  document.documentElement.dataset.gajaTheme = visualTheme;
  document.documentElement.dataset.theme = appearance;
  document.documentElement.style.colorScheme = appearance;
  root.dataset.gajaTheme = visualTheme;
  root.dataset.theme = appearance;
  const followHost = visualTheme === "native" && appearancePreference === "auto";
  for (const [token, hostToken] of Object.entries(hostStyleMap)) {
    const value = hostStyles[hostToken];
    if (followHost && value) document.documentElement.style.setProperty(token, value);
    else document.documentElement.style.removeProperty(token);
  }
  document.documentElement.style.fontFamily = followHost ? hostStyles["--font-sans"] ?? "" : "";
  updateVisualPreferenceControls();
}

function acceptHostAppearance(context: ReturnType<App["getHostContext"]>): void {
  if (context?.theme) hostAppearance = normalizeAppearance(context.theme);
  if (context?.styles?.variables) {
    hostStyles = { ...hostStyles, ...context.styles.variables };
    applyHostStyleVariables(context.styles.variables);
  }
  applyVisualPreferences();
}

function updateVisualPreferenceControls(): void {
  root.querySelectorAll<HTMLButtonElement>("[data-action^=theme-]").forEach((button) => {
    const selected = button.dataset.action === `theme-${visualTheme}`;
    button.setAttribute("aria-pressed", String(selected));
  });
  root.querySelectorAll<HTMLButtonElement>("[data-action^=appearance-]").forEach((button) => {
    const selected = button.dataset.action === `appearance-${appearancePreference}`;
    button.setAttribute("aria-pressed", String(selected));
  });
}

function setVisualTheme(theme: VisualTheme): void {
  visualTheme = theme;
  writePreference(themeStorageKey, theme);
  applyVisualPreferences();
}

function setAppearancePreference(appearance: AppearancePreference): void {
  appearancePreference = appearance;
  writePreference(appearanceStorageKey, appearance);
  applyVisualPreferences();
}

function handleSystemAppearanceChange(): void {
  if (appearancePreference === "auto" && !hostAppearance) applyVisualPreferences();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function brandMark(): string {
  return `<details class="visual-settings">
    <summary class="brand-mark" role="button" aria-label="Open Gajendra settings" aria-expanded="false" aria-controls="gaja-visual-settings" aria-haspopup="true" title="Gajendra settings"><svg class="gaja-mark" viewBox="0 0 128 128" focusable="false" aria-hidden="true">
    <g class="gaja-mark-main">
      <path d="M37 42C29 40 23 45 18 54C18 63 23 70 30 75C34 79 35 86 39 89C44 92 49 86 48 78C47 69 47 60 45 52C43 46 40 43 37 42Z"/>
      <path d="M20 54C25 55 29 49 34 46C39 44 43 47 45 51C40 53 36 58 33 64"/>
      <path d="M40 42C49 36 59 35 67 40C74 45 74 51 79 55C85 60 83 69 84 78C84 85 86 90 90 91C95 93 99 89 99 84C100 78 97 71 95 67C93 63 93 59 98 57C100 56 102 57 102 59"/>
      <path d="M98 62C100 62 102 63 103 65C108 73 109 85 104 94C98 103 84 104 74 97C68 93 65 87 62 82"/>
      <path d="M47 64C45 72 46 78 52 80C56 81 59 80 62 83"/>
    </g>
    <g class="gaja-mark-detail">
      <path d="M55 57C58 54 63 54 66 57"/>
      <path d="M56 59C59 56 63 56 66 59C64 62 59 63 56 59Z"/>
      <path d="M58 75C60 75 60 79 62 80C64 78 67 77 69 79"/>
      <path d="M67 79C69 81 72 83 75 84C72 81 70 79 68 77"/>
    </g>
    <circle class="gaja-mark-pupil" cx="63.1" cy="59" r="0.85"/>
    <g class="gaja-mark-petal">
      <path d="M92 43C86 38 86 30 92 23C99 30 101 38 94 43C93 44 92 44 92 43Z"/>
      <path d="M89 41C83 36 82 28 84 22C90 26 93 33 92 41"/>
      <path d="M94 41C99 33 104 29 108 27C108 34 104 40 96 43"/>
      <path d="M89 42C83 45 77 41 75 35C82 34 87 36 92 41"/>
      <path d="M95 43C102 41 108 37 111 34C108 42 102 46 95 45"/>
      <path d="M88 32C88 27 91 22 94 19C98 23 100 28 100 32"/>
      <path d="M94 44C100 44 104 47 105 50C99 51 94 48 91 44"/>
      <path d="M92 43C88 49 89 56 99 60.5"/>
    </g>
    </svg><span class="settings-badge" aria-hidden="true">⚙︎</span></summary>
    <div class="visual-settings-popover" id="gaja-visual-settings">
      <p class="settings-title">Appearance settings</p>
      ${visualPreferenceControls()}
      ${sourceSettings()}
      <p class="settings-note">Card size and lotus position are available in the native Gajendra app.</p>
    </div>
  </details>`;
}

function recordTitle(title: string): string {
  const text = escapeHtml(title);
  return `<span class="record-title-rest">${text}</span><span class="record-title-emphasis" aria-hidden="true">${text}</span>`;
}
