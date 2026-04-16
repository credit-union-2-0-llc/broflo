import { type Page, expect } from "@playwright/test";

export async function generateSuggestions(page: Page, personName: string) {
  // Find the event for this person and navigate to it
  await page.goto("/events");
  const eventCard = page.locator(`text=${personName}`).first();
  await eventCard.click();
  await page.waitForLoadState("networkidle");

  // Click "Find Gift Ideas" or "Get Gift Ideas" button
  const giftBtn = page.locator(
    'button:has-text("Find Gift"), button:has-text("Get Gift Ideas"), button:has-text("Find Gifts")',
  );
  if (await giftBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await giftBtn.first().click();
  }

  // Wait for suggestions to load (may take a while for AI)
  await expect(
    page.locator('[role="listitem"][aria-label*="Gift suggestion"]').first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function selectSuggestion(page: Page, index = 0) {
  const cards = page.locator('[role="listitem"][aria-label*="Gift suggestion"]');
  const count = await cards.count();

  // Find the (index+1)th card that still has "Select This Gift" (skip already-selected)
  let cardIndex = -1;
  let found = 0;
  for (let i = 0; i < count; i++) {
    const btn = cards.nth(i).locator('button:has-text("Select This Gift")');
    if (await btn.count() > 0) {
      if (found === index) { cardIndex = i; break; }
      found++;
    }
  }
  if (cardIndex < 0) throw new Error("No selectable suggestion found");

  // nth() uses fixed DOM position — stable across state changes
  await cards.nth(cardIndex).locator('button:has-text("Select This Gift")').click();
  await expect(
    cards.nth(cardIndex).locator('button:has-text("Selected")'),
  ).toBeVisible({ timeout: 10_000 });
}

export async function dismissSuggestion(page: Page, index = 0) {
  const cards = page.locator('[role="listitem"][aria-label*="Gift suggestion"]');
  const card = cards.nth(index);
  await card.locator('button:has-text("Not this one")').click();
}

export async function countSuggestions(page: Page): Promise<number> {
  return page.locator('[role="listitem"][aria-label*="Gift suggestion"]').count();
}

export async function rerollSuggestions(page: Page, guidance?: string) {
  if (guidance) {
    const guidanceInput = page.locator(
      'input[placeholder*="guidance"], textarea[placeholder*="guidance"]',
    );
    if (await guidanceInput.isVisible()) {
      await guidanceInput.fill(guidance);
    }
  }
  await page.click('button:has-text("Try Again")');
  await page.waitForTimeout(2000);
  await expect(
    page.locator('[role="listitem"][aria-label*="Gift suggestion"]').first(),
  ).toBeVisible({ timeout: 30_000 });
}
