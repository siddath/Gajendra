import { App } from "@modelcontextprotocol/ext-apps";

import {
  allDeckThreads,
  isDeckMutationResult,
  isPermittedDeepLink,
  isRunningThreadStatus,
  MUTATION_PROTOCOL_VERSION,
  normalizeDeckSelection,
  reviewReadyDeckThreads,
  runningDeckThreads,
  type DeckSnapshot,
  type DeckThread,
  type PriorityLevel,
  type ThreadContext,
} from "../shared/contracts.js";
import { fixtureSnapshot } from "./fixtures.js";
import { createDeckMotion, type DeckLayoutState, type RenderReason } from "./motion.js";
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

let snapshot: DeckSnapshot | null = null;
let app: App | null = null;
let busy = false;
let runningExpanded = true;
let reviewExpanded = true;
let draggedThreadId: string | null = null;
const fixtureNow = new Date("2026-08-11T15:00:00.000Z").valueOf();

applyVisualPreferences();
systemDarkMode.addEventListener("change", handleSystemAppearanceChange);

window.addEventListener("pagehide", () => {
  systemDarkMode.removeEventListener("change", handleSystemAppearanceChange);
  motion.destroy();
}, { once: true });

void start();

async function start(): Promise<void> {
  if (shouldUseFixture()) {
    snapshot = normalizeDeckSelection(structuredClone(fixtureSnapshot));
    render("initial");
    return;
  }

  app = hostTestHooks()?.createApp?.() ?? new App({ name: "Gajendra", version: "0.3.1" });
  app.addEventListener("hostcontextchanged", (context) => {
    const changedAppearance = normalizeAppearance(context.theme);
    if (!changedAppearance) return;
    hostAppearance = changedAppearance;
    if (appearancePreference === "auto") applyVisualPreferences();
  });
  app.ontoolresult = (result) => {
    if (!busy) acceptSnapshot(result.structuredContent, "external");
  };
  renderLoading();
  busy = true;
  try {
    await app.connect();
    hostAppearance = normalizeAppearance(app.getHostContext()?.theme);
    applyVisualPreferences();
    const result = await app.callServerTool({ name: "gajendra_open", arguments: {} });
    acceptSnapshot(result.structuredContent, "initial");
  } catch (error) {
    renderConnectionError(error);
  } finally {
    busy = false;
    motion.setBusy(false);
  }
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
    snapshot = normalizeDeckSelection({
      ...value.snapshot,
      error: value.error?.message ?? value.snapshot.error,
    });
    render(reason, layoutState);
    return;
  }
  if (!value || typeof value !== "object" || !("focus" in value)) return;
  snapshot = normalizeDeckSelection(value as DeckSnapshot);
  render(reason, layoutState);
}

function render(reason: RenderReason = "external", layoutState: DeckLayoutState | null = null): void {
  if (!snapshot) return renderLoading();
  const running = runningDeckThreads(snapshot);
  const reviewReady = reviewReadyDeckThreads(snapshot);
  const recent = snapshot.available.filter((thread) => !isRunningThreadStatus(thread.status) && thread.review?.state !== "ready");
  root.innerHTML = `
    <div class="deck-scroll-surface" aria-label="Scrollable Gajendra task overview">
      <header class="deck-header">
        <div class="deck-header-top">
          <div class="brand-lockup">
            ${brandMark()}
            <div class="brand-copy">
              <p class="eyebrow">Gajendra</p>
              <h1>One clear focus across your AI tools.</h1>
              <p class="lede">One NOW. One short queue. One click back to the exact thread.</p>
            </div>
          </div>
          <button class="refresh-action" type="button" data-action="refresh" aria-label="Refresh Gajendra">
            <span class="refresh-icon" aria-hidden="true">↻</span><span data-refresh-label>Refresh</span>
          </button>
        </div>
        <span class="visually-hidden" role="status" aria-live="polite" data-refresh-status>Gajendra is up to date</span>
      </header>
      ${snapshot.error ? errorPanel(snapshot.error) : ""}
      ${sourcesPanel(snapshot.sources)}
      ${currentPanel(snapshot.current)}
      ${section("focus", "Focus", "The short queue you have deliberately chosen.", snapshot.focus)}
      ${section("important", "Important", "Worth returning to after the focus queue.", snapshot.important)}
      ${runningSection(running)}
      ${reviewSection(reviewReady)}
      ${availableSection(snapshot, recent)}
      <footer class="deck-footer">
        <span>${snapshot.focus.length} focus · ${snapshot.important.length} important</span>
        <span>Metadata only · ${snapshot.sources.filter((source) => source.state === "ready").length} sources ready</span>
      </footer>
    </div>
    ${threadSearchFooter(snapshot, recent.length)}
  `;
  bindInteractions();
  motion.setBusy(busy);
  motion.animateRender(layoutState, reason);
}

function currentPanel(current: DeckThread | null): string {
  if (!current) {
    return `<section class="now-card now-empty" aria-labelledby="now-heading">
      <div><p class="now-label">NOW</p><h2 id="now-heading">Choose one task to focus on</h2></div>
      <p>Promote a task to Focus, then mark it as Now.</p>
    </section>`;
  }
  return `<section class="now-card" aria-labelledby="now-heading">
    <div class="now-topline"><p class="now-label"><span aria-hidden="true">◎</span><strong>NOW</strong><small>Current focus</small></p></div>
    <div class="now-content">
      <div><h2 id="now-heading">${escapeHtml(current.title)} ${reviewMark(current)}</h2><p class="thread-meta">${escapeHtml(current.project)} ${contextBadge(current)}</p></div>
      <div class="now-actions" aria-label="Current task actions">
        <a class="primary-action" ${openThreadAttributes(current)} aria-current="true">Open thread <span data-open-arrow aria-hidden="true">→</span></a>
        ${activitySignal(current)}
        ${sourceBadge(current)}
      </div>
    </div>
  </section>`;
}

function activitySignal(thread: DeckThread): string {
  const running = isRunningThreadStatus(thread.status);
  return `<div class="activity-signal" data-running="${String(running)}" aria-label="${running ? "Running now" : "Ready to resume"}. ${relativeDate(thread.updatedAt)}">
    <span class="activity-symbol" aria-hidden="true">${running ? "●" : "◷"}</span>
    <span><strong>${running ? "Running now" : "Ready to resume"}</strong><small>${relativeDate(thread.updatedAt)}</small></span>
  </div>`;
}

function section(level: PriorityLevel, title: string, description: string, threads: DeckThread[]): string {
  const isCollapsed = snapshot?.collapsed[level] ?? false;
  const warning = level === "focus" && snapshot?.focusOverGuide
    ? `<p class="section-warning" role="status">You have more than the ${snapshot.focusGuide}-task focus guide. Keep only what can truly win.</p>`
    : "";
  return `<section class="deck-section" data-drop-level="${level}" aria-labelledby="${level}-heading">
    <button class="section-toggle" type="button" data-collapse="${level}" aria-expanded="${String(!isCollapsed)}" aria-controls="${level}-list">
      <span><span class="section-heading"><span class="section-symbol" aria-hidden="true">${level === "focus" ? "★" : "◆"}</span><span class="section-title" id="${level}-heading">${escapeHtml(title)}</span><span class="section-count">${threads.length}</span></span><span class="section-description">${escapeHtml(description)}</span></span>
      <span class="chevron" aria-hidden="true">⌄</span>
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
        ${reviewMark(thread)}
        <a ${openThreadAttributes(thread)}>${escapeHtml(thread.title)}</a>
      </div>
      <p class="thread-meta">${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${contextBadge(thread)} ${sourceBadge(thread)}</p>
    </div>
    <div class="row-actions" aria-label="Actions for ${escapeAttribute(thread.title)}">
      ${contextSelector(thread)}
      ${thread.level === "focus" && !thread.isCurrent ? actionButton("Make Now", "current", thread.id) : ""}
      ${moveButtons(thread.id, index, count)}
      ${thread.isCurrent ? "" : thread.level === "focus" ? actionButton("Important", "level-important", thread.id) : actionButton("Focus", "level-focus", thread.id)}
      ${thread.isCurrent ? "" : actionButton("Remove", "level-none", thread.id)}
    </div>
  </li>`;
}

function runningSection(threads: DeckThread[]): string {
  return `<section class="running-section deck-section" aria-labelledby="running-heading">
    <button class="running-heading running-toggle" type="button" data-running-toggle aria-expanded="${String(runningExpanded)}" aria-controls="running-list" ${threads.length ? "" : "disabled"}>
      <span><span class="running-title"><span class="running-symbol" aria-hidden="true">◉</span><span id="running-heading">Running</span><span class="section-count">${threads.length}</span></span>
      <span class="running-description">Active provider work across every priority lane.</span></span>
      <span class="running-scope"><span>All priority lanes</span>${threads.length ? '<span class="running-chevron chevron" aria-hidden="true">⌄</span>' : ""}</span>
    </button>
    <ul class="running-list thread-list" id="running-list" ${runningExpanded ? "" : "hidden"}>
      ${threads.length ? threads.map(runningRow).join("") : '<li class="empty-row">No provider reports active work.</li>'}
    </ul>
  </section>`;
}

function runningRow(thread: DeckThread): string {
  return `<li class="available-row running-row" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="running-${escapeAttribute(thread.id)}">
    <div><a ${openThreadAttributes(thread)}>${escapeHtml(thread.title)}</a><p class="thread-meta">${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${sourceBadge(thread)} ${placementBadge(thread)}</p></div>
    <div class="available-actions">${threadActions(thread)}</div>
  </li>`;
}

function reviewSection(threads: DeckThread[]): string {
  return `<section class="review-section deck-section" aria-labelledby="review-heading">
    <button class="running-heading review-heading" type="button" data-review-toggle aria-expanded="${String(reviewExpanded)}" aria-controls="review-list" ${threads.length ? "" : "disabled"}>
      <span><span class="running-title review-title"><span class="review-symbol" aria-hidden="true">✓</span><span id="review-heading">Ready for Review</span><span class="section-count">${threads.length}</span></span>
      <span class="running-description">Provider-confirmed work where human attention is useful.</span></span>
      <span class="running-scope review-scope"><span>Needs your review</span>${threads.length ? '<span class="review-chevron chevron" aria-hidden="true">⌄</span>' : ""}</span>
    </button>
    <ul class="running-list review-list thread-list" id="review-list" ${reviewExpanded ? "" : "hidden"}>
      ${threads.length ? threads.map(reviewRow).join("") : '<li class="empty-row">No provider reports work ready for review.</li>'}
    </ul>
  </section>`;
}

function reviewRow(thread: DeckThread): string {
  const action = thread.review?.destination.type === "thread" ? "Task" : "Review";
  return `<li class="available-row review-row" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="review-${escapeAttribute(thread.id)}">
    <div class="review-row-main"><a class="review-primary" ${openReviewAttributes(thread)}><span class="review-mark" aria-hidden="true">✓</span><span><strong>${escapeHtml(thread.title)}</strong><small>${relativeDate(thread.review?.updatedAt ?? 0)}</small></span><span class="review-destination-label">${action}</span></a><p class="thread-meta">${sourceBadge(thread)} ${placementBadge(thread)}</p></div>
    <div class="available-actions">${threadActions(thread)}</div>
  </li>`;
}

function availableSection(deck: DeckSnapshot, recent: DeckThread[]): string {
  const recentIds = new Set(recent.map((thread) => thread.id));
  const threads = allDeckThreads(deck);
  return `<section class="available-section" aria-labelledby="available-heading">
    <div class="available-heading"><div><p class="eyebrow">Thread organizer</p><h2 id="available-heading">Find and organize any thread</h2></div><span data-search-count>${recent.length}</span></div>
    <ul class="available-list" id="available-list">
      ${threads.map((thread) => availableRow(thread, recentIds.has(thread.id))).join("") || '<li class="empty-row">No threads are available.</li>'}
    </ul>
  </section>`;
}

function threadSearchFooter(deck: DeckSnapshot, visibleCount: number): string {
  const total = allDeckThreads(deck).length;
  return `<section class="thread-search-footer" role="search" aria-label="All-thread search">
    <label class="visually-hidden" for="task-search">Search all ${total} threads</label>
    <input id="task-search" type="search" placeholder="Search all ${total} threads" autocomplete="off" aria-describedby="thread-search-status" />
    <span class="thread-search-status" id="thread-search-status" data-search-status aria-live="polite">${visibleCount} recent</span>
  </section>`;
}

function availableRow(thread: DeckThread, isRecent: boolean): string {
  return `<li class="available-row" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="search-${escapeAttribute(thread.id)}" data-search-value="${escapeAttribute(searchableThreadMetadata(thread))}" data-is-recent="${String(isRecent)}" ${isRecent ? "" : "hidden"}>
    <div><a ${openThreadAttributes(thread)}>${reviewMark(thread)}${escapeHtml(thread.title)}</a><p class="thread-meta">${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)} ${sourceBadge(thread)} ${placementBadge(thread)}</p></div>
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

function reviewMark(thread: DeckThread): string {
  return thread.review?.state === "ready" && !isRunningThreadStatus(thread.status)
    ? '<span class="review-mark" aria-label="Ready for Review" title="Provider reports work ready for review">✓</span>'
    : "";
}

function threadActions(thread: DeckThread): string {
  if (thread.isCurrent) return "";
  return [
    actionButton("Make Now", "current", thread.id),
    thread.level === "important" ? "" : actionButton("Important", "level-important", thread.id),
    thread.level === "focus" ? "" : actionButton("Focus", "level-focus", thread.id, true),
    thread.level ? actionButton("Remove", "level-none", thread.id) : "",
  ].join("");
}

function actionButton(label: string, action: string, threadId: string, emphasized = false): string {
  return `<button type="button" class="text-action ${emphasized ? "emphasized" : ""}" data-action="${action}" data-thread-id="${escapeAttribute(threadId)}">${escapeHtml(label)}</button>`;
}

function moveButtons(threadId: string, index: number, count: number): string {
  return `<button type="button" class="icon-action" data-action="move-up" data-thread-id="${escapeAttribute(threadId)}" ${index === 0 ? "disabled" : ""} aria-label="Move task up">↑</button><button type="button" class="icon-action" data-action="move-down" data-thread-id="${escapeAttribute(threadId)}" ${index === count - 1 ? "disabled" : ""} aria-label="Move task down">↓</button>`;
}

function emptyRow(level: PriorityLevel): string {
  return `<li class="empty-row">No ${level} tasks yet. Add one from recent tasks below.</li>`;
}

function errorPanel(message: string): string {
  return `<section class="error-panel" role="alert"><strong>Thread sources are unavailable.</strong><span>${escapeHtml(message)}</span><button type="button" data-action="retry">Try again</button></section>`;
}

function sourcesPanel(sources: DeckSnapshot["sources"]): string {
  return `<section class="sources-strip" aria-label="Thread sources">
    <div class="sources-label"><span>Sources</span><span>${sources.filter((source) => source.state === "ready").length}/${sources.length} ready</span></div>
    <div class="source-chips">${sources.map((source) => `<button type="button" class="source-chip state-${source.state}" data-action="source-toggle" data-source-id="${escapeAttribute(source.id)}" data-source-enabled="${String(source.enabled)}" aria-label="${escapeAttribute(`${source.name}: ${source.state}. ${source.enabled ? "Disable" : "Enable"} source`)}" title="${escapeAttribute(source.detail ?? source.state)}"><span class="source-dot" aria-hidden="true"></span>${escapeHtml(source.name)}<span class="source-count">${source.threadCount}</span></button>`).join("")}</div>
  </section>`;
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
    const terms = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase().split(/\s+/u).filter(Boolean);
    let visibleCount = 0;
    root.querySelectorAll<HTMLElement>("#available-list .available-row").forEach((row) => {
      const visible = terms.length
        ? terms.every((term) => row.dataset.searchValue?.includes(term))
        : row.dataset.isRecent === "true";
      if (visible) visibleCount += 1;
      motion.filterRow(row, visible);
    });
    root.querySelectorAll<HTMLElement>("[data-search-count]").forEach((count) => {
      count.textContent = String(visibleCount);
    });
    const status = root.querySelector<HTMLElement>("[data-search-status]");
    if (status) status.textContent = terms.length
      ? `${visibleCount} ${visibleCount === 1 ? "match" : "matches"}`
      : `${visibleCount} recent`;
    if (terms.length) root.querySelector<HTMLElement>(".available-section")?.scrollIntoView({ block: "start" });
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
      if (!resolveCapturedOpenTarget(anchor, capturedIntent)) return rejectOpenDestination();
      await motion.acknowledgeOpen(anchor);
      // The acknowledgement is asynchronous. Re-resolve immediately before the host/browser
      // boundary so a refresh that removed readiness, changed destination, or removed the thread
      // cannot turn a stale press into navigation.
      const target = resolveCapturedOpenTarget(anchor, capturedIntent);
      if (!target) return rejectOpenDestination();
      await openThreadLink(target.url, target.thread);
    });
  });

  root.querySelectorAll<HTMLElement>("button, a").forEach((element) => motion.bindPress(element));
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
  const level = button.dataset.collapse as PriorityLevel;
  const collapsed = button.getAttribute("aria-expanded") === "true";
  const list = root.querySelector<HTMLElement>(`#${level}-list`);
  await motion.animateCollapse(button, list, collapsed);
  await mutate(
    "gajendra_set_collapsed",
    { level, collapsed },
    () => {
      if (snapshot) snapshot.collapsed[level] = collapsed;
    },
    collapsed ? "collapse" : "expand",
  );
}

async function handleAction(button: HTMLButtonElement): Promise<void> {
  const action = button.dataset.action;
  const threadId = button.dataset.threadId;
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
  if (action === "source-toggle") {
    const sourceId = button.dataset.sourceId;
    if (!sourceId) return;
    return mutate("gajendra_set_source_enabled", { sourceId, enabled: button.dataset.sourceEnabled !== "true" });
  }
  if (!threadId || !action) return;
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

async function mutate(
  tool: string,
  args: Record<string, unknown>,
  fixtureMutation?: () => void,
  reason: RenderReason = "mutation",
): Promise<void> {
  if (busy) return;
  const layoutState = motion.captureLayout();
  busy = true;
  motion.setBusy(true, "Updating Gajendra");
  try {
    if (!app) {
      fixtureMutation?.();
      applyFixtureMutation(tool, args);
      render(reason, layoutState);
      return;
    }
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
  } catch (error) {
    renderRecoverableError(error, layoutState);
  } finally {
    busy = false;
    motion.setBusy(false);
  }
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

async function refresh(): Promise<void> {
  if (busy) return;
  const layoutState = motion.captureLayout();
  busy = true;
  motion.setBusy(true, "Refreshing Gajendra");
  try {
    if (!app) {
      render("refresh", layoutState);
      return;
    }
    const result = await app.callServerTool({ name: "gajendra_open", arguments: {} });
    acceptSnapshot(result.structuredContent, "refresh", layoutState);
  } catch (error) {
    renderRecoverableError(error, layoutState);
  } finally {
    busy = false;
    motion.setBusy(false);
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
  if (candidate?.openLink) {
    try {
      const result = (await candidate.openLink({ url })) as { isError?: boolean };
      if (!result.isError) return;
    } catch {
      // Fall through to the native URI navigation attempt.
    }
  }
  try {
    const navigate = hostTestHooks()?.navigate;
    if (navigate) navigate(url);
    else window.location.assign(url);
  } catch (error) {
    renderRecoverableError(error, motion.captureLayout());
  }
}

function renderLoading(): void {
  root.innerHTML = `<section class="loading-state" role="status">${brandMark()}<h1>Loading Gajendra…</h1><p>Reading metadata from your enabled thread sources.</p></section>`;
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
  updateVisualPreferenceControls();
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
      <p class="settings-note">Card size and lotus position are available in the native Gajendra app.</p>
    </div>
  </details>`;
}
