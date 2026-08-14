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
  await expect(page.getByRole("heading", { name: "What deserves your attention now?" })).toBeVisible();
  const now = page.locator(".now-card");
  await expect(now.getByText("NOW", { exact: true })).toBeVisible();
  const open = now.getByRole("link", { name: /Open thread/ });
  await expect(open).toHaveAttribute("href", /^codex:\/\/threads\//u);
  await expect(open).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".thread-row.is-current .now-pill")).toHaveText("NOW");

  const contentBox = await now.locator(".now-content").boundingBox();
  const titleBox = await now.getByRole("heading", { name: "Ship the Gaja source release" }).boundingBox();
  const openBox = await open.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(openBox).not.toBeNull();
  expect(openBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
  expect(Math.abs(openBox!.y + openBox!.height / 2 - (contentBox!.y + contentBox!.height / 2))).toBeLessThan(3);
});

test("switches and persists exactly Native Popover and Focus Deck across light, dark, and auto", async ({ page }) => {
  const native = page.getByRole("button", { name: "Native", exact: true });
  const focusDeck = page.getByRole("button", { name: "Focus Deck", exact: true });
  await expect(native).toHaveAttribute("aria-pressed", "true");
  await focusDeck.click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-gaja-theme", "focus-deck");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
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

test("drags recent threads into priority lanes while retaining keyboard actions", async ({ page }) => {
  const secondFocus = page.locator('.thread-row[data-thread-id^="claude:"]');
  const firstFocus = page.locator("#focus-list .thread-row").first();
  await secondFocus.locator(".thread-main").dragTo(firstFocus.locator(".thread-main"));
  await expect(page.locator("#focus-list .thread-row").first()).toContainText("Review the multi-agent adapter contract");

  const recent = page.locator('.available-row[data-thread-id="codex:available-1"]');
  await recent.dragTo(page.locator('.deck-section[data-drop-level="important"]'));
  await expect(page.locator("#important-list")).toContainText("Plan this week across projects");
  await expect(page.locator("#focus-list .thread-row.is-current")).toHaveCount(1);
  await expect(page.locator(".now-card")).toContainText("Ship the Gaja source release");

  const keyboardRecent = page.locator('.available-row[data-thread-id="windsurf:available-2"]');
  const keyboardFocus = keyboardRecent.getByRole("button", { name: "Focus ✦✦" });
  await keyboardFocus.focus();
  await keyboardFocus.press("Enter");
  await expect(page.locator("#focus-list")).toContainText("Investigate the CI performance regression");
});

test("collapses sections and promotes a recent task without losing the single NOW cue", async ({ page }) => {
  const focusToggle = page.getByRole("button", { name: /Double-star focus/ });
  await focusToggle.click();
  await expect(focusToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#focus-list")).toBeHidden();
  await focusToggle.click();

  await page.locator(".available-row", { hasText: "Plan this week across projects" }).getByRole("button", { name: "Focus ✦✦" }).click();
  await expect(page.locator("#focus-list")).toContainText("Plan this week across projects");
  await expect(page.getByText("NOW", { exact: true })).toHaveCount(2);
});

test("animates row ordering and refreshes without replacing the visible deck", async ({ page }) => {
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "enabled");
  const focusRows = page.locator("#focus-list .thread-row");
  await expect(focusRows.first()).toContainText("Ship the Gaja source release");
  await focusRows.filter({ hasText: "Review the multi-agent adapter contract" }).getByRole("button", { name: "Move task up" }).click();
  await expect(focusRows.first()).toContainText("Review the multi-agent adapter contract");
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");

  const refresh = page.getByRole("button", { name: "Refresh Gaja" });
  await refresh.click();
  await expect(page.getByRole("heading", { name: "What deserves your attention now?" })).toBeVisible();
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

test("filters recent threads and remains operable by keyboard", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Filter recent threads" });
  await search.focus();
  await page.keyboard.type("build-tools");
  await expect(page.locator(".available-row", { hasText: "build-tools" })).toBeVisible();
  await expect(page.locator(".available-row", { hasText: "workspace" })).toBeHidden();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("passes automated accessibility checks in expanded and collapsed states", async ({ page }) => {
  const expanded = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(expanded.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);

  await page.locator('button[data-collapse="important"]').click();
  await expect(page.locator("#important-list")).toBeHidden();
  await expect(page.locator("#app")).toHaveAttribute("data-motion-state", "idle");
  const collapsed = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(collapsed.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);

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
