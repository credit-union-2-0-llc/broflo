import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";
import { generateSuggestions, countSuggestions } from "./helpers/suggestions";

const boss = PERSONAS.bossTom;

test.use({ storageState: authFile("beta") });

test.describe("UC-11: Boss Tom — professional holiday gift", () => {
  test("create Boss profile and add custom holiday event", async ({ page }) => {
    await ensurePersonExists(page, boss);

    await navigateToPerson(page, boss.name);

    const addEventBtn = page.locator('button:has-text("Add Event"), a:has-text("Add Event")');
    if (await addEventBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addEventBtn.click();

      await page.fill('#name, input[name="name"]', "Holiday Gift Exchange");
      await page.fill('#date, input[name="date"]', "2026-12-18");

      const typeSelect = page.locator('#occasionType, select[name="occasionType"]');
      if (await typeSelect.isVisible()) {
        await typeSelect.selectOption("holiday");
      }

      await page.click('button:has-text("Create"), button:has-text("Save")');
    }
  });

  test("generate professional-appropriate suggestions for Boss", async ({ page }) => {
    await ensurePersonExists(page, boss);
    await generateSuggestions(page, boss.name);

    const count = await countSuggestions(page);
    expect(count).toBeGreaterThanOrEqual(3);

    const cards = page.locator('[role="listitem"][aria-label*="Gift suggestion"]');
    await expect(cards.first()).toBeVisible();
  });
});
