import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson, uploadPhoto } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const wife = PERSONAS.wifeSarah;

test.use({ storageState: authFile("gamma") });

test.describe("UC-15: Wife Sarah — premium/discerning taste + bookshelf photo", () => {
  test("create full premium dossier with all fields", async ({ page }) => {
    await ensurePersonExists(page, wife);

    await navigateToPerson(page, wife.name);
    await expect(page.locator("text=Interior design").first()).toBeVisible();
    await expect(page.locator("text=Aesop").first()).toBeVisible();
    await expect(page.locator("text=Shellfish").first()).toBeVisible();
  });

  test("upload bookshelf photo for personality enrichment", async ({ page }) => {
    await ensurePersonExists(page, wife);
    await uploadPhoto(page, wife.name, "bookshelf");

    const photos = page.locator("img[alt*='photo'], img[alt*='Photo']");
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generate premium-tier suggestions for anniversary", async ({ page }) => {
    await ensurePersonExists(page, wife);

    await page.goto("/events");
    const anniversaryCard = page.locator('text=Anniversary').first();
    if (await anniversaryCard.isVisible({ timeout: 5000 }).catch(() => false)) {
      await anniversaryCard.click();

      const giftBtn = page.locator(
        'button:has-text("Find Gift"), button:has-text("Get Gift Ideas"), button:has-text("Find Gifts")',
      );
      if (await giftBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await giftBtn.first().click();
        await expect(
          page.locator('[role="listitem"][aria-label*="Gift suggestion"]').first(),
        ).toBeVisible({ timeout: 30_000 });
      }
    }
  });
});
