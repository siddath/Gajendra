import { mkdir } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureSnapshot } from "../../src/ui/fixtures.js";

const evidenceDirectory = path.resolve(process.cwd(), "../../evidence/gauntlet");

async function openRowActions(row: Locator): Promise<void> {
  const menu = row.locator("details.row-menu").first();
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await menu.locator(":scope > summary").click();
  }
  await expect(menu).toHaveAttribute("open", "");
}

async function chooseRowAction(row: Locator, name: string): Promise<void> {
  await openRowActions(row);
  await row.getByRole("button", { name, exact: true }).click();
}

async function openHistory(page: Page): Promise<void> {
  const toggle = page.locator('[data-action="toggle-history"]');
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.locator("#available-list")).toBeVisible();
}

async function installDelayedReviewHost(page: Page): Promise<void> {
  await page.addInitScript(initial => {
    const original = structuredClone(initial);
    delete original.product;
    const pending: { resolve(value: unknown): void; reject(error: Error): void; args: Record<string, unknown> }[] = [];
    const keys: unknown[] = [];
    const host = {
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => { host.ontoolresult?.({ structuredContent: structuredClone(original) }); },
      callServerTool: async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
        if (name === "gajendra_sync") return { structuredContent: { revision: original.revision } };
        if (name === "gajendra_open") return { structuredContent: structuredClone(original) };
        keys.push(args.idempotencyKey);
        return new Promise((resolve, reject) => pending.push({ resolve, reject, args }));
      },
    };
    const control = {
      keys,
      settle(outcome: "success" | "failure") {
        const request = pending.shift();
        if (!request) throw new Error("No review write is pending");
        if (outcome === "failure") { request.reject(new Error("Connection interrupted. Retry to save your review.")); return; }
        const next = structuredClone(original);
        next.revision += 1;
        for (const row of [...next.focus, ...next.important, ...next.available]) {
          if (row.id === request.args.threadId) { delete row.review; row.reviewAcknowledged = true; }
        }
        request.resolve({ structuredContent: { protocolVersion: 1, outcome: "applied", revision: next.revision, snapshot: next } });
      },
      newer() {
        const next = structuredClone(original);
        const row = next.focus.find(thread => thread.id === "review-agent:focus-review")!;
        row.review!.identity = "e".repeat(64);
        row.review!.updatedAt += 100;
        host.ontoolresult?.({ structuredContent: next });
      },
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __reviewControl: control });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
}

type ReviewHostControl = { keys: string[]; settle(outcome: "success" | "failure"): void; newer(): void };

test.beforeEach(async ({ page }) => {
  await page.goto("/gajendra.html?fixture=1");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
});

test("renders the entrypoint's initial result without scanning providers twice", async ({ page }) => {
  await page.addInitScript((snapshot) => {
    const state = { scans: 0 };
    const host = {
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => { host.ontoolresult?.({ structuredContent: snapshot }); },
      callServerTool: async () => { state.scans += 1; throw new Error("Duplicate scan"); },
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __entrypointState: state });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
  expect(await page.evaluate(() => (window as unknown as { __entrypointState: { scans: number } }).__entrypointState.scans)).toBe(0);
});

test("follows host styles in Auto and preserves an explicit appearance override", async ({ page }) => {
  await page.addInitScript((snapshot) => {
    let notify: (context: unknown) => void = () => undefined;
    const host = {
      addEventListener: (_event: string, callback: typeof notify) => { notify = callback; },
      getHostContext: () => ({ theme: "light", styles: { variables: { "--color-background-primary": "#f2f1ed", "--color-text-primary": "#222222", "--font-sans": "Arial, sans-serif" } } }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => { host.ontoolresult?.({ structuredContent: snapshot }); },
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __hostStyleChange: () => notify({ theme: "dark", styles: { variables: { "--color-background-primary": "#181818", "--color-text-primary": "#eeeeee" } } }) });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(242, 241, 237)");
  await expect(page.locator("html")).toHaveCSS("font-family", "Arial, sans-serif");
  await page.evaluate(() => (window as unknown as { __hostStyleChange(): void }).__hostStyleChange());
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 24, 24)");
  await page.getByRole("button", { name: "Open Gajendra settings" }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(245, 245, 247)");
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(24, 24, 24)");
});

test("keeps provider status separate from explicit source switches", async ({ page }) => {
  const codex = page.locator('.source-chip[data-source-id="codex"]');
  await codex.click();
  await expect(codex).toHaveClass(/state-ready/u);
  await expect(page.getByRole("switch", { name: "Codex source" })).toBeHidden();
  await page.getByRole("button", { name: "Manage sources" }).click();
  const source = page.getByRole("switch", { name: "Codex source" });
  await expect(source).toBeFocused();
  await expect(source).toHaveAttribute("aria-checked", "true");
  await source.press("Space");
  await expect(source).toHaveAttribute("aria-checked", "false");
  await expect(codex).toHaveClass(/state-disabled/u);
  await expect(source).toBeFocused();
  await source.press("Space");
  await expect(codex).toHaveClass(/state-ready/u);
});

test("keeps search, caret and matching rows through host updates and priority changes", async ({ page }) => {
  await page.addInitScript((snapshot) => {
    const host = {
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => { host.ontoolresult?.({ structuredContent: snapshot }); },
      callServerTool: async () => ({ structuredContent: snapshot }),
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __hostRefresh: () => host.ontoolresult?.({ structuredContent: snapshot }) });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await page.getByRole("button", { name: "Refresh Gajendra" }).focus();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("gajendra codex active");
  await expect(page.locator("[data-search-status]")).toHaveText("1 match");
  await search.press("ArrowLeft");
  const caret = await search.evaluate((element) => (element as HTMLInputElement).selectionStart);
  await page.evaluate(() => (window as unknown as { __hostRefresh(): void }).__hostRefresh());
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("gajendra codex active");
  expect(await search.evaluate((element) => (element as HTMLInputElement).selectionStart)).toBe(caret);
  await expect(page.locator("#available-list .available-row:visible")).toHaveCount(1);
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await page.goto("/gajendra.html?fixture=1");
  await page.getByRole("button", { name: "Refresh Gajendra" }).focus();
  await page.keyboard.press("/");
  await search.fill("provider claude");
  const matches = page.locator("#available-list .available-row:visible");
  await chooseRowAction(matches.first(), "Make Now");
  await expect(search).toHaveValue("provider claude");
  await expect(matches.first()).toContainText("NOW");
  await page.getByRole("button", { name: "Refresh Gajendra" }).click();
  await expect(search).toHaveValue("provider claude");
});

test("reconnects after a failed bridge handshake and keeps saved-state warnings visible", async ({ page }) => {
  await page.addInitScript((snapshot) => {
    let attempts = 0;
    Object.assign(window, { __gajendraHostTest: { createApp: () => ({
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      async connect() {
        if (++attempts === 1) throw new Error("Connection interrupted");
        this.ontoolresult?.({ structuredContent: { ...snapshot, staleEntryCount: 8, current: null, focus: [], important: [], available: [], error: "No sources are available." } });
      },
      callServerTool: async () => ({ structuredContent: { ...snapshot, staleEntryCount: 8, current: null, focus: [], important: [], available: [], error: "No sources are available." } }),
    }) } });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await expect(page.getByRole("alert")).toContainText("Connection interrupted");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("8 saved priorities are outside", { exact: false })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("No sources are available.");
});

test("shows an actionable error for an invalid host result instead of loading forever", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __gajendraHostTest: { createApp: () => ({
      addEventListener: () => undefined,
      getHostContext: () => ({}),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      async connect() { this.ontoolresult?.({ structuredContent: null }); },
      callServerTool: async () => ({ content: [] }),
    }) } });
  });
  await page.goto("/gajendra.html?host-test=1");
  await expect(page.getByRole("alert")).toContainText("no usable thread data");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("lets a connected host retry missing initial data and opens the exact task through the bridge", async ({ page }) => {
  await page.addInitScript((snapshot) => {
    const state = { opens: [] as string[] };
    Object.assign(window, {
      __entrypointState: state,
      __gajendraHostTest: { createApp: () => ({
        addEventListener: () => undefined,
        getHostContext: () => ({}),
        connect: async () => undefined,
        callServerTool: async () => ({ structuredContent: snapshot }),
        openLink: async ({ url }: { url: string }) => { state.opens.push(url); return {}; },
      }) },
    });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await page.getByRole("button", { name: "Retry loading" }).click();
  const open = page.locator(".now-card .primary-action");
  const destination = await open.getAttribute("href");
  await open.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __entrypointState: { opens: string[] } }).__entrypointState.opens)).toEqual([destination]);
  await expect(page.locator(".error-panel")).toHaveCount(0);
});

test("makes one current thread unmistakable and returns to its native provider destination", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-gaja-theme", "native");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "Gajendra", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Work views" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your priorities", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  const now = page.locator(".now-card");
  await expect(now.getByText("NOW", { exact: true })).toBeVisible();
  const open = now.getByRole("link", { name: /Open thread/ });
  await expect(open).toHaveAttribute("href", /^codex:\/\/threads\//u);
  await expect(open).toHaveAttribute("aria-current", "true");
  await expect(now.locator(".activity-signal")).toContainText("Running now");
  await expect(now.locator(".activity-signal")).toContainText("Updated today");
  await expect(page.locator(".thread-row.is-current .now-pill")).toHaveText("NOW");
  expect(await now.locator(".now-actions > *").evaluateAll((elements) => elements.map((element) => element.className))).toEqual([
    "primary-action",
    "activity-signal",
    "row-menu",
  ]);

  const contentBox = await now.locator(".now-content").boundingBox();
  const titleBox = await now.getByRole("heading", { name: "Ship the Gajendra source release" }).boundingBox();
  const openBox = await open.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(openBox).not.toBeNull();
  expect(openBox!.y).toBeGreaterThanOrEqual(titleBox!.y + titleBox!.height);
  expect(openBox!.y).toBeGreaterThanOrEqual(contentBox!.y);
  expect(openBox!.y + openBox!.height).toBeLessThanOrEqual(contentBox!.y + contentBox!.height);

  await open.focus();
  await expect(open).toBeFocused();
  await expect(now.getByRole("button", { name: "Finish work" })).toBeHidden();
  await openRowActions(now);
  await expect(now.getByRole("button", { name: "Finish work" })).toBeVisible();
});

test("switches and persists exactly Native Popover and Focus Deck across light, dark, and auto", async ({ page }) => {
  const settings = page.getByRole("button", { name: "Open Gajendra settings" });
  await settings.click();
  const native = page.getByRole("button", { name: "Native", exact: true });
  const focusDeck = page.getByRole("button", { name: "Focus Deck", exact: true });
  await expect(native).toHaveAttribute("aria-pressed", "true");
  await focusDeck.click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-gaja-theme", "focus-deck");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await settings.click();
  await expect(focusDeck).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.evaluate(() => {
    localStorage.setItem("gajendra.ui.theme.v1", "command-capsule");
    localStorage.setItem("gajendra.ui.appearance.v1", "sepia");
  });
  await page.reload();
  await settings.click();
  await expect(page.locator("html")).toHaveAttribute("data-gaja-theme", "native");
  await expect(page.getByRole("button", { name: "Auto", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("provider badges resume the exact owning thread and counts stay beside labels", async ({ page }) => {
  const codex = page.locator('.source-badge[data-source-id="codex"]').first();
  const claude = page.locator('.source-badge[data-source-id="claude"]').first();
  const cursor = page.locator('.source-badge[data-source-id="cursor"]').first();
  const grok = page.locator('.source-badge[data-source-id="grok"]').first();
  await expect(codex).toHaveAttribute("href", /^codex:\/\/threads\//u);
  await expect(claude).toHaveAttribute("href", /^gajendra:\/\/thread\/claude/u);
  await expect(cursor).toHaveAttribute("href", /^gajendra:\/\/thread\/cursor/u);
  await expect(grok).toHaveAttribute("href", /^gajendra:\/\/thread\/grok/u);
  await codex.click();
  await expect(page.locator("#app")).toHaveAttribute("data-last-opened-thread", /^codex:\/\/threads\//u);

  const nowCard = page.locator(".now-card");
  await nowCard.dblclick({ position: { x: 12, y: 12 } });
  await expect(page.locator("#app")).toHaveAttribute("data-last-opened-thread", /^codex:\/\/threads\//u);

  const headingBox = await page.locator('.deck-section[data-drop-level="focus"] .section-heading').boundingBox();
  const titleBox = await page.locator('.deck-section[data-drop-level="focus"] .section-title').boundingBox();
  const countBox = await page.locator('.deck-section[data-drop-level="focus"] .section-count').boundingBox();
  expect(headingBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(countBox).not.toBeNull();
  expect(countBox!.x - (titleBox!.x + titleBox!.width)).toBeLessThan(12);
});

test("executes only allowlisted thread links at the click boundary", async ({ page }) => {
  const root = page.locator("#app");
  const initialUrl = page.url();
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  const unsafeDestinations = [
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "jav%61script:alert(1)",
    "unknown://thread/1",
    "javascript:alert(1)",
    "data:text/html,boom",
    "file:///tmp/never-open",
  ];
  for (const destination of unsafeDestinations) {
    const open = page.locator(".now-card .primary-action");
    const permittedDestination = await open.getAttribute("data-open-thread");
    await open.evaluate((element, value) => element.setAttribute("data-open-thread", value as string), destination);
    await open.click();
    await expect(page).toHaveURL(initialUrl);
    await expect(root).not.toHaveAttribute("data-last-opened-thread");
    await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
    // Wait for the guarded error render to replace the dynamic anchor before the next payload.
    await expect(open).toHaveAttribute("data-open-thread", permittedDestination!);
  }
  expect(navigations).toEqual([]);

  const safe = page.locator('.running-row[data-thread-id="windsurf:available-2"] a').first();
  await expect(safe).toHaveAttribute("href", "https://example.invalid/thread/available-2");
  await safe.click();
  await expect(root).toHaveAttribute("data-last-opened-thread", "https://example.invalid/thread/available-2");
});

test("uses host navigation and surfaces rejected links without navigating the iframe", async ({ page }) => {
  await page.addInitScript(() => {
    const thread = {
      id: "codex:thread-1",
      sourceId: "codex",
      sourceName: "Codex host mock",
      title: "Host fallback thread",
      project: "host-test",
      updatedAt: 1_786_545_400,
      status: "idle",
      level: "focus",
      isCurrent: true,
      context: null,
      deepLink: "codex://threads/thread-1",
      allowedDeepLinkSchemes: ["codex"],
      review: {
        state: "ready",
        kind: "result",
        updatedAt: 1_786_545_400,
        destination: { type: "thread", deepLink: "codex://threads/review-1" },
        providerStatus: "completed",
      },
    };
    const otherThread = {
      ...thread,
      id: "codex:thread-2",
      title: "Other Codex thread",
      level: null,
      isCurrent: false,
      deepLink: "codex://threads/thread-2",
      review: undefined,
    };
    const snapshot = {
      generatedAt: "2026-08-18T00:00:00.000Z",
      revision: 1,
      current: thread,
      focus: [thread],
      important: [],
      available: [otherThread],
      collapsed: { focus: false, important: false },
      focusGuide: 5,
      focusOverGuide: false,
      staleEntryCount: 0,
      source: "gajendra-registry",
      sources: [{ id: "codex", name: "Codex host mock", kind: "configured", state: "ready", enabled: true, threadCount: 2, detail: null }],
      error: null,
    };
    const snapshots = {
      baseline: snapshot,
      notReady: {
        ...snapshot,
        revision: 2,
        current: { ...thread, review: undefined },
        focus: [{ ...thread, review: undefined }],
      },
      running: {
        ...snapshot,
        revision: 3,
        current: { ...thread, status: "active" },
        focus: [{ ...thread, status: "active" }],
      },
      changedDestination: {
        ...snapshot,
        revision: 4,
        current: { ...thread, review: { ...thread.review, destination: { type: "thread", deepLink: "codex://threads/review-2" } } },
        focus: [{ ...thread, review: { ...thread.review, destination: { type: "thread", deepLink: "codex://threads/review-2" } } }],
      },
      missing: { ...snapshot, revision: 5, current: null, focus: [], available: [otherThread] },
    };
    const state = {
      openLinkMode: "is-error" as "is-error" | "throw",
      throwAssign: false,
      openLinks: [] as string[],
      openLinkModes: [] as string[],
      navigations: [] as string[],
      navigationModes: [] as string[],
      publish: null as null | ((kind: keyof typeof snapshots) => void),
    };
    const hostApp = {
      addEventListener: () => undefined,
      connect: async () => { hostApp.ontoolresult?.({ structuredContent: snapshot }); },
      getHostContext: () => ({ theme: "light" }),
      callServerTool: async (request: { name: string }) => ({
        structuredContent: request.name === "gajendra_open" ? snapshot : snapshot,
      }),
      openLink: async ({ url }: { url: string }) => {
        state.openLinks.push(url);
        state.openLinkModes.push(state.openLinkMode);
        if (state.openLinkMode === "throw") throw new Error("Host openLink failed.");
        return { isError: true };
      },
      ontoolresult: undefined as undefined | ((result: { structuredContent: unknown }) => void),
    };
    let publishedRevision = snapshot.revision;
    state.publish = (kind) => hostApp.ontoolresult?.({ structuredContent: { ...snapshots[kind], revision: ++publishedRevision } });
    const testWindow = window as Window & {
      __gajendraHostTest?: unknown;
      __gajendraHostTestState?: typeof state;
    };
    testWindow.__gajendraHostTestState = state;
    testWindow.__gajendraHostTest = {
      createApp: () => hostApp,
      navigate: (url: string) => {
        state.navigations.push(url);
        state.navigationModes.push(state.openLinkMode);
        if (state.throwAssign) throw new Error("Native navigation failed.");
      },
    };
  });
  await page.goto("/gajendra.html?host-test=1");
  const root = page.locator("#app");
  const open = page.locator(".now-card .primary-action");
  const reviewOpen = page.locator(".review-row .review-primary");
  await expect(open).toHaveAttribute("href", "codex://threads/thread-1");
  await expect(open).toHaveAttribute("data-open-route", "thread");
  await expect(reviewOpen).toHaveAttribute("href", "codex://threads/review-1");
  await expect(reviewOpen).toHaveAttribute("data-open-route", "review");

  const publishSnapshot = async (kind: "baseline" | "notReady" | "running" | "changedDestination" | "missing") => {
    await page.evaluate((next) => {
      const testWindow = window as Window & {
        __gajendraHostTestState?: { publish: null | ((kind: "baseline" | "notReady" | "running" | "changedDestination" | "missing") => void) };
      };
      const publish = testWindow.__gajendraHostTestState?.publish;
      if (!publish) throw new Error("Host snapshot publisher is unavailable.");
      publish(next);
    }, kind);
  };

  // A retained element must not use its old render-time permission after current evidence changes.
  for (const mutation of ["notReady", "running", "changedDestination", "missing"] as const) {
    await publishSnapshot("baseline");
    await expect(reviewOpen).toHaveAttribute("href", "codex://threads/review-1");
    await reviewOpen.evaluate((element, kind) => {
      const state = (window as unknown as { __gajendraHostTestState: { publish(kind: string): void } }).__gajendraHostTestState;
      state.publish(kind);
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    }, mutation);
    await expect(root.getByRole("alert")).toContainText("blocked an unsafe thread destination");
    await expect.poll(() => page.evaluate(() => {
      const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
      return testWindow.__gajendraHostTestState;
    })).toMatchObject({ openLinks: [], navigations: [] });
  }
  await publishSnapshot("baseline");
  await expect(reviewOpen).toHaveAttribute("href", "codex://threads/review-1");

  // Even a coupled substitution to another valid, allowlisted Codex row cannot replace the
  // listener's render-time authority.
  await open.evaluate((element) => {
    element.setAttribute("data-open-thread-id", "codex:thread-2");
    element.setAttribute("data-open-route", "thread");
    element.setAttribute("data-open-thread", "codex://threads/thread-2");
    element.setAttribute("href", "codex://threads/thread-2");
  });
  await open.click();
  await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
  await expect(open).toHaveAttribute("data-open-thread-id", "codex:thread-1");
  await expect(open).toHaveAttribute("data-open-route", "thread");
  await expect(open).toHaveAttribute("data-open-thread", "codex://threads/thread-1");

  // Individual same-scheme and route-intent mutations remain blocked too.
  await open.evaluate((element) => element.setAttribute("data-open-thread", "codex://threads/thread-2"));
  await open.click();
  await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
  await expect(open).toHaveAttribute("data-open-thread", "codex://threads/thread-1");

  await reviewOpen.evaluate((element) => element.setAttribute("data-open-route", "thread"));
  await reviewOpen.click();
  await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
  await expect(reviewOpen).toHaveAttribute("data-open-route", "review");

  await open.evaluate((element) => element.setAttribute("data-open-thread-id", "codex:thread-2"));
  await open.click();
  await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
  await expect(open).toHaveAttribute("data-open-thread-id", "codex:thread-1");

  for (const unsafe of [
    " javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "jav%61script:alert(1)",
    "unknown://thread/1",
    "data:text/html,boom",
    "file:///tmp/never-open",
  ]) {
    await open.evaluate((element, value) => element.setAttribute("data-open-thread", value as string), unsafe);
    await open.click();
    await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
    // Wait for the error render to rebuild this dynamic locator before the next hostile click.
    await expect(open).toHaveAttribute("data-open-thread", "codex://threads/thread-1");
  }
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return testWindow.__gajendraHostTestState;
  })).toMatchObject({ openLinks: [], navigations: [] });

  await open.evaluate((element) => element.setAttribute("data-open-thread", "codex://threads/thread-1"));
  const dispatchedBeforeAnimationTick = await open.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    return (window as unknown as { __gajendraHostTestState: { openLinks: string[] } }).__gajendraHostTestState.openLinks;
  });
  expect(dispatchedBeforeAnimationTick).toEqual(["codex://threads/thread-1"]);
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return testWindow.__gajendraHostTestState;
  })).toMatchObject({
    openLinks: ["codex://threads/thread-1"],
    navigations: [],
  });

  await page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinkMode: "is-error" | "throw"; throwAssign: boolean } };
    if (!testWindow.__gajendraHostTestState) throw new Error("Host test state is unavailable.");
    testWindow.__gajendraHostTestState.openLinkMode = "throw";
  });
  await open.click();
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as Window & {
      __gajendraHostTestState?: { openLinks: string[]; openLinkModes: string[]; navigations: string[]; navigationModes: string[] };
    };
    const state = testWindow.__gajendraHostTestState;
    return state && {
      openLinks: state.openLinks.length,
      openLinkModes: state.openLinkModes,
      navigations: state.navigations.length,
      navigationModes: state.navigationModes,
    };
  })).toMatchObject({
    openLinks: expect.any(Number),
    openLinkModes: expect.arrayContaining(["is-error", "throw"]),
    navigations: expect.any(Number),
    navigationModes: [],
  });
  const fallbackCounts = await page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return {
      openLinks: testWindow.__gajendraHostTestState?.openLinks.length ?? 0,
      navigations: testWindow.__gajendraHostTestState?.navigations.length ?? 0,
    };
  });
  expect(fallbackCounts.openLinks).toBeGreaterThanOrEqual(2);
  expect(fallbackCounts.navigations).toBe(0);

  await page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { throwAssign: boolean } };
    if (!testWindow.__gajendraHostTestState) throw new Error("Host test state is unavailable.");
    testWindow.__gajendraHostTestState.throwAssign = true;
  });
  await open.click();
  await expect(root.getByRole("alert")).toContainText("The host could not open this thread in Codex host mock.");
});

test("assigns bounded context labels without changing NOW or provider resume", async ({ page }) => {
  const row = page.locator('.thread-row[data-thread-id^="claude:"]');
  const provider = row.locator('.source-badge[data-source-id="claude"]');
  const contextSelect = row.getByRole("combobox", { name: /Context for Review the multi-agent adapter contract/ });
  const href = await provider.getAttribute("href");
  await expect(row.locator(".context-badge")).toHaveText("Engineering");
  await openRowActions(row);
  await expect(contextSelect).toHaveValue("engineering");
  await expect(contextSelect).toBeVisible();
  await expect(contextSelect.locator("option")).toHaveText(["Context", "Design", "Engineering", "Life"]);
  await contextSelect.selectOption("design");
  await expect(row.locator(".context-badge")).toHaveText("Design");
  await expect(provider).toHaveAttribute("href", href!);
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator(".now-card .context-badge")).toHaveText("Design");
});

test("includes prioritized and unprioritized active work while retaining priority actions", async ({ page }) => {
  const running = page.locator(".running-section");
  const runningToggle = running.locator("[data-running-toggle]");
  await expect(runningToggle).toHaveAttribute("aria-expanded", "true");
  await expect(runningToggle).toContainText("Running");
  await expect(running.locator(".running-row")).toHaveCount(4);
  await expect(running).toContainText("Ship the Gajendra source release");
  const runningNow = running.locator('.running-row[data-thread-id="codex:00000000-0000-7000-8000-000000000001"]');
  await expect(runningNow.locator(".placement-badge")).toHaveText("NOW");
  await expect(runningNow.getByRole("button", { name: "Important" })).toHaveCount(0);
  await expect(runningNow.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(running).toContainText("Investigate the CI performance regression");
  await expect(page.locator('#available-list .available-row[data-thread-id="windsurf:available-2"]')).toBeHidden();

  await runningToggle.click();
  await expect(runningToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#running-list")).toBeHidden();
  await expect(page.locator(".thread-search-footer")).toBeVisible();

  const secondFocus = page.locator('.thread-row[data-thread-id^="claude:"]');
  const firstFocus = page.locator("#focus-list .thread-row").first();
  await secondFocus.evaluate((source, targetId) => {
    const target = document.querySelector<HTMLElement>(`.thread-row[data-thread-id="${targetId}"]`);
    if (!target) throw new Error("Synthetic drag target is unavailable.");
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  }, await firstFocus.getAttribute("data-thread-id"));
  await expect(page.locator("#focus-list .thread-row").first()).toContainText("Review the multi-agent adapter contract");

  const recent = page.locator('.available-row[data-thread-id="codex:available-1"]');
  await openHistory(page);
  await chooseRowAction(recent, "Important");
  await expect(page.locator("#important-list")).toContainText("Plan this week across projects");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");

  await runningToggle.click();
  await expect(page.locator("#running-list")).toBeVisible();
  const keyboardRunning = page.locator('.running-row[data-thread-id="windsurf:available-2"]');
  const keyboardFocus = keyboardRunning.getByRole("button", { name: "Focus" });
  await openRowActions(keyboardRunning);
  await keyboardFocus.focus();
  await keyboardFocus.press("Enter");
  await expect(page.locator("#focus-list")).toContainText("Investigate the CI performance regression");
});

test("discloses provider-confirmed review work with Running precedence and exact destinations", async ({ page }) => {
  const review = page.locator(".review-section");
  const toggle = review.locator("[data-review-toggle]");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const headingX = await page.locator("#review-heading").evaluate(element => element.getBoundingClientRect().x);
  expect(await page.locator("#running-heading").evaluate(element => element.getBoundingClientRect().x)).toBe(headingX);
  await expect(review.locator(".review-row")).toHaveCount(3);
  expect(await review.locator(".review-row").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-thread-id")))).toEqual([
    "review-agent:focus-review",
    "review-agent:important-review",
    "review-agent:available-review",
  ]);

  await expect(page.locator('.thread-row[data-thread-id="review-agent:focus-review"] .review-mark')).toHaveCount(0);
  await expect(page.locator('.thread-row[data-thread-id="review-agent:important-review"] .review-mark')).toHaveCount(0);
  await expect(page.locator('.now-card .review-mark, .running-row .review-done, .thread-row .review-done, #available-list .review-done')).toHaveCount(0);
  await expect(review.locator(".review-done")).toHaveCount(3);
  await expect(review.locator('.review-row[data-thread-id="review-agent:focus-review"] .placement-badge')).toHaveText("Focus");
  await expect(review.locator('.review-row[data-thread-id="review-agent:important-review"] .placement-badge')).toHaveText("Important");

  const reviewDestination = review.locator('.review-row[data-thread-id="review-agent:focus-review"] .review-primary');
  await expect(reviewDestination).toHaveAttribute("href", "https://example.invalid/reviews/focus-review");
  await reviewDestination.evaluate((element) => element.setAttribute("data-open-thread", "javascript:unsafe-review"));
  await reviewDestination.click();
  await expect(page.getByRole("alert")).toContainText("blocked an unsafe thread destination");
  await expect(reviewDestination).toHaveAttribute("data-open-thread", "https://example.invalid/reviews/focus-review");
  await reviewDestination.click();
  await expect(page.locator("#app")).toHaveAttribute("data-last-opened-thread", "https://example.invalid/reviews/focus-review");
  await expect(review.locator(".review-row")).toHaveCount(3);

  const owningTask = review.locator('.review-row[data-thread-id="review-agent:focus-review"] .source-badge');
  await owningTask.click();
  await expect(page.locator("#app")).toHaveAttribute("data-last-opened-thread", "review-agent://threads/focus-review");
  await expect(review.locator(".review-row")).toHaveCount(3);

  await review.getByRole("button", { name: "Mark Review the provider boundary patch reviewed" }).click();
  await expect(review.locator('.review-row[data-thread-id="review-agent:focus-review"]')).toHaveCount(0);
  await expect(review.locator(".review-row")).toHaveCount(2);
  await expect(review.getByRole("button", { name: "Mark Inspect the generated accessibility receipt reviewed" })).toBeFocused();
  await expect(page.locator("[data-refresh-status]")).toHaveText("Review saved");
  await expect(page.locator('.thread-row[data-thread-id="review-agent:focus-review"]')).toBeVisible();
  await expect(page.locator('.thread-row[data-thread-id="review-agent:focus-review"]')).toContainText("Review the provider boundary patch");

  const taskFallback = review.locator('.review-row[data-thread-id="review-agent:important-review"] .review-primary');
  await expect(taskFallback.locator(".review-destination-label")).toHaveCount(0);
  await expect(taskFallback).toHaveAttribute("href", "review-agent://threads/important-review");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#review-list")).toBeHidden();
  await expect(page.locator(".thread-search-footer")).toBeVisible();

  await page.locator("#task-search").fill("bounded catalog result");
  await expect(page.locator('#available-list .available-row[data-thread-id="review-agent:available-review"]')).toBeVisible();
  await expect(page.locator('#available-list .available-row[data-thread-id="review-agent:available-review"]')).toHaveCount(1);
});

test("dismisses review immediately, restores an exact failed row, and retries without finishing work", async ({ page }) => {
  await installDelayedReviewHost(page);
  const row = page.locator('.review-row[data-thread-id="review-agent:focus-review"]');
  const check = row.getByRole("button", { name: "Mark Review the provider boundary patch reviewed" });
  await expect(check).toHaveAttribute("title", "Mark reviewed");
  await expect(check.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await check.focus();
  await check.press("Enter");
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Saving review…" })).toBeVisible();
  await expect(page.locator('.review-row[data-thread-id="review-agent:important-review"] .review-done')).toBeFocused();
  await expect(page.locator('#focus-list li.thread-row[data-thread-id="review-agent:focus-review"]')).toBeVisible();
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
  await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.settle("failure"));
  await expect(row).toBeVisible();
  await expect(page.locator(".review-error")).toContainText("Connection interrupted");
  await expect(page.locator(".review-row").first()).toHaveAttribute("data-thread-id", "review-agent:focus-review");
  await page.locator(".review-error").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.keys)).toEqual(expect.arrayContaining([expect.any(String)]));
  const keys = await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.keys);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.settle("success"));
  await expect(page.locator(".review-error")).toHaveCount(0);
  await page.locator('[data-action="toggle-history"]').click();
  await page.getByRole("button", { name: "Reviewed", exact: true }).click();
  const history = page.locator('#available-list li.available-row[data-thread-id="review-agent:focus-review"]');
  await expect(history).toBeVisible();
  await expect(history.locator(".history-status")).toHaveText("Reviewed · Open");
  await expect(history).toContainText("Updated");
  await expect(history.getByRole("button", { name: "Reopen", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Finished", exact: true }).click();
  await expect(history).toBeHidden();
});

test("retains newer review evidence when an earlier review save resolves late", async ({ page }) => {
  await installDelayedReviewHost(page);
  const row = page.locator('.review-row[data-thread-id="review-agent:focus-review"]');
  await row.locator(".review-done").click();
  await expect(row).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.newer());
  await expect(row.locator(".review-done")).toHaveAttribute("data-review-identity", "e".repeat(64));
  await page.evaluate(() => (window as unknown as { __reviewControl: ReviewHostControl }).__reviewControl.settle("success"));
  await expect(page.locator(".action-receipt")).toContainText("Review saved");
  await expect(row.locator(".review-done")).toHaveAttribute("data-review-identity", "e".repeat(64));
  await expect(page.locator(".review-row")).toHaveCount(3);
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
});

test("dispatches pointer disclosure before the next animation frame", async ({ page }) => {
  const toggle = page.locator('button[data-collapse="focus"]');
  const expandedImmediately = await toggle.evaluate((element) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 }));
    return document.querySelector('button[data-collapse="focus"]')?.getAttribute("aria-expanded");
  });
  expect(expandedImmediately).toBe("false");
  // Changing the preference during feedback cannot strand the disclosure or its next action.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#focus-list")).toBeHidden();
  await toggle.click();
  await expect(page.locator("#focus-list")).toBeVisible();
});

test("collapses sections and promotes a recent task without losing the single NOW cue", async ({ page }) => {
  const focusToggle = page.locator('button[data-collapse="focus"]');
  await focusToggle.click();
  await expect(focusToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#focus-list")).toBeHidden();
  await focusToggle.click();

  await openHistory(page);
  await chooseRowAction(page.locator("#available-list .available-row", { hasText: "Plan this week across projects" }), "Focus");
  await expect(page.locator("#focus-list")).toContainText("Plan this week across projects");
  await expect(page.locator(".now-card .now-label strong")).toHaveText("NOW");
  await expect(page.locator("#focus-list .thread-row.is-current .now-pill")).toHaveCount(1);
});

test("moves the same task between Focus and Important while preserving one NOW", async ({ page }) => {
  const threadId = "claude:11111111-1111-4111-8111-111111111111";
  const focusRow = page.locator(`#focus-list .thread-row[data-thread-id="${threadId}"]`);
  await chooseRowAction(focusRow, "Important");
  const importantRow = page.locator(`#important-list .thread-row[data-thread-id="${threadId}"]`);
  await expect(importantRow).toContainText("Review the multi-agent adapter contract");

  await chooseRowAction(importantRow, "Focus");
  await expect(page.locator(`#focus-list .thread-row[data-thread-id="${threadId}"]`)).toContainText("Review the multi-agent adapter contract");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
});

test("treats a row dropped onto itself as an atomic no-op", async ({ page }) => {
  const target = page.locator('#focus-list .thread-row[data-thread-id^="claude:"]');
  const orderBefore = await page.locator("#focus-list .thread-row").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-thread-id")));

  await target.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", (element as HTMLElement).dataset.threadId ?? "");
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  });

  await expect.poll(async () => page.locator("#focus-list .thread-row").evaluateAll((rows) => rows.map((row) => row.getAttribute("data-thread-id")))).toEqual(orderBefore);
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
});

test("reorders work and keeps the visible deck stable through passive refresh", async ({ page }) => {
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "enabled");
  const focusRows = page.locator("#focus-list .thread-row");
  await expect(focusRows.first()).toContainText("Ship the Gajendra source release");
  await chooseRowAction(focusRows.filter({ hasText: "Review the multi-agent adapter contract" }), "Move task up");
  await expect(focusRows.first()).toContainText("Review the multi-agent adapter contract");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");

  const refresh = page.getByRole("button", { name: "Refresh Gajendra" });
  await refresh.click();
  await expect(page.getByRole("heading", { name: "Gajendra", exact: true })).toBeVisible();
  await expect(refresh).toContainText("Refresh");
  await expect(page.locator("#app")).not.toHaveAttribute("aria-busy", "true");
});

test("removes motion when the system requests reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "reduced");
  const importantToggle = page.locator('button[data-collapse="important"]');
  await importantToggle.click();
  await expect(page.locator("#important-list")).toBeHidden();
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
});

test("searches every thread and exposes organizer actions by keyboard", async ({ page }) => {
  const searchFooter = page.locator(".thread-search-footer");
  const search = page.getByRole("searchbox", { name: "Search all 11 threads" });
  await expect(searchFooter).toBeVisible();
  await expect(search).toHaveAttribute("placeholder", "Search all 11 threads");
  const footerBeforeScroll = await searchFooter.boundingBox();
  await page.locator(".deck-scroll-surface").evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const footerAfterScroll = await searchFooter.boundingBox();
  expect(footerBeforeScroll).not.toBeNull();
  expect(footerAfterScroll).not.toBeNull();
  expect(Math.abs(footerBeforeScroll!.y - footerAfterScroll!.y)).toBeLessThan(2);
  await searchFooter.click({ position: { x: 6, y: 6 } });
  await expect(search).toBeFocused();
  await page.keyboard.type("gajendra codex active");
  await expect(page.locator("[data-search-status]")).toHaveText("1 match");
  for (const [query, threadId] of [
    ["Ready", "review-agent:focus-review"],
    ["Running", "cursor:running-3"],
    ["provider codex", "codex:00000000-0000-7000-8000-000000000001"],
    ["project gajendra", "codex:00000000-0000-7000-8000-000000000001"],
    ["context design", "codex:00000000-0000-7000-8000-000000000001"],
    ["tag design", "codex:00000000-0000-7000-8000-000000000001"],
    ["label design", "codex:00000000-0000-7000-8000-000000000001"],
  ] as Array<[string, string]>) {
    await search.fill(query);
    await expect(page.locator(`#available-list .available-row[data-thread-id="${threadId}"]`)).toBeVisible();
  }
  await search.fill("gajendra codex active");
  await search.blur();
  await searchFooter.click({ position: { x: 6, y: 6 } });
  await expect(search).toBeFocused();
  await expect.poll(() => search.evaluate((element) => {
    const input = element as HTMLInputElement;
    return [input.selectionStart, input.selectionEnd];
  })).toEqual([0, 21]);
  const prioritizedMatch = page.locator('#available-list .available-row[data-thread-id="codex:00000000-0000-7000-8000-000000000001"]');
  await expect(prioritizedMatch).toBeVisible();
  await expect(prioritizedMatch.locator(".placement-badge")).toHaveText("NOW");
  await expect(prioritizedMatch.getByRole("button", { name: "Important" })).toHaveCount(0);
  await expect(prioritizedMatch.getByRole("button", { name: "Remove" })).toHaveCount(0);
  const importantIdsBefore = await page.locator("#important-list .thread-row").evaluateAll((rows) =>
    rows.map((row) => (row as HTMLElement).dataset.threadId),
  );
  await prioritizedMatch.evaluate((source) => {
    const target = document.querySelector<HTMLElement>("#important-list .thread-row");
    if (!target) throw new Error("Synthetic Important drag target is unavailable.");
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.locator("#focus-list .thread-row.is-current")).toContainText("Ship the Gajendra source release");
  await expect(page.locator("#important-list .thread-row")).toHaveCount(importantIdsBefore.length);
  expect(await page.locator("#important-list .thread-row").evaluateAll((rows) =>
    rows.map((row) => (row as HTMLElement).dataset.threadId),
  )).toEqual(importantIdsBefore);
  await expect(page.locator('#available-list .available-row[data-thread-id="codex:available-1"]')).toBeHidden();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("keeps one selected NOW task after sequential Codex-style selections", async ({ page }) => {
  await chooseRowAction(page.locator('.thread-row[data-thread-id^="claude:"]'), "Make Now");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator("#focus-list .thread-row.is-current")).toContainText("Review the multi-agent adapter contract");

  await chooseRowAction(page.locator('.thread-row[data-thread-id^="codex:"]'), "Make Now");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator("#focus-list .thread-row.is-current")).toContainText("Ship the Gajendra source release");
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
});

test("passes automated accessibility checks in expanded and collapsed states", async ({ page }) => {
  const expanded = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(expanded.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);

  await page.locator('button[data-collapse="important"]').click();
  await expect(page.locator("#important-list")).toBeHidden();
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
  const collapsed = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(collapsed.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);

  await page.getByRole("button", { name: "Open Gajendra settings" }).click();
  for (const [theme, appearance] of [["Native", "Light"], ["Native", "Dark"], ["Focus Deck", "Light"], ["Focus Deck", "Dark"]] as const) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.getByRole("button", { name: appearance, exact: true }).click();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")), `${theme} ${appearance}`).toEqual([]);
  }
});

test("reflows without horizontal overflow and records light, dark, and forced-color evidence", async ({ page }) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-light.png"), fullPage: true });

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-dark-reduced-motion.png"), fullPage: true });

  await page.getByRole("button", { name: "Open Gajendra settings" }).click();
  await page.getByRole("button", { name: "Focus Deck", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-focus-deck-dark.png"), fullPage: true });

  await page.emulateMedia({ forcedColors: "active" });
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-forced-colors.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light", forcedColors: "none", reducedMotion: "no-preference" });
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBe(false);
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-compact.png"), fullPage: true });

  await page.getByRole("button", { name: "Focus Deck", exact: true }).click();
  const focusDeckOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(focusDeckOverflow).toBe(false);
});


test("finishes and reopens work explicitly while Undo restores the selected NOW", async ({ page }) => {
  const id = "codex:00000000-0000-7000-8000-000000000001";
  const now = page.locator(".now-card");
  await chooseRowAction(now, "Finish work");
  await expect(page.locator(".now-empty")).toBeVisible();
  await expect(page.locator(`#focus-list .thread-row[data-thread-id="${id}"]`)).toHaveCount(0);
  await openHistory(page);
  const finished = page.locator(`#available-list .available-row[data-thread-id="${id}"]`);
  await expect(finished.locator(".history-status")).toContainText("Finished");
  await expect(page.locator(".review-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(now).toContainText("Ship the Gajendra source release");
  await expect(page.locator("#focus-list .is-current")).toHaveCount(1);
  await chooseRowAction(now, "Finish work");
  await openHistory(page);
  await chooseRowAction(finished, "Reopen");
  await expect(page.locator(`#focus-list .thread-row[data-thread-id="${id}"]`)).toBeVisible();
  await expect(page.locator(".now-empty")).toBeVisible();
  await expect(page.locator("#focus-list .is-current")).toHaveCount(0);
});

test("links the chosen exact continuation and keeps the earlier chat inspectable", async ({ page }) => {
  const predecessor = "codex:00000000-0000-7000-8000-000000000001";
  const successor = "codex:available-1";
  await chooseRowAction(page.locator(".now-card"), "Link next chat…");
  const picker = page.getByRole("region", { name: "Choose the next chat" });
  const search = picker.getByRole("searchbox", { name: "Find a chat" });
  await expect(search).toBeFocused();
  await expect(picker.locator('[data-action="confirm-link"]:visible')).toHaveCount(0);
  await search.fill("Plan this week");
  const choice = picker.locator(`[data-action="confirm-link"][data-next-thread-id="${successor}"]`);
  await expect(choice).toBeVisible();
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
  await choice.click();
  await expect(picker).toHaveCount(0);
  await expect(page.locator(".now-card")).toContainText("Plan this week across projects");
  await expect(page.locator(".now-card .primary-action")).toHaveAttribute("href", "codex://threads/available-1");
  await expect(page.locator(".now-card .context-badge")).toHaveText("Design");
  const continued = page.locator(`#focus-list .thread-row[data-thread-id="${successor}"]`);
  await expect(continued.locator(".now-pill")).toHaveText("NOW");
  await continued.locator(".chat-history > summary").click();
  const earlier = continued.locator(".chat-history a");
  await expect(earlier).toHaveAttribute("href", `codex://threads/${predecessor.slice(6)}`);
  await earlier.click();
  await expect(page.locator("#app")).toHaveAttribute("data-last-opened-thread", `codex://threads/${predecessor.slice(6)}`);
  await expect(page.locator(".now-card")).toContainText("Plan this week across projects");
  await openHistory(page);
  await chooseRowAction(page.locator(`#available-list .available-row[data-thread-id="${predecessor}"]`), "Unlink next chat");
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");
  await expect(page.locator("#focus-list .is-current")).toHaveCount(1);
});

test("syncs revisions and activity epochs without rescanning or moving an unchanged view", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript((initial) => {
    const state = { scans: 0, syncs: 0, revision: initial.revision, activityRevision: undefined as string | undefined };
    const current = () => ({ ...initial, revision: state.revision, activityRevision: state.activityRevision });
    const host = {
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => { host.ontoolresult?.({ structuredContent: current() }); },
      callServerTool: async ({ name }: { name: string }) => {
        if (name === "gajendra_sync") {
          state.syncs += 1;
          return { structuredContent: { revision: state.revision, activityRevision: state.activityRevision } };
        }
        state.scans += 1;
        return { structuredContent: current() };
      },
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __syncState: state,
      __publishPassive: () => host.ontoolresult?.({ structuredContent: current() }) });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  const row = page.locator('#focus-list .thread-row[data-thread-id^="claude:"]');
  await openRowActions(row);
  const viewBefore = await page.locator(".deck-scroll-surface").evaluate((element) => element.scrollTop);
  await page.evaluate(() => (window as unknown as { __publishPassive(): void }).__publishPassive());
  await expect(row.locator("details.row-menu")).toHaveAttribute("open", "");
  expect(await page.locator(".deck-scroll-surface").evaluate((element) => element.scrollTop)).toBe(viewBefore);
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
  await page.clock.fastForward(5_000);
  const counts = () => page.evaluate(() => (window as unknown as { __syncState: { scans: number; syncs: number } }).__syncState);
  await expect.poll(counts).toMatchObject({ scans: 0, syncs: 1 });
  await page.evaluate(() => { (window as unknown as { __syncState: { revision: number } }).__syncState.revision += 1; });
  await page.clock.fastForward(5_000);
  await expect.poll(counts).toMatchObject({ scans: 1, syncs: 2 });
  await page.clock.fastForward(5_000);
  await expect.poll(counts).toMatchObject({ scans: 1, syncs: 3 });
  await page.evaluate(() => { (window as unknown as { __syncState: { activityRevision: string } }).__syncState.activityRevision = "synthetic-provider-epoch"; });
  await page.clock.fastForward(5_000);
  await expect.poll(counts).toMatchObject({ scans: 2, syncs: 4 });
  await expect(row.locator("details.row-menu")).toHaveAttribute("open", "");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
});

test("does not undo another client's newer work decision", async ({ page }) => {
  await page.addInitScript((initial) => {
    let current = structuredClone(initial);
    const host = {
      addEventListener: () => undefined,
      getHostContext: () => ({ theme: "light" }),
      ontoolresult: undefined as undefined | ((value: { structuredContent: unknown }) => void),
      connect: async () => host.ontoolresult?.({ structuredContent: current }),
      callServerTool: async ({ name, arguments: args }: { name: string; arguments: Record<string, unknown> }) => {
        if (name === "gajendra_set_work_completed") {
          current = { ...current, revision: current.revision + 1, current: null,
            focus: current.focus.map(thread => thread.id === args.threadId ? { ...thread, workState: "completed", isCurrent: false } : thread) };
          return { structuredContent: { protocolVersion: 1, outcome: "applied", revision: current.revision, snapshot: current } };
        }
        return { structuredContent: name === "gajendra_sync" ? { revision: current.revision } : current };
      },
    };
    Object.assign(window, { __gajendraHostTest: { createApp: () => host }, __newerWorkDecision: () => {
      current = { ...current, revision: current.revision + 1 };
      host.ontoolresult?.({ structuredContent: current });
    } });
  }, fixtureSnapshot);
  await page.goto("/gajendra.html?host-test=1");
  await chooseRowAction(page.locator(".now-card"), "Finish work");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __newerWorkDecision(): void }).__newerWorkDecision());
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
  await expect(page.locator(".now-empty")).toBeVisible();
});
