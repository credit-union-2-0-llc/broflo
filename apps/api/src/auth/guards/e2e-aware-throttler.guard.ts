import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Request } from "express";
import * as crypto from "crypto";

/**
 * Throttler that skips rate-limiting for triple-gated E2E test traffic:
 * master switch + shared-secret header + email allowlist. Matches the
 * TestingController hatch gates so one set of env vars covers both paths.
 */
@Injectable()
export class E2EAwareThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.E2E_TEST_HATCH_ENABLED !== "1") return false;
    const req = context.switchToHttp().getRequest<Request>();
    if (!this.tokenMatches(req)) return false;
    const email = (req.body?.email ?? "").toString().toLowerCase();
    if (!email) return false;
    return this.isEmailAllowed(email);
  }

  private tokenMatches(req: Request): boolean {
    const expected = process.env.E2E_TEST_HATCH_TOKEN || "";
    if (expected.length === 0) return false;
    const provided = (req.header("x-e2e-token") || "").toString();
    if (provided.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(expected),
    );
  }

  private isEmailAllowed(emailLower: string): boolean {
    const raw = process.env.E2E_TEST_HATCH_ALLOWED_EMAILS || "";
    const allowlist = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return allowlist.includes(emailLower);
  }
}
