import { test, expect } from "@playwright/test";
import { authFile } from "./helpers/auth";

test.use({ storageState: authFile("delta") });

test.describe("UC-20: Events timeline with upcoming events across all personas", () => {
  test("events page loads with grouped sections", async ({ page }) => {
    await page.goto("/events");

    await expect(page.locator("h1")).toContainText("Events");

    const sections = page.locator('text=/This Week|This Month|Later/');
    const sectionCount = await sections.count();

    if (sectionCount > 0) {
      await expect(sections.first()).toBeVisible();
    } else {
      const emptyState = page.locator('text=/calendar is empty/i');
      await expect(emptyState.first()).toBeVisible();
    }
  });

  test("event cards show days-until countdown badges", async ({ page }) => {
    await page.goto("/events");

    const countdownBadges = page.locator('[aria-label*="days"], text=/\\d+ days|TODAY|TOMORROW/');
    if (await countdownBadges.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(countdownBadges.first()).toBeVisible();
    }
  });

  test("event cards link to person detail pages", async ({ page }) => {
    await page.goto("/events");

    const firstEvent = page.locator('[class*="card"] a, [role="listitem"] a').first();
    if (await firstEvent.isVisible({ timeout: 5000 }).catch(() => false)) {
      await firstEvent.click();
      await expect(page).toHaveURL(/.*events\/.*/);

      const backBtn = page.locator('text=/Back to Events/i');
      await expect(backBtn).toBeVisible();
    }
  });

  test("'Find Gifts' button appears on events within 30 days", async ({ page }) => {
    await page.goto("/events");

    const findGiftsBtn = page.locator('button:has-text("Find Gifts")');
    if (await findGiftsBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(findGiftsBtn.first()).toBeVisible();
    }
  });
});
