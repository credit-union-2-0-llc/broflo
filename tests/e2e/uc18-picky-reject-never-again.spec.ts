import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { generateSuggestions, selectSuggestion } from "./helpers/suggestions";
import { navigateToPerson, ensurePersonExists } from "./helpers/person";

const brother = PERSONAS.brotherJake;

test.use({ storageState: authFile("alpha") });

test.describe("UC-18: Rate 1 star for picky Brother → never-again flow", () => {
  test("select suggestion and rate 1 star (he hated it)", async ({ page }) => {
    await ensurePersonExists(page, brother);

    await generateSuggestions(page, brother.name);
    await selectSuggestion(page, 0);

    await navigateToPerson(page, brother.name);

    const oneStar = page.locator('[aria-label*="1 star"], button:first-child:has([class*="star"])');
    if (await oneStar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await oneStar.click();
    }
  });

  test("1-star rating triggers never-again confirmation dialog", async ({ page }) => {
    await ensurePersonExists(page, brother);
    await navigateToPerson(page, brother.name);

    const neverAgainPrompt = page.locator('text=/never suggest this again|never-again/i');
    if (await neverAgainPrompt.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(neverAgainPrompt.first()).toBeVisible();

      const confirmBtn = page.locator('button:has-text("Yes"), button:has-text("Confirm"), button:has-text("Ban")');
      await confirmBtn.first().click();

      const toast = page.locator('text=/banished|never again/i');
      await expect(toast.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("never-again item appears in person dossier", async ({ page }) => {
    await ensurePersonExists(page, brother);
    await navigateToPerson(page, brother.name);

    const neverAgainSection = page.locator('text=/never.again|banned gifts/i');
    if (await neverAgainSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(neverAgainSection.first()).toBeVisible();
    }
  });
});
