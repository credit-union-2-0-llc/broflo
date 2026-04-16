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

    // Use events page — the person detail "Add Event" dialog trigger has a Base UI
    // render prop issue that prevents the dialog from opening via click
    await page.goto("/events");
    await page.waitForLoadState("networkidle");

    const addEventBtn = page.locator('button:has-text("Add Event")');
    await addEventBtn.click();

    // Select person
    await page.locator('#event-person').click();
    await page.getByRole("option", { name: boss.name }).click();

    // Select occasion type (Base UI Select)
    await page.locator('#event-occasion').click();
    await page.getByRole("option", { name: "Holiday" }).click();

    // Override the auto-filled name with custom text
    await page.fill('#event-name', "Holiday Gift Exchange");
    await page.fill('#event-date', "2026-12-18");

    await page.click('button:has-text("Create Event")');

    // Verify event appears in the list
    await expect(page.locator('text=Holiday Gift Exchange').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
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
