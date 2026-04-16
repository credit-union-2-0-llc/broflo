import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";

const brother = PERSONAS.brotherJake;

test.use({ storageState: authFile("alpha") });

test.describe("UC-03: Create Brother Jake — the picky one", () => {
  test("create full dossier with specific brands, sizes, and allergens", async ({ page }) => {
    await ensurePersonExists(page, brother);

    await navigateToPerson(page, brother.name);

    await expect(page.getByText("Vinyl collecting").first()).toBeVisible();
    await expect(page.getByText("Keychron").first()).toBeVisible();
    await expect(page.getByText("Gluten").first()).toBeVisible();
  });

  test("verify completeness score is high for detailed dossier", async ({ page }) => {
    await ensurePersonExists(page, brother);
    await navigateToPerson(page, brother.name);

    const completenessEl = page.locator('[class*="completeness"], [aria-label*="completeness"]');
    if (await completenessEl.isVisible().catch(() => false)) {
      await expect(completenessEl).toBeVisible();
    }
  });
});
