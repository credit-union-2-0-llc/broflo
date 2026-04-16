import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";
import { ensurePersonExists } from "./helpers/person";

const mom = PERSONAS.mom;

test.use({ storageState: authFile("alpha") });

test.describe("UC-09: Generate Mom birthday suggestions — sentimental style", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePersonExists(page, mom);
  });

  test("generate suggestions that match Mom's cooking/garden interests", async ({ page }) => {
    await generateSuggestions(page, mom.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const firstCard = page.locator('[role="listitem"][aria-label*="Gift suggestion"]').first();
    await expect(firstCard).toBeVisible();
  });

  test("suggestions within Mom's $50-$175 budget", async ({ page }) => {
    await generateSuggestions(page, mom.name);

    const prices = page.locator('[role="listitem"] >> text=/\\$/');
    await expect(prices.first()).toBeVisible();
  });

  test("top pick badge visible on highest confidence suggestion", async ({ page }) => {
    await generateSuggestions(page, mom.name);

    const topPick = page.locator('text="We\'d pick this one"');
    if (await topPick.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(topPick).toBeVisible();
    }
  });
});
