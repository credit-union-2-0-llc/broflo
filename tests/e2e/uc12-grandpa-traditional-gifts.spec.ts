import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson, uploadPhoto } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const grandpa = PERSONAS.grandpaEarl;

test.use({ storageState: authFile("beta") });

test.describe("UC-12: Grandpa Earl — traditional/no-tech gifts", () => {
  test("create Grandpa with old-school preferences and bookshelf photo", async ({ page }) => {
    await ensurePersonExists(page, grandpa);

    await navigateToPerson(page, grandpa.name);
    await expect(page.locator("text=Fly fishing").first()).toBeVisible();
    await expect(page.locator("text=L.L.Bean").first()).toBeVisible();
  });

  test("upload bookshelf photo for Grandpa's reading interests", async ({ page }) => {
    await ensurePersonExists(page, grandpa);
    await uploadPhoto(page, grandpa.name, "bookshelf");

    const photos = page.locator("img[alt*='photo'], img[alt*='Photo']");
    await expect(photos.first()).toBeVisible({ timeout: 15_000 });
  });

  test("generate traditional gift suggestions (no tech)", async ({ page }) => {
    await ensurePersonExists(page, grandpa);
    await generateSuggestions(page, grandpa.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
