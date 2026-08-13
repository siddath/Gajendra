import { App } from "@modelcontextprotocol/ext-apps";

import type { DeckSnapshot, DeckThread, PriorityLevel } from "../shared/contracts.js";
import { fixtureSnapshot } from "./fixtures.js";
import { createDeckMotion, type DeckLayoutState, type RenderReason } from "./motion.js";
import "./styles.css";

const queriedRoot = document.querySelector<HTMLDivElement>("#app");
if (!queriedRoot) throw new Error("Gaja root was not found.");
const root: HTMLDivElement = queriedRoot;
const motion = createDeckMotion(root);

type VisualTheme = "native" | "focus-deck";
type AppearancePreference = "auto" | "light" | "dark";
type ResolvedAppearance = "light" | "dark";

const themeStorageKey = "gajendra.ui.theme.v1";
const appearanceStorageKey = "gajendra.ui.appearance.v1";
const systemDarkMode = window.matchMedia("(prefers-color-scheme: dark)");

let visualTheme: VisualTheme = readEnumPreference(themeStorageKey, ["native", "focus-deck"], "native");
let appearancePreference: AppearancePreference = readEnumPreference(appearanceStorageKey, ["auto", "light", "dark"], "auto");
let hostAppearance: ResolvedAppearance | null = null;

let snapshot: DeckSnapshot | null = null;
let app: App | null = null;
let busy = false;
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
    snapshot = structuredClone(fixtureSnapshot);
    render("initial");
    return;
  }

  app = new App({ name: "Gaja, Elephant Focus for AI Power Users", version: "0.3.1" });
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
  return new URLSearchParams(window.location.search).has("fixture") || window.parent === window;
}

function acceptSnapshot(value: unknown, reason: RenderReason, layoutState: DeckLayoutState | null = motion.captureLayout()): void {
  if (!value || typeof value !== "object" || !("focus" in value)) return;
  snapshot = value as DeckSnapshot;
  render(reason, layoutState);
}

function render(reason: RenderReason = "external", layoutState: DeckLayoutState | null = null): void {
  if (!snapshot) return renderLoading();
  root.innerHTML = `
    <header class="deck-header">
      <div class="deck-header-top">
        <div class="brand-lockup">
          ${brandMark()}
          <div>
            <p class="eyebrow">Gaja</p>
            <h1>What deserves your attention now?</h1>
          </div>
        </div>
        <button class="refresh-action" type="button" data-action="refresh" aria-label="Refresh Gaja">
          <span class="refresh-icon" aria-hidden="true">↻</span><span data-refresh-label>Refresh</span>
        </button>
      </div>
      <p class="lede">One source of truth across Codex, Claude, Cursor, and the agents you connect.</p>
      ${visualPreferenceControls()}
      <span class="visually-hidden" role="status" aria-live="polite" data-refresh-status>Gaja is up to date</span>
    </header>
    ${snapshot.error ? errorPanel(snapshot.error) : ""}
    ${sourcesPanel(snapshot.sources)}
    ${currentPanel(snapshot.current)}
    ${section("focus", "Double-star focus", "The short queue you have deliberately chosen.", snapshot.focus)}
    ${section("important", "Important", "Worth returning to after the focus queue.", snapshot.important)}
    ${availableSection(snapshot.available)}
    <footer class="deck-footer">
      <span>${snapshot.focus.length} focus · ${snapshot.important.length} important</span>
      <span>Metadata only · ${snapshot.sources.filter((source) => source.state === "ready").length} sources ready</span>
    </footer>
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
    <div class="now-topline"><p class="now-label"><span aria-hidden="true">◎</span><strong>NOW</strong><small>Current focus</small></p><span><span class="status-dot" aria-hidden="true"></span><span class="visually-hidden">Task status: ${escapeHtml(current.status)}</span></span></div>
    <div class="now-content">
      <div><h2 id="now-heading">${escapeHtml(current.title)}</h2><p class="thread-meta">${sourceBadge(current)} ${escapeHtml(current.project)}</p></div>
      <a class="primary-action" href="${escapeAttribute(current.deepLink)}" data-open-thread="${escapeAttribute(current.deepLink)}" aria-current="true">Open thread <span data-open-arrow aria-hidden="true">→</span></a>
    </div>
  </section>`;
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
        <a href="${escapeAttribute(thread.deepLink)}" data-open-thread="${escapeAttribute(thread.deepLink)}">${escapeHtml(thread.title)}</a>
      </div>
      <p class="thread-meta">${sourceBadge(thread)} ${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)}</p>
    </div>
    <div class="row-actions" aria-label="Actions for ${escapeAttribute(thread.title)}">
      ${thread.level === "focus" && !thread.isCurrent ? actionButton("Make Now", "current", thread.id) : ""}
      ${moveButtons(thread.id, index, count)}
      ${thread.level === "focus" ? actionButton("Important", "level-important", thread.id) : actionButton("Focus", "level-focus", thread.id)}
      ${actionButton("Remove", "level-none", thread.id)}
    </div>
  </li>`;
}

function availableSection(threads: DeckThread[]): string {
  return `<section class="available-section" aria-labelledby="available-heading">
    <div class="available-heading"><div><p class="eyebrow">All recent threads</p><h2 id="available-heading">Add to your focus system</h2></div><span>${threads.length}</span></div>
    <label class="search-label" for="task-search">Filter recent threads</label>
    <input id="task-search" type="search" placeholder="Search by thread, project, or source" autocomplete="off" />
    <ul class="available-list" id="available-list">
      ${threads.map(availableRow).join("") || '<li class="empty-row">Every recent task is already organized.</li>'}
    </ul>
  </section>`;
}

function availableRow(thread: DeckThread): string {
  return `<li class="available-row" draggable="true" data-thread-id="${escapeAttribute(thread.id)}" data-flip-id="thread-${escapeAttribute(thread.id)}" data-search-value="${escapeAttribute(`${thread.title} ${thread.project} ${thread.sourceName}`.toLowerCase())}">
    <div><a href="${escapeAttribute(thread.deepLink)}" data-open-thread="${escapeAttribute(thread.deepLink)}">${escapeHtml(thread.title)}</a><p class="thread-meta">${sourceBadge(thread)} ${escapeHtml(thread.project)} · ${relativeDate(thread.updatedAt)}</p></div>
    <div class="available-actions">${actionButton("Important", "level-important", thread.id)}${actionButton("Focus ✦✦", "level-focus", thread.id, true)}</div>
  </li>`;
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
  return `<a class="source-badge" href="${escapeAttribute(thread.deepLink)}" data-open-thread="${escapeAttribute(thread.deepLink)}" data-source-id="${escapeAttribute(thread.sourceId)}" aria-label="Open ${escapeAttribute(thread.title)} in ${escapeAttribute(thread.sourceName)}">${escapeHtml(thread.sourceName)}</a>`;
}

function visualPreferenceControls(): string {
  return `<div class="visual-controls" aria-label="Gaja visual preferences">
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
  root.querySelectorAll<HTMLButtonElement>("button[data-collapse]").forEach((button) => {
    button.addEventListener("click", () => void handleCollapse(button));
  });

  root.querySelectorAll<HTMLButtonElement>("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => void handleAction(button));
  });

  root.querySelector<HTMLInputElement>("#task-search")?.addEventListener("input", (event) => {
    const query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
    root.querySelectorAll<HTMLElement>(".available-row").forEach((row) => {
      motion.filterRow(row, !query || Boolean(row.dataset.searchValue?.includes(query)));
    });
  });

  root.querySelectorAll<HTMLAnchorElement>("a[data-open-thread]").forEach((anchor) => {
    anchor.addEventListener("click", async (event) => {
      event.preventDefault();
      const url = anchor.dataset.openThread;
      if (url) {
        await motion.acknowledgeOpen(anchor);
        await openThreadLink(url);
      }
    });
  });

  root.querySelectorAll<HTMLElement>("button, a").forEach((element) => motion.bindPress(element));
  bindDragAndDrop();

  root.querySelector<HTMLElement>(".now-card")?.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("a, button, input")) return;
    const current = snapshot?.current;
    if (current) void openThreadLink(current.deepLink);
  });
}

function bindDragAndDrop(): void {
  root.querySelectorAll<HTMLElement>(".thread-row[draggable=true], .available-row[draggable=true]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      const threadId = row.dataset.threadId;
      if (!threadId || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", threadId);
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", clearDragState);
  });

  root.querySelectorAll<HTMLElement>(".deck-section[data-drop-level]").forEach((sectionElement) => {
    sectionElement.addEventListener("dragover", (event) => {
      if (busy || !event.dataTransfer?.types.includes("text/plain")) return;
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
  root.querySelectorAll(".is-dragging, .is-drop-target, .is-drop-zone").forEach((element) => {
    element.classList.remove("is-dragging", "is-drop-target", "is-drop-zone");
  });
}

async function moveDroppedThread(threadId: string, level: PriorityLevel, beforeId?: string): Promise<void> {
  if (!snapshot || busy) return;
  const allThreads = [...snapshot.focus, ...snapshot.important, ...snapshot.available];
  const thread = allThreads.find((candidate) => candidate.id === threadId);
  if (!thread) return;

  if (thread.level !== level) await mutate("gajendra_set_level", { threadId, level });
  if (!snapshot || !beforeId || beforeId === threadId) return;

  const targetThreads = level === "focus" ? snapshot.focus : snapshot.important;
  let sourceIndex = targetThreads.findIndex((candidate) => candidate.id === threadId);
  const targetIndex = targetThreads.findIndex((candidate) => candidate.id === beforeId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  while (sourceIndex > targetIndex) {
    await mutate("gajendra_move", { threadId, direction: "up" });
    sourceIndex -= 1;
  }
  while (sourceIndex < targetIndex - 1) {
    await mutate("gajendra_move", { threadId, direction: "down" });
    sourceIndex += 1;
  }
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
  motion.setBusy(true, "Updating Gaja");
  try {
    if (!app) {
      fixtureMutation?.();
      applyFixtureMutation(tool, args);
      render(reason, layoutState);
      return;
    }
    const result = await app.callServerTool({ name: tool, arguments: args });
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
    return;
  }
  const id = String(args.threadId ?? "");
  const all = [...snapshot.focus, ...snapshot.important, ...snapshot.available];
  const target = all.find((thread) => thread.id === id);
  if (tool === "gajendra_set_collapsed") return;
  if (!target) return;
  if (tool === "gajendra_move") {
    const list = target.level === "focus" ? snapshot.focus : snapshot.important;
    const from = list.findIndex((thread) => thread.id === id);
    const offset = args.direction === "up" ? -1 : 1;
    const to = Math.max(0, Math.min(list.length - 1, from + offset));
    if (from >= 0 && from !== to) [list[from], list[to]] = [list[to]!, list[from]!];
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
    target.isCurrent = false;
    target.level = (args.level as PriorityLevel | null) ?? null;
    (target.level === "focus" ? snapshot.focus : target.level === "important" ? snapshot.important : snapshot.available).push(target);
    if (snapshot.current?.id === id) {
      const next = snapshot.focus[0] ?? null;
      if (next) next.isCurrent = true;
      snapshot.current = next;
    }
  }
  snapshot.focusOverGuide = snapshot.focus.length > snapshot.focusGuide;
}

async function refresh(): Promise<void> {
  if (busy) return;
  const layoutState = motion.captureLayout();
  busy = true;
  motion.setBusy(true, "Refreshing Gaja");
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

async function openThreadLink(url: string): Promise<void> {
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
  window.location.assign(url);
}

function renderLoading(): void {
  root.innerHTML = `<section class="loading-state" role="status">${brandMark()}<h1>Loading Gaja…</h1><p>Reading metadata from your enabled thread sources.</p></section>`;
}

function renderConnectionError(error: unknown): void {
  const message = error instanceof Error ? error.message : "The MCP App connection failed.";
  root.innerHTML = `<section class="loading-state error" role="alert">${brandMark()}<h1>Gaja could not open</h1><p>${escapeHtml(message)}</p><button type="button" data-action="retry">Try again</button></section>`;
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
  return `<span class="brand-mark" aria-hidden="true"><svg class="lotus-mark" viewBox="0 0 128 128" focusable="false">
    <g class="lotus-petal">
      <path d="M64 101C48 83 49 47 64 24C79 47 80 83 64 101Z"/>
      <path d="M61 101C42 91 29 70 31 49C49 56 61 73 64 96"/>
      <path d="M67 101C86 91 99 70 97 49C79 56 67 73 64 96"/>
      <path d="M59 105C38 105 18 92 11 72C31 70 50 82 63 103"/>
      <path d="M69 105C90 105 110 92 117 72C97 70 78 82 65 103"/>
      <path d="M24 102C42 116 86 116 104 102"/>
      <path d="M38 113C51 121 77 121 90 113"/>
    </g>
  </svg></span>`;
}
