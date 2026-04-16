import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson, uploadPhoto } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const nephew = PERSONAS.nephewTyler;

test.use({ storageState: authFile("gamma") });

test.describe("UC-13: Nephew Tyler — teen/gaming/sneaker gifts", () => {
  test("create teen profile with gaming and sneaker interests", async ({ page }) => {
    await ensurePersonExists(page, nephew);

    await navigateToPerson(page, nephew.name);
    await expect(page.locator("text=Gaming").first()).toBeVisible();
    await expect(page.locator("text=Nike").first()).toBeVisible();
  });

  test("upload gaming setup photo for Tyler", async ({ page }) => {
    await ensurePersonExists(page, nephew);
    await uploadPhoto(page, nephew.name, "gaming_music");

    const photos = page.locator(".aspect-square img");
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generate trendy suggestions for a teenager", async ({ page }) => {
    await ensurePersonExists(page, nephew);
    await generateSuggestions(page, nephew.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
