import { mkdir } from "node:fs/promises";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const evidenceDirectory = path.resolve(process.cwd(), "../../evidence/gauntlet");

test.beforeEach(async ({ page }) => {
  await page.goto("/gajendra.html?fixture=1");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
});

test("makes one current thread unmistakable and returns to its native provider destination", async ({ page }) => {
  await expect(page.locator("html")).toHaveAttribute("data-gaja-theme", "native");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("heading", { name: "One clear focus across your AI tools." })).toBeVisible();
  await expect(page.locator(".lede")).toHaveText("One NOW. One short queue. One click back to the exact thread.");
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
    "source-badge",
  ]);

  const contentBox = await now.locator(".now-content").boundingBox();
  const titleBox = await now.getByRole("heading", { name: "Ship the Gajendra source release" }).boundingBox();
  const openBox = await open.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(openBox).not.toBeNull();
  expect(openBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
  expect(Math.abs(openBox!.y + openBox!.height / 2 - (contentBox!.y + contentBox!.height / 2))).toBeLessThan(3);

  const beforeHover = await now.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderColor,
  }));
  await now.hover();
  const afterHover = await now.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderColor,
  }));
  expect(afterHover).not.toEqual(beforeHover);
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
    // The guarded boundary follows the press animation. Wait for its error render to replace the
    // dynamic anchor before moving to the next hostile payload, avoiding stale click handlers.
    await expect(open).toHaveAttribute("data-open-thread", permittedDestination!);
  }
  expect(navigations).toEqual([]);

  const safe = page.locator('.running-row[data-thread-id="windsurf:available-2"] a').first();
  await expect(safe).toHaveAttribute("href", "https://example.invalid/thread/available-2");
  await safe.click();
  await expect(root).toHaveAttribute("data-last-opened-thread", "https://example.invalid/thread/available-2");
});

test("uses the real host openLink fallback and surfaces a failed native navigation", async ({ page }) => {
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
      connect: async () => undefined,
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
    state.publish = (kind) => hostApp.ontoolresult?.({ structuredContent: snapshots[kind] });
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

  // The pressed element may be stale by the time its acknowledgement animation ends. Every
  // material snapshot change must cancel that in-flight review navigation at the final boundary.
  for (const mutation of ["notReady", "running", "changedDestination", "missing"] as const) {
    await publishSnapshot("baseline");
    await expect(reviewOpen).toHaveAttribute("href", "codex://threads/review-1");
    await expect(root).toHaveAttribute("data-motion-state", "idle");
    const press = reviewOpen.click();
    await expect(root).toHaveAttribute("data-motion-state", "animating");
    await publishSnapshot(mutation);
    await press;
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
    // Opening animates before the guarded boundary runs. Wait for its error render to rebuild
    // this dynamic locator before issuing the next hostile click, rather than racing six stale
    // handlers against the one permitted-fallback assertion below.
    await expect(open).toHaveAttribute("data-open-thread", "codex://threads/thread-1");
  }
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return testWindow.__gajendraHostTestState;
  })).toMatchObject({ openLinks: [], navigations: [] });

  await open.evaluate((element) => element.setAttribute("data-open-thread", "codex://threads/thread-1"));
  await open.click();
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return testWindow.__gajendraHostTestState;
  })).toMatchObject({
    openLinks: ["codex://threads/thread-1"],
    navigations: ["codex://threads/thread-1"],
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
    navigationModes: expect.arrayContaining(["is-error", "throw"]),
  });
  const fallbackCounts = await page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { openLinks: string[]; navigations: string[] } };
    return {
      openLinks: testWindow.__gajendraHostTestState?.openLinks.length ?? 0,
      navigations: testWindow.__gajendraHostTestState?.navigations.length ?? 0,
    };
  });
  expect(fallbackCounts.openLinks).toBeGreaterThanOrEqual(2);
  expect(fallbackCounts.navigations).toBeGreaterThanOrEqual(2);

  await page.evaluate(() => {
    const testWindow = window as Window & { __gajendraHostTestState?: { throwAssign: boolean } };
    if (!testWindow.__gajendraHostTestState) throw new Error("Host test state is unavailable.");
    testWindow.__gajendraHostTestState.throwAssign = true;
  });
  await open.click();
  await expect(root.getByRole("alert")).toContainText("Native navigation failed.");
});

test("assigns bounded context labels without changing NOW or provider resume", async ({ page }) => {
  const row = page.locator('.thread-row[data-thread-id^="claude:"]');
  const provider = row.locator('.source-badge[data-source-id="claude"]');
  const contextSelect = row.getByRole("combobox", { name: /Context for Review the multi-agent adapter contract/ });
  const href = await provider.getAttribute("href");
  await expect(row.locator(".context-badge")).toHaveText("Engineering");
  await expect(contextSelect).toHaveValue("engineering");
  expect((await contextSelect.boundingBox())?.width).toBeGreaterThanOrEqual(118);
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
  await expect(running.locator(".running-scope")).toContainText("All priority lanes");
  await expect(running.locator(".running-scope")).toHaveCSS("border-top-style", "solid");
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
  await recent.getByRole("button", { name: "Important" }).click();
  await expect(page.locator("#important-list")).toContainText("Plan this week across projects");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator(".now-card")).toContainText("Ship the Gajendra source release");

  await runningToggle.click();
  await expect(page.locator("#running-list")).toBeVisible();
  const keyboardRunning = page.locator('.running-row[data-thread-id="windsurf:available-2"]');
  const keyboardFocus = keyboardRunning.getByRole("button", { name: "Focus" });
  await keyboardFocus.focus();
  await keyboardFocus.press("Enter");
  await expect(page.locator("#focus-list")).toContainText("Investigate the CI performance regression");
});

test("discloses provider-confirmed review work with Running precedence and exact destinations", async ({ page }) => {
  const review = page.locator(".review-section");
  const toggle = review.locator("[data-review-toggle]");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(review.locator(".review-scope")).toContainText("Needs your review");
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
  await expect(page.locator("[data-refresh-status]")).toHaveText("Marked reviewed");
  await expect(page.locator('.thread-row[data-thread-id="review-agent:focus-review"]')).toBeVisible();
  await expect(page.locator('.thread-row[data-thread-id="review-agent:focus-review"]')).toContainText("Review the provider boundary patch");

  const taskFallback = review.locator('.review-row[data-thread-id="review-agent:important-review"] .review-primary');
  await expect(taskFallback).toContainText("Task");
  await expect(taskFallback).toHaveAttribute("href", "review-agent://threads/important-review");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#review-list")).toBeHidden();
  await expect(page.locator(".thread-search-footer")).toBeVisible();

  await page.locator("#task-search").fill("bounded catalog result");
  await expect(page.locator('#available-list .available-row[data-thread-id="review-agent:available-review"]')).toBeVisible();
  await expect(page.locator('#available-list .available-row[data-thread-id="review-agent:available-review"]')).toHaveCount(1);
});

test("collapses sections and promotes a recent task without losing the single NOW cue", async ({ page }) => {
  const focusToggle = page.locator('button[data-collapse="focus"]');
  await focusToggle.click();
  await expect(focusToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#focus-list")).toBeHidden();
  await focusToggle.click();

  await page.locator(".available-row", { hasText: "Plan this week across projects" }).getByRole("button", { name: "Focus" }).click();
  await expect(page.locator("#focus-list")).toContainText("Plan this week across projects");
  await expect(page.locator(".now-card .now-label strong")).toHaveText("NOW");
  await expect(page.locator("#focus-list .thread-row.is-current .now-pill")).toHaveCount(1);
});

test("moves the same task between Focus and Important while preserving one NOW", async ({ page }) => {
  const threadId = "claude:11111111-1111-4111-8111-111111111111";
  const focusRow = page.locator(`#focus-list .thread-row[data-thread-id="${threadId}"]`);
  await focusRow.getByRole("button", { name: "Important" }).click();
  const importantRow = page.locator(`#important-list .thread-row[data-thread-id="${threadId}"]`);
  await expect(importantRow).toContainText("Review the multi-agent adapter contract");

  await importantRow.getByRole("button", { name: "Focus" }).click();
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

test("animates row ordering and refreshes without replacing the visible deck", async ({ page }) => {
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "enabled");
  const focusRows = page.locator("#focus-list .thread-row");
  await expect(focusRows.first()).toContainText("Ship the Gajendra source release");
  await focusRows.filter({ hasText: "Review the multi-agent adapter contract" }).getByRole("button", { name: "Move task up" }).click();
  await expect(focusRows.first()).toContainText("Review the multi-agent adapter contract");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");

  const refresh = page.getByRole("button", { name: "Refresh Gajendra" });
  await refresh.click();
  await expect(page.getByRole("heading", { name: "One clear focus across your AI tools." })).toBeVisible();
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
  const initialBorder = await searchFooter.evaluate((element) => getComputedStyle(element).borderColor);
  await searchFooter.hover();
  const hoverBorder = await searchFooter.evaluate((element) => getComputedStyle(element).borderColor);
  expect(hoverBorder).not.toBe(initialBorder);
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
  await page.locator('.thread-row[data-thread-id^="claude:"]').getByRole("button", { name: "Make Now" }).click();
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator("#focus-list .thread-row.is-current")).toContainText("Review the multi-agent adapter contract");

  await page.locator('.thread-row[data-thread-id^="codex:"]').getByRole("button", { name: "Make Now" }).click();
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
  await expect(page.locator(".thread-heading-line > a").first()).toHaveCSS("color", "rgb(245, 245, 247)");
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
