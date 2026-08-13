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
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    revokedToken: { create: jest.Mock };
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
  const USER = {
    id: "user-1",
    email: EMAIL,
    isActive: true,
    name: null,
    avatarUrl: null,
    subscriptionTier: "free",
  };

  // Real in-memory store keyed by tokenHash, so create/findUnique/delete
  // across multiple issueTokens()/refresh() calls in one test behave like
  // an actual table with real rows instead of independently-stubbed calls —
  // that's the only way to catch "does refreshing device A touch device B".
  let refreshTokenStore: Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date }>;

  beforeEach(async () => {
    refreshTokenStore = new Map();
    let nextId = 1;

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(USER),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: {
        create: jest.fn(({ data }) => {
          const row = { id: `rt-${nextId++}`, userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt };
          refreshTokenStore.set(row.tokenHash, row);
          return Promise.resolve(row);
        }),
        findUnique: jest.fn(({ where }) => {
          const row = refreshTokenStore.get(where.tokenHash);
          return Promise.resolve(row ? { ...row, user: USER } : null);
        }),
        update: jest.fn(({ where, data }) => {
          for (const row of refreshTokenStore.values()) {
            if (row.id === where.id) Object.assign(row, data);
          }
          return Promise.resolve({});
        }),
        delete: jest.fn(({ where }) => {
          for (const [hash, row] of refreshTokenStore) {
            if (row.id === where.id) refreshTokenStore.delete(hash);
          }
          return Promise.resolve({});
        }),
        deleteMany: jest.fn(({ where }) => {
          for (const [hash, row] of refreshTokenStore) {
            if (row.userId === where.userId) refreshTokenStore.delete(hash);
          }
          return Promise.resolve({ count: 0 });
        }),
      },
      revokedToken: { create: jest.fn().mockResolvedValue({}) },
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

  describe("refresh — per-device tokens", () => {
    it("lets two independent logins (e.g. web + mobile) both keep working", async () => {
      const login1 = await service.verifyOtp({ email: EMAIL, code: "123456" });
      const login2 = await service.verifyOtp({ email: EMAIL, code: "123456" });

      // Logging in a second time must not invalidate the first device's
      // refresh token — this is exactly the bug: a single refreshTokenHash
      // column meant the second login silently kicked the first one out.
      await expect(service.refresh(login1.refreshToken)).resolves.toBeDefined();
      await expect(service.refresh(login2.refreshToken)).resolves.toBeDefined();
    });

    it("refreshing one device's token does not invalidate a different device's token", async () => {
      const login1 = await service.verifyOtp({ email: EMAIL, code: "123456" });
      const login2 = await service.verifyOtp({ email: EMAIL, code: "123456" });

      await service.refresh(login1.refreshToken);

      // login2's token was never touched by login1's refresh — must still work.
      await expect(service.refresh(login2.refreshToken)).resolves.toBeDefined();
    });

    it("does NOT rotate — the same refresh token stays valid across repeated use", async () => {
      // Deliberately not single-use: NextAuth's session cookie means one
      // page load can fire several requests that all carry the same
      // pre-refresh cookie, so more than one legitimately reaches here with
      // the same token before any response updates it. Rotating on first
      // use invalidated the token out from under every other concurrent
      // request using that identical, still-good cookie — this is the
      // actual bug that caused "people disappeared" to reappear even after
      // the per-device fix.
      const login = await service.verifyOtp({ email: EMAIL, code: "123456" });

      await service.refresh(login.refreshToken);
      await expect(service.refresh(login.refreshToken)).resolves.toBeDefined();
      await expect(service.refresh(login.refreshToken)).resolves.toBeDefined();
    });

    it("simulates several concurrent requests from one page load reusing the same stale cookie", async () => {
      const login = await service.verifyOtp({ email: EMAIL, code: "123456" });

      // Same token, fired concurrently — exactly what several parallel
      // Server Component data fetches on one page load do.
      const results = await Promise.all([
        service.refresh(login.refreshToken),
        service.refresh(login.refreshToken),
        service.refresh(login.refreshToken),
      ]);

      for (const r of results) expect(r).toBeDefined();
    });

    it("rejects an unrecognized refresh token", async () => {
      await expect(service.refresh("not-a-real-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
