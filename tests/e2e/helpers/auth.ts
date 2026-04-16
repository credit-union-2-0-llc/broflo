import { type Page, expect } from "@playwright/test";
import path from "path";

export const AUTH_DIR = path.join(__dirname, "..", ".auth");

export const ACCOUNTS = {
  alpha: { name: "Kirk Test", email: "broflo-e2e-alpha@cu-2.com", password: "TestPass123!@#" },
  beta: { name: "Kirk Test", email: "broflo-e2e-beta@cu-2.com", password: "TestPass123!@#" },
  gamma: { name: "Kirk Test", email: "broflo-e2e-gamma@cu-2.com", password: "TestPass123!@#" },
  delta: { name: "Kirk Test", email: "broflo-e2e-delta@cu-2.com", password: "TestPass123!@#" },
} as const;

export type AccountId = keyof typeof ACCOUNTS;

export function authFile(id: AccountId): string {
  return path.join(AUTH_DIR, `${id}.json`);
}

export async function signup(
  page: Page,
  user: { name: string; email: string; password: string },
  attempt = 1,
): Promise<void> {
  await page.goto("/signup");
  await page.fill("#name", user.name);
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button:has-text("Create account")');

  const errorOrDashboard = await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 30_000 }).then(() => "dashboard" as const),
    page.locator("text=Email already registered").waitFor({ timeout: 10_000 }).then(() => "exists" as const),
    page.locator("text=Failed to fetch").waitFor({ timeout: 10_000 }).then(() => "network" as const),
    page.locator("text=Too Many Requests").waitFor({ timeout: 10_000 }).then(() => "throttled" as const),
    page.locator("text=auto-login failed").waitFor({ timeout: 10_000 }).then(() => "created-no-login" as const),
  ]).catch(() => "timeout" as const);

  if (errorOrDashboard === "exists" || errorOrDashboard === "created-no-login") {
    await page.waitForTimeout(1000);
    await login(page, user);
    return;
  }
  if (errorOrDashboard === "throttled" && attempt < 6) {
    const backoff = Math.min(5000 * Math.pow(2, attempt - 1), 30_000);
    await page.waitForTimeout(backoff);
    return signup(page, user, attempt + 1);
  }
  if (errorOrDashboard === "dashboard") return;
  if (page.url().includes("/dashboard")) return;
  throw new Error(`Signup failed (${errorOrDashboard}) — stuck on ${page.url()}`);
}

export async function login(
  page: Page,
  user: { email: string; password: string },
  attempt = 1,
): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.fill("#password", user.password);
  await page.click('button:has-text("Sign in")');

  const result = await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 15_000 }).then(() => "dashboard" as const),
    page.locator("text=Invalid email or password").waitFor({ timeout: 10_000 }).then(() => "invalid" as const),
    page.locator("text=Too Many Requests").waitFor({ timeout: 10_000 }).then(() => "throttled" as const),
  ]).catch(() => "timeout" as const);

  if (result === "dashboard" || page.url().includes("/dashboard")) return;

  if ((result === "throttled" || result === "timeout") && attempt < 4) {
    await page.waitForTimeout(3000 * attempt);
    return login(page, user, attempt + 1);
  }

  throw new Error(`Login failed (${result}) — stuck on ${page.url()}`);
}
