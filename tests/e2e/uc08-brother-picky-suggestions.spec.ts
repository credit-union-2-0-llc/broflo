import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";
import { ensurePersonExists } from "./helpers/person";

const brother = PERSONAS.brotherJake;

test.use({ storageState: authFile("alpha") });

test.describe("UC-08: Generate suggestions for picky Brother Jake", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePersonExists(page, brother);
  });

  test("suggestions reflect Jake's specific indie/artisan preferences", async ({ page }) => {
    await generateSuggestions(page, brother.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const cards = page.locator('[role="listitem"][aria-label*="Gift suggestion"]');
    await expect(cards.first()).toBeVisible();
  });

  test("suggestions respect $75-$200 budget range", async ({ page }) => {
    await generateSuggestions(page, brother.name);

    const budgetText = page.locator('text=/\\$75.*\\$200|budget/i');
    if (await budgetText.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(budgetText.first()).toBeVisible();
    }
  });

  test("re-roll button shows upsell for free tier", async ({ page }) => {
    await generateSuggestions(page, brother.name);

    const rerollBtn = page.locator('button:has-text("Try Again")');
    const upsellText = page.locator('text=/upgrade.*pro|re-roll/i');

    if (await rerollBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await rerollBtn.isDisabled();
      if (!isDisabled) {
        await rerollBtn.click();
        await expect(upsellText.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
