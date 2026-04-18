import {
  Controller,
  Get,
  Param,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request } from "express";
import * as crypto from "crypto";
import { RedisService } from "../redis/redis.service";
import { Public } from "../auth/decorators/public.decorator";

/**
 * E2E test hatch — OTP retrieval for cross-browser login tests.
 *
 * Only registered in AppModule when E2E_TEST_HATCH_ENABLED === '1'. Triple-gated
 * at request time: shared-secret header, email allowlist, and (implicitly) the
 * master switch. All failure modes return 404 so the endpoint is indistinguishable
 * from "not deployed" when any gate rejects — never leak which check failed.
 */
@Controller("test")
export class TestingController {
  private readonly log = new Logger(TestingController.name);

  constructor(private readonly redis: RedisService) {}

  @Public()
  @Get("last-otp/:email")
  async getLastOtp(@Param("email") email: string, @Req() req: Request) {
    const emailLower = email.toLowerCase();
    const ip = (
      (req.headers["x-forwarded-for"] as string) ||
      req.ip ||
      ""
    ).toString();

    if (!this.tokenMatches(req)) {
      this.log.warn(`[test-hatch] deny token: email=${emailLower} ip=${ip}`);
      throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    }

    if (!this.isEmailAllowed(emailLower)) {
      this.log.warn(
        `[test-hatch] deny allowlist: email=${emailLower} ip=${ip}`,
      );
      throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    }

    const code = await this.redis.getOtp(emailLower);
    if (!code) {
      this.log.log(`[test-hatch] no-otp: email=${emailLower} ip=${ip}`);
      throw new HttpException("Not found", HttpStatus.NOT_FOUND);
    }

    this.log.log(`[test-hatch] grant: email=${emailLower} ip=${ip}`);
    return { code };
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
