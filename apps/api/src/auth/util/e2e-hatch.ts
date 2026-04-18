import * as crypto from "crypto";
import type { Request } from "express";

/**
 * Triple-gate check for E2E hatch traffic, shared by the throttler guard and
 * auth service. Same gates as TestingController: master switch + shared-secret
 * header + email allowlist. Returns false on any mismatch (never throws).
 */
export function isE2EHatchRequest(req: Request, email: string): boolean {
  if (process.env.E2E_TEST_HATCH_ENABLED !== "1") return false;

  const expected = process.env.E2E_TEST_HATCH_TOKEN || "";
  if (expected.length === 0) return false;
  const provided = (req.header("x-e2e-token") || "").toString();
  if (provided.length !== expected.length) return false;
  try {
    if (
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    ) {
      return false;
    }
  } catch {
    return false;
  }

  const allowlist = (process.env.E2E_TEST_HATCH_ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}
