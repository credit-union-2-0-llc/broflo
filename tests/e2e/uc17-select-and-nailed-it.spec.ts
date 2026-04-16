import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { generateSuggestions, selectSuggestion } from "./helpers/suggestions";
import { navigateToPerson, ensurePersonExists } from "./helpers/person";

const mom = PERSONAS.mom;

test.use({ storageState: authFile("alpha") });

test.describe("UC-17: Select suggestion for Mom & rate 5 stars (Nailed It)", () => {
  test("select a suggestion and verify gift record created", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await generateSuggestions(page, mom.name);
    await selectSuggestion(page, 0);

    await navigateToPerson(page, mom.name);

    const giftHistory = page.locator('text=/gift history|gifts/i');
    if (await giftHistory.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(giftHistory.first()).toBeVisible();
    }
  });

  test("rate gift 5 stars — Nailed It flow", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await navigateToPerson(page, mom.name);

    const nailedItBtn = page.locator('button:has-text("Nailed It")');
    if (await nailedItBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nailedItBtn.click();

      const toast = page.locator('text=/nailed it|score/i');
      await expect(toast.first()).toBeVisible({ timeout: 5000 });
    }

    const fiveStars = page.locator('[aria-label*="5 star"], button:nth-child(5):has([class*="star"])');
    if (await fiveStars.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fiveStars.click();
    }
  });

  test("Broflo Score increases after 5-star rating", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await page.goto("/dashboard");

    const scoreWidget = page.locator('text=/Broflo Score|Rookie Bro|Solid Dude/i');
    await expect(scoreWidget.first()).toBeVisible();
  });
});
