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
});

test("reflows without horizontal overflow and records light, dark, and forced-color evidence", async ({ page }) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-light.png"), fullPage: true });

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("#app")).toHaveAttribute("data-motion", "reduced");
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-dark-reduced-motion.png"), fullPage: true });

  await page.emulateMedia({ forcedColors: "active" });
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-forced-colors.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light", forcedColors: "none", reducedMotion: "no-preference" });
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasOverflow).toBe(false);
  await page.screenshot({ path: path.join(evidenceDirectory, "gajendra-compact.png"), fullPage: true });
});
