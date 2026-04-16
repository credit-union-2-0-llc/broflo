import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";

const mom = PERSONAS.mom;

test.use({ storageState: authFile("alpha") });

test.describe("UC-05: Create Mom profile — sentimental/garden/cooking", () => {
  test("create Mom with birthday, anniversary, and full preferences", async ({ page }) => {
    await ensurePersonExists(page, mom);

    await navigateToPerson(page, mom.name);

    await expect(page.locator("text=Birthday").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Anniversary").first()).toBeVisible({ timeout: 5000 });
  });

  test("verify auto-events created for birthday and anniversary", async ({ page }) => {
    await ensurePersonExists(page, mom);
    await navigateToPerson(page, mom.name);

    const autoTags = page.locator('text="auto"');
    const autoCount = await autoTags.count();
    expect(autoCount).toBeGreaterThanOrEqual(2);
  });
});
