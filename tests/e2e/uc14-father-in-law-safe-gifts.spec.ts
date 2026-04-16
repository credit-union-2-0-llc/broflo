import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const fil = PERSONAS.fatherInLawRichard;

test.use({ storageState: authFile("gamma") });

test.describe("UC-14: Father-in-law Richard — minimal dossier, safe suggestions", () => {
  test("create with sparse profile (don't know him well)", async ({ page }) => {
    await ensurePersonExists(page, fil);

    await navigateToPerson(page, fil.name);
    await expect(page.locator("text=Model trains").first()).toBeVisible();
  });

  test("generate safe/practical suggestions with limited dossier info", async ({ page }) => {
    await ensurePersonExists(page, fil);
    await generateSuggestions(page, fil.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const nudge = page.locator('text=/tell us more|enrich|update.*dossier/i');
    if (await nudge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(nudge.first()).toBeVisible();
    }
  });
});
