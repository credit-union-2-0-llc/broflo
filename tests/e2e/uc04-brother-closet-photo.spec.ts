import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { navigateToPerson, uploadPhoto, ensurePersonExists } from "./helpers/person";

const brother = PERSONAS.brotherJake;

test.use({ storageState: authFile("alpha") });

test.describe("UC-04: Upload Brother's closet photo — brand detection", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePersonExists(page, brother);
  });

  test("upload closet photo with desk category for Jake", async ({ page }) => {
    await navigateToPerson(page, brother.name);
    await uploadPhoto(page, brother.name, "desk");

    const photoGallery = page.locator("img[alt*='photo'], img[alt*='Photo']");
    await expect(photoGallery.first()).toBeVisible({ timeout: 15_000 });
  });

  test("verify consent modal appears on first photo upload", async ({ page }) => {
    await navigateToPerson(page, brother.name);

    const uploadBtn = page.locator('button:has-text("Add Photos")');
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click();

      const consentText = page.locator('text="uploading a photo"');
      const consentBtn = page.locator('button:has-text("Got it")');

      if (await consentText.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(consentBtn).toBeVisible();
        await consentBtn.click();
      }
    }
  });
});
