import { type Page, expect } from "@playwright/test";
import path from "path";
import { config } from "dotenv";

config({ path: path.join(__dirname, "..", "..", "..", ".env.test") });

export const AUTH_DIR = path.join(__dirname, "..", ".auth");

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function acct(id: string) {
  const upper = id.toUpperCase();
  return {
    name: "Kirk Test",
    email: process.env[`E2E_${upper}_EMAIL`] ?? "",
  };
}

export const ACCOUNTS = {
  alpha: acct("alpha"),
  beta: acct("beta"),
  gamma: acct("gamma"),
  delta: acct("delta"),
};

export type AccountId = keyof typeof ACCOUNTS;

export function authFile(id: AccountId): string {
  return path.join(AUTH_DIR, `${id}.json`);
}

async function getOtpCode(email: string): Promise<string> {
  const res = await fetch(`${API_URL}/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`send-otp failed: ${res.status}`);
  const body = await res.json();
  if (!body.code) throw new Error("OTP code not returned — is NODE_ENV=test?");
  return body.code;
}

export async function signup(
  page: Page,
  user: { name: string; email: string },
  attempt = 1,
): Promise<void> {
  return login(page, user, attempt);
}

export async function login(
  page: Page,
  user: { email: string; name?: string },
  attempt = 1,
): Promise<void> {
  const code = await getOtpCode(user.email);

  await page.goto("/login");
  await page.fill("#email", user.email);
  await page.click('button:has-text("Send code")');

  const codeOrError = await Promise.race([
    page.locator("#code").waitFor({ timeout: 10_000 }).then(() => "code-visible" as const),
    page.locator("text=Too many code requests").waitFor({ timeout: 10_000 }).then(() => "throttled" as const),
    page.locator("text=Failed to send").waitFor({ timeout: 10_000 }).then(() => "error" as const),
  ]).catch(() => "timeout" as const);

  if (codeOrError === "throttled" && attempt < 6) {
    const backoff = Math.min(5000 * Math.pow(2, attempt - 1), 30_000);
    await page.waitForTimeout(backoff);
    return login(page, user, attempt + 1);
  }

  if (codeOrError !== "code-visible") {
    throw new Error(`Login failed at send-code step (${codeOrError}) — stuck on ${page.url()}`);
  }

  await page.fill("#code", code);
  await page.click('button:has-text("Sign in")');

  const result = await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 15_000 }).then(() => "dashboard" as const),
    page.locator("text=Invalid or expired code").waitFor({ timeout: 10_000 }).then(() => "invalid" as const),
    page.locator("text=Too Many Requests").waitFor({ timeout: 10_000 }).then(() => "throttled" as const),
  ]).catch(() => "timeout" as const);

  if (result === "dashboard" || page.url().includes("/dashboard")) return;

  if ((result === "throttled" || result === "timeout") && attempt < 4) {
    await page.waitForTimeout(3000 * attempt);
    return login(page, user, attempt + 1);
  }

  throw new Error(`Login failed (${result}) — stuck on ${page.url()}`);
}
