import { type Page, expect } from "@playwright/test";
import { type Persona } from "../fixtures/personas";

export async function createPerson(page: Page, persona: Persona) {
  await page.goto("/people/new");
  await expect(page.locator("h1")).toContainText("Add a Person");

  // Basic tab (default)
  await page.fill("#name", persona.name);

  // Relationship — Base UI Select (combobox role)
  await page.getByRole("combobox").filter({ hasText: /How do you know them/ }).click();
  await page.getByRole("option", { name: persona.relationship }).click();

  if (persona.pronouns) {
    await page.getByRole("combobox").filter({ hasText: /How should we refer/ }).click();
    await page.getByRole("option", { name: persona.pronouns }).click();
  }

  if (persona.birthday) {
    await page.fill("#birthday", persona.birthday);
  }

  if (persona.anniversary) {
    await page.fill("#anniversary", persona.anniversary);
  }

  // Budget tab
  if (persona.budgetMin || persona.budgetMax) {
    await page.getByRole("tab", { name: "Budget" }).click();
    await page.locator("#budgetMin").waitFor({ state: "visible", timeout: 5000 });
    if (persona.budgetMin) await page.fill("#budgetMin", String(persona.budgetMin));
    if (persona.budgetMax) await page.fill("#budgetMax", String(persona.budgetMax));
  }

  // Preferences tab
  if (persona.hobbies || persona.musicTaste || persona.favoriteBrands || persona.foodPreferences || persona.clothingSizeTop) {
    await page.getByRole("tab", { name: "Preferences" }).click();
    await page.locator("#clothingSizeTop, #hobbies").first().waitFor({ state: "visible", timeout: 5000 });
    if (persona.clothingSizeTop) await page.fill("#clothingSizeTop", persona.clothingSizeTop);
    if (persona.clothingSizeBottom) await page.fill("#clothingSizeBottom", persona.clothingSizeBottom);
    if (persona.shoeSize) await page.fill("#shoeSize", persona.shoeSize);
    if (persona.musicTaste) await page.fill("#musicTaste", persona.musicTaste);
    if (persona.favoriteBrands) await page.fill("#favoriteBrands", persona.favoriteBrands);
    if (persona.hobbies) await page.fill("#hobbies", persona.hobbies);
    if (persona.foodPreferences) await page.fill("#foodPreferences", persona.foodPreferences);

    if (persona.allergens) {
      for (const allergen of persona.allergens) {
        const btn = page.getByRole("button", { name: new RegExp(allergen, "i") });
        if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) await btn.first().click();
      }
    }

    if (persona.dietaryRestrictions) {
      for (const diet of persona.dietaryRestrictions) {
        const btn = page.getByRole("button", { name: new RegExp(diet, "i") });
        if (await btn.first().isVisible({ timeout: 2000 }).catch(() => false)) await btn.first().click();
      }
    }
  }

  // Notes tab
  if (persona.notes || persona.wishlistUrls) {
    await page.getByRole("tab", { name: "Notes" }).click();
    await page.locator("#wishlistUrls, #notes").first().waitFor({ state: "visible", timeout: 5000 });
    if (persona.wishlistUrls) await page.fill("#wishlistUrls", persona.wishlistUrls);
    if (persona.notes) await page.fill("#notes", persona.notes);
  }

  // Shipping tab
  if (persona.shippingAddress1) {
    await page.getByRole("tab", { name: "Shipping" }).click();
    await page.locator("#shippingAddress1").waitFor({ state: "visible", timeout: 5000 });
    await page.fill("#shippingAddress1", persona.shippingAddress1);
    if (persona.shippingCity) await page.fill("#shippingCity", persona.shippingCity);
    if (persona.shippingState) await page.fill("#shippingState", persona.shippingState);
    if (persona.shippingZip) await page.fill("#shippingZip", persona.shippingZip);
  }

  await page.click('button:has-text("Add Person")');
  const result = await Promise.race([
    page.waitForURL(url => url.pathname.startsWith("/people") && url.pathname !== "/people/new", { timeout: 15_000 }).then(() => "ok" as const),
    page.locator("text=/free limit|upgrade/i").waitFor({ timeout: 10_000 }).then(() => "tier-limit" as const),
  ]).catch(() => "timeout" as const);
  if (result === "tier-limit") throw new Error("Free tier person limit reached — cannot create more persons on this account");
  if (result === "timeout") throw new Error("Add Person did not redirect — stuck on /people/new");
}

export async function ensurePersonExists(page: Page, persona: Persona) {
  await page.goto("/people");
  await page.waitForLoadState("networkidle");
  const listLoaded = await Promise.race([
    page.waitForSelector('[href*="/people/"]', { timeout: 8000 }).then(() => true),
    page.getByText(/no one to shop for/i).waitFor({ timeout: 8000 }).then(() => false),
  ]).catch(() => false);

  if (listLoaded) {
    const personLink = page.getByText(persona.name);
    if (await personLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
  }
  await createPerson(page, persona);
}

export async function navigateToPerson(page: Page, name: string) {
  await page.goto("/people");
  await page.waitForSelector('[href*="/people/"]', { timeout: 10_000 });
  await page.getByText(name).first().click();
  await page.waitForURL("**/people/**", { timeout: 10_000 });
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 5_000 });
}

const CATEGORY_LABELS: Record<string, string> = {
  bookshelf: "Bookshelf", closet: "Closet", artwork: "Artwork", desk: "Desk",
  kitchen: "Kitchen", bar_cart: "Bar Cart", shoes: "Shoes", jewelry: "Jewelry",
  nightstand: "Nightstand", garage: "Garage", garden: "Garden",
  gaming_music: "Gaming/Music", pet_area: "Pet Area", fridge: "Fridge", car: "Car",
  social_ig_fb: "IG/Facebook", social_spotify: "Spotify", social_amazon: "Amazon",
};

export async function uploadPhoto(page: Page, personName: string, category?: string) {
  await navigateToPerson(page, personName);

  // Set up filechooser listener BEFORE clicking — the button click opens the native picker
  const fileChooserPromise = page.waitForEvent("filechooser");

  const uploadBtn = page.locator('button:has-text("Add Photos"), button:has-text("Choose Photo")');
  await uploadBtn.first().click();

  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(getTestPhotoPath());

  // Consent modal appears AFTER file selection (first upload only)
  const consentBtn = page.locator('button:has-text("Got it")');
  if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await consentBtn.click();
    await consentBtn.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
  }

  // Category picker appears after consent (or directly if already consented)
  if (category) {
    const label = CATEGORY_LABELS[category] || category;
    const categoryBtn = page.locator(`button:has-text("${label}")`);
    await categoryBtn.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await categoryBtn.click();
  } else {
    const skipBtn = page.locator('button:has-text("Skip")');
    await skipBtn.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await skipBtn.click();
  }

  // Wait for upload to complete
  await expect(page.locator('text="Uploading..."')).toBeHidden({ timeout: 15_000 }).catch(() => {});
}

function getTestPhotoPath(): string {
  return "./tests/e2e/fixtures/photos/test-room.jpg";
}


