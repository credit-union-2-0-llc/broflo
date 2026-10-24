import * as crypto from "crypto";
import type { Request } from "express";

/**
 * Whether the E2E test hatch is allowed to be active in this process at all.
 *
 * The hatch hands out live login OTPs and lets requests skip the OTP rate
 * limit, so it is an authentication bypass by design and must NEVER be
 * reachable in production — not even if E2E_TEST_HATCH_ENABLED=1 is set there
 * by mistake. The NODE_ENV guard makes a single stray env var insufficient to
 * arm it: production refuses. Deployed non-production test targets (staging,
 * preview) run with NODE_ENV !== "production" and are unaffected.
 *
 * This is the single source of truth for every hatch gate (TestingModule
 * mounting, TestingController, the throttler skip, and the sendOtp bypass).
 */
export function isE2EHatchActive(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.E2E_TEST_HATCH_ENABLED === "1";
}

/**
 * Triple-gate check for E2E hatch traffic, shared by the throttler guard and
 * auth service. Same gates as TestingController: master switch (never in
 * production, see isE2EHatchActive) + shared-secret header + email allowlist.
 * Returns false on any mismatch (never throws).
 */
export function isE2EHatchRequest(req: Request, email: string): boolean {
  if (!isE2EHatchActive()) return false;

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
