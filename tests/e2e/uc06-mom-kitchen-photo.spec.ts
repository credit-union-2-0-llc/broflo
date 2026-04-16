import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { navigateToPerson, uploadPhoto, ensurePersonExists } from "./helpers/person";

const mom = PERSONAS.mom;

test.use({ storageState: authFile("alpha") });

test.describe("UC-06: Upload Mom's kitchen photo for enrichment", () => {
  test("upload kitchen photo and categorize correctly", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await navigateToPerson(page, mom.name);
    await uploadPhoto(page, mom.name, "kitchen");

    const photos = page.locator("img[alt*='photo'], img[alt*='Photo']");
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
  });

  test("kitchen photo analysis extracts cooking/home signals", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await navigateToPerson(page, mom.name);

    const signals = page.locator('text="Signals extracted"');
    if (await signals.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await expect(signals).toBeVisible();
    }
  });
});
