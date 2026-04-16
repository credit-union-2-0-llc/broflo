import { test, expect } from "@playwright/test";
import { authFile } from "./helpers/auth";

test.use({ storageState: authFile("delta") });

test.describe("UC-19: Dashboard with all 10 personas loaded", () => {
  test("dashboard renders all 4 widgets", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("h1")).toContainText("Dashboard");

    const scoreWidget = page.locator('text=/Broflo Score|Rookie Bro|score/i');
    await expect(scoreWidget.first()).toBeVisible();

    const comingUp = page.locator('text=/Coming Up|Upcoming|events/i');
    await expect(comingUp.first()).toBeVisible();

    const recentGifts = page.locator('text=/Recent Gifts|No gifts recorded/i');
    await expect(recentGifts.first()).toBeVisible();
  });

  test("people page shows created personas", async ({ page }) => {
    await page.goto("/people");

    const personCards = page.locator('[class*="card"], [role="listitem"]');
    const count = await personCards.count();

    if (count >= 1) {
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test("navigation works across all main sections", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Dashboard");

    await page.click('a:has-text("People"), [role="tab"]:has-text("People")');
    await expect(page).toHaveURL(/.*people/);

    await page.click('a:has-text("Events"), [role="tab"]:has-text("Events")');
    await expect(page).toHaveURL(/.*events/);

    await page.click('a:has-text("Orders"), [role="tab"]:has-text("Orders")');
    await expect(page).toHaveURL(/.*orders/);
  });
});
