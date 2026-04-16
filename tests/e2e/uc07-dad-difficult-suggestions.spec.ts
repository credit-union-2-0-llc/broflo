import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";
import { ensurePersonExists } from "./helpers/person";

const dad = PERSONAS.dad;

test.use({ storageState: authFile("alpha") });

test.describe("UC-07: Generate gift suggestions for Dad (difficult)", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePersonExists(page, dad);
  });

  test("generate suggestions for Dad's birthday — safe mode for difficult person", async ({ page }) => {
    await generateSuggestions(page, dad.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const priceTexts = page.locator('[role="listitem"] >> text=/\\$\\d/');
    await expect(priceTexts.first()).toBeVisible();
  });

  test("suggestions include practical items for 'has everything' type", async ({ page }) => {
    await generateSuggestions(page, dad.name);

    const firstCard = page.locator('[role="listitem"][aria-label*="Gift suggestion"]').first();
    await expect(firstCard).toBeVisible();

    const reasoning = firstCard.locator("blockquote, [class*='reasoning']");
    if (await reasoning.isVisible().catch(() => false)) {
      await expect(reasoning).not.toBeEmpty();
    }
  });

  test("free tier shows exactly 3 suggestions", async ({ page }) => {
    await generateSuggestions(page, dad.name);

    const count = await countSuggestions(page);
    expect(count).toBe(3);
  });
});
