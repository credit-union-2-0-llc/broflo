import { test, expect } from "@playwright/test";
import { PERSONAS } from "./fixtures/personas";
import { authFile } from "./helpers/auth";
import { ensurePersonExists, navigateToPerson } from "./helpers/person";

const dad = PERSONAS.dad;

test.use({ storageState: authFile("alpha") });

test.describe("UC-01: Sign up & create Dad profile (difficult person)", () => {
  test("dashboard loads after authentication", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("create Dad with minimal info — the 'has everything' guy", async ({ page }) => {
    await ensurePersonExists(page, {
      ...dad,
      musicTaste: undefined,
      favoriteBrands: undefined,
      foodPreferences: undefined,
      clothingSizeTop: undefined,
      clothingSizeBottom: undefined,
      shoeSize: undefined,
      notes: "Has everything. Says he doesn't want anything. Impossible to shop for.",
      style: "difficult",
    });
    await page.goto("/people");
    await expect(page.locator(`text=${dad.name}`)).toBeVisible();
  });
});
