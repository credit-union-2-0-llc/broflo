import { test as setup, expect } from "@playwright/test";
import { ACCOUNTS, type AccountId, authFile, signup, login } from "./helpers/auth";
import fs from "fs";

setup.describe.configure({ timeout: 120_000 });

const accountIds = Object.keys(ACCOUNTS) as AccountId[];

for (const id of accountIds) {
  setup(`authenticate ${id}`, async ({ page }) => {
    const account = ACCOUNTS[id];
    const dir = authFile(id).replace(/\/[^/]+$/, "");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
      await login(page, account);
      await page.context().storageState({ path: authFile(id) });
      return;
    } catch {
      // Account doesn't exist or login failed — create it
    }

    await signup(page, account);
    await page.context().storageState({ path: authFile(id) });
  });
}
