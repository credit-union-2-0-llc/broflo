import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson, uploadPhoto } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const chris = PERSONAS.buddyChris;

test.use({ storageState: authFile("delta") });

test.describe("UC-16: Buddy Chris — normal/easy bro gifts + bar cart photo", () => {
  test("create easy-going buddy with standard bro interests", async ({ page }) => {
    await ensurePersonExists(page, chris);

    await navigateToPerson(page, chris.name);
    await expect(page.locator("text=Fantasy football").first()).toBeVisible();
    await expect(page.locator("text=Yeti").first()).toBeVisible();
  });

  test("upload bar cart photo for Chris", async ({ page }) => {
    await ensurePersonExists(page, chris);
    await uploadPhoto(page, chris.name, "bar_cart");

    const photos = page.locator(".aspect-square img");
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generate standard gift suggestions for normal bro", async ({ page }) => {
    await ensurePersonExists(page, chris);
    await generateSuggestions(page, chris.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
