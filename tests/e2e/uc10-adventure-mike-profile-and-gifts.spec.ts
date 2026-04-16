import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const mike = PERSONAS.bestFriendMike;

test.use({ storageState: authFile("beta") });

test.describe("UC-10: Create adventure buddy Mike — experiences over things", () => {
  test("create Mike with outdoor/adventure dossier", async ({ page }) => {
    await ensurePersonExists(page, mike);

    await navigateToPerson(page, mike.name);
    await expect(page.locator("text=Rock climbing").first()).toBeVisible();
    await expect(page.locator("text=Patagonia").first()).toBeVisible();
  });

  test("generate adventure-themed suggestions for Mike's birthday", async ({ page }) => {
    await ensurePersonExists(page, mike);
    await generateSuggestions(page, mike.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const cards = page.locator('[role="listitem"][aria-label*="Gift suggestion"]');
    await expect(cards.first()).toBeVisible();
  });

  test("vegetarian dietary restriction noted in profile", async ({ page }) => {
    await ensurePersonExists(page, mike);
    await navigateToPerson(page, mike.name);

    await expect(page.locator("text=Vegetarian").first()).toBeVisible();
  });
});
