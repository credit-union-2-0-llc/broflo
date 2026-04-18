/**
 * Cross-browser OTP login smoke test.
 *
 * Runs against the full browser/device matrix defined in
 * playwright.cross-browser.config.ts — validates the click → send code →
 * receive code → submit → land on dashboard flow in every engine.
 *
 * Uses a dedicated ephemeral email per browser to avoid OTP throttle
 * collisions when projects run serially.
 */

import { test, expect } from '@playwright/test';
import { ACCOUNTS, type AccountId, login } from '../e2e/helpers/auth';

// One test account per browser keeps OTP throttle collisions predictable
// when projects run serially. The login helper already backs off if the
// rate limiter (IP-scoped) kicks in across browsers.
const PROJECT_TO_ACCOUNT: Record<string, AccountId> = {
  chromium: 'alpha',
  firefox: 'beta',
  webkit: 'gamma',
  edge: 'delta',
  'mobile-ios': 'alpha',
  'mobile-android': 'beta',
};

test.describe('OTP login — cross-browser', () => {
  test('user can request a code and complete login', async ({ page }) => {
    const project = test.info().project.name;
    const accountId = PROJECT_TO_ACCOUNT[project];
    if (!accountId) {
      throw new Error(`No account mapping for project "${project}"`);
    }

    const account = ACCOUNTS[accountId];
    if (!account.email) {
      throw new Error(
        `Account "${accountId}" email missing — set E2E_${accountId.toUpperCase()}_EMAIL in .env.test`,
      );
    }

    await login(page, account);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
