import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../../email/email.service";
import { RedisService } from "../../redis/redis.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let redis: {
    getOtp: jest.Mock;
    deleteOtp: jest.Mock;
    checkAndIncrementOtpVerifyAttempts: jest.Mock;
    clearOtpVerifyAttempts: jest.Mock;
    checkOtpRateLimit: jest.Mock;
    setOtp: jest.Mock;
  };
  let jwt: { sign: jest.Mock };
  let email: { sendOtpCode: jest.Mock };

  const EMAIL = "user@example.com";

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          email: EMAIL,
          isActive: true,
          name: null,
          avatarUrl: null,
          subscriptionTier: "free",
        }),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    redis = {
      getOtp: jest.fn().mockResolvedValue("123456"),
      deleteOtp: jest.fn().mockResolvedValue(undefined),
      checkAndIncrementOtpVerifyAttempts: jest.fn().mockResolvedValue({ allowed: true }),
      clearOtpVerifyAttempts: jest.fn().mockResolvedValue(undefined),
      checkOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 2 }),
      setOtp: jest.fn().mockResolvedValue(undefined),
    };
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt.token") };
    email = { sendOtpCode: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: email },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe("verifyOtp — per-email attempt lockout", () => {
    it("checks the per-email attempt lockout before comparing the code", async () => {
      await service.verifyOtp({ email: EMAIL, code: "123456" });
      expect(redis.checkAndIncrementOtpVerifyAttempts).toHaveBeenCalledWith(EMAIL);
    });

    it("rejects with 401 once the per-email lockout trips, without even reading the stored code", async () => {
      redis.checkAndIncrementOtpVerifyAttempts.mockResolvedValue({ allowed: false });

      await expect(
        service.verifyOtp({ email: EMAIL, code: "123456" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Locked out is locked out — don't leak whether the guess was even close.
      expect(redis.getOtp).not.toHaveBeenCalled();
    });

    it("clears the attempt counter on a successful verify", async () => {
      await service.verifyOtp({ email: EMAIL, code: "123456" });
      expect(redis.clearOtpVerifyAttempts).toHaveBeenCalledWith(EMAIL);
    });

    it("does not clear the attempt counter on a wrong code", async () => {
      redis.getOtp.mockResolvedValue("654321");

      await expect(
        service.verifyOtp({ email: EMAIL, code: "123456" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(redis.clearOtpVerifyAttempts).not.toHaveBeenCalled();
    });

    it("still rejects an expired/missing code normally when attempts are within budget", async () => {
      redis.getOtp.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ email: EMAIL, code: "123456" }),
      ).rejects.toThrow(/Invalid or expired code/);
    });
  });
});
