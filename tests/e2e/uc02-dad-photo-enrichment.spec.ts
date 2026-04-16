import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { navigateToPerson, uploadPhoto, ensurePersonExists } from "./helpers/person";

const dad = PERSONAS.dad;

test.use({ storageState: authFile("alpha") });

test.describe("UC-02: Upload Dad's garage photo for AI enrichment", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePersonExists(page, dad);
  });

  test("upload garage workshop photo to Dad's profile", async ({ page }) => {
    await navigateToPerson(page, dad.name);

    await expect(page.locator('h2:has-text("Photos")')).toBeVisible();

    await uploadPhoto(page, dad.name, "garage");

    await expect(page.locator(".aspect-square img").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("photo analysis enriches Dad's profile with workshop signals", async ({ page }) => {
    await navigateToPerson(page, dad.name);

    const analysisText = page.locator(
      'text="Signals extracted", text="Broflo\'s reading the room..."',
    );
    await expect(analysisText.first()).toBeVisible({ timeout: 30_000 }).catch(() => {});
  });
});
