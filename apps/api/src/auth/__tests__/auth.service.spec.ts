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
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
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
    checkAndIncrementLoginAttempts: jest.Mock;
    clearLoginAttempts: jest.Mock;
    setEmailVerifyToken: jest.Mock;
    consumeEmailVerifyToken: jest.Mock;
    setPasswordResetToken: jest.Mock;
    consumePasswordResetToken: jest.Mock;
  };
  let jwt: { sign: jest.Mock };
  let email: { sendOtpCode: jest.Mock; sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };

  const EMAIL = "user@example.com";
  const USER = {
    id: "user-1",
    email: EMAIL,
    isActive: true,
    name: null,
    avatarUrl: null,
    subscriptionTier: "free",
    passwordHash: null as string | null,
    emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
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
        create: jest.fn(({ data }) => Promise.resolve({ ...USER, ...data })),
        update: jest.fn(({ data }) => Promise.resolve({ ...USER, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      checkAndIncrementLoginAttempts: jest.fn().mockResolvedValue({ allowed: true }),
      clearLoginAttempts: jest.fn().mockResolvedValue(undefined),
      setEmailVerifyToken: jest.fn().mockResolvedValue(undefined),
      consumeEmailVerifyToken: jest.fn().mockResolvedValue(null),
      setPasswordResetToken: jest.fn().mockResolvedValue(undefined),
      consumePasswordResetToken: jest.fn().mockResolvedValue(null),
    };
    jwt = { sign: jest.fn().mockReturnValue("signed.jwt.token") };
    email = {
      sendOtpCode: jest.fn().mockResolvedValue(undefined),
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

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

  describe("email + password", () => {
    // A real bcrypt hash of "correct-horse" so login can actually compare.
    let hashOf: (pw: string) => Promise<string>;
    beforeAll(async () => {
      const bcrypt = await import("bcryptjs");
      hashOf = (pw: string) => bcrypt.hash(pw, 4); // low rounds = fast tests
    });

    describe("signup", () => {
      it("creates a new user with a hashed password and sends a verification email", async () => {
        prisma.user.findUnique.mockResolvedValue(null);
        await service.signup(EMAIL, "correct-horse");

        const created = prisma.user.create.mock.calls[0][0].data;
        expect(created.email).toBe(EMAIL);
        expect(created.passwordHash).toBeDefined();
        expect(created.passwordHash).not.toBe("correct-horse"); // hashed, not plaintext
        expect(created.emailVerifiedAt).toBeUndefined(); // starts unverified
        expect(email.sendVerificationEmail).toHaveBeenCalled();
      });

      it("is enumeration-safe: an existing email neither errors nor overwrites the password", async () => {
        prisma.user.findUnique.mockResolvedValue({ ...USER, passwordHash: "existing" });
        await expect(service.signup(EMAIL, "attacker-chosen")).resolves.toEqual({ ok: true });
        expect(prisma.user.create).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe("login", () => {
      it("issues tokens for a correct password on a verified account", async () => {
        prisma.user.findUnique.mockResolvedValue({
          ...USER,
          passwordHash: await hashOf("correct-horse"),
        });
        const result = await service.login(EMAIL, "correct-horse");
        expect(result.accessToken).toBeDefined();
        expect(result.user.hasPassword).toBe(true);
        expect(redis.clearLoginAttempts).toHaveBeenCalledWith(EMAIL);
      });

      it("rejects a wrong password with the same generic error as an unknown email", async () => {
        prisma.user.findUnique.mockResolvedValue({
          ...USER,
          passwordHash: await hashOf("correct-horse"),
        });
        await expect(service.login(EMAIL, "wrong")).rejects.toThrow("Invalid email or password.");

        prisma.user.findUnique.mockResolvedValue(null);
        await expect(service.login("nobody@example.com", "whatever")).rejects.toThrow(
          "Invalid email or password.",
        );
      });

      it("blocks login until the email is verified", async () => {
        prisma.user.findUnique.mockResolvedValue({
          ...USER,
          passwordHash: await hashOf("correct-horse"),
          emailVerifiedAt: null,
        });
        await expect(service.login(EMAIL, "correct-horse")).rejects.toThrow(/verify your email/i);
      });

      it("refuses once the per-email attempt lockout trips, without reading the user", async () => {
        redis.checkAndIncrementLoginAttempts.mockResolvedValue({ allowed: false });
        await expect(service.login(EMAIL, "correct-horse")).rejects.toThrow(/too many/i);
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
      });
    });

    describe("verifyEmail", () => {
      it("marks the account verified for a valid token and rejects an invalid one", async () => {
        redis.consumeEmailVerifyToken.mockResolvedValue(EMAIL);
        await expect(service.verifyEmail("good-token")).resolves.toEqual({ verified: true, email: EMAIL });
        expect(prisma.user.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { email: EMAIL, emailVerifiedAt: null } }),
        );

        redis.consumeEmailVerifyToken.mockResolvedValue(null);
        await expect(service.verifyEmail("bad-token")).rejects.toThrow(/invalid or has expired/i);
      });
    });

    describe("forgotPassword / resetPassword", () => {
      it("forgotPassword is enumeration-safe: same response whether or not the email exists", async () => {
        prisma.user.findUnique.mockResolvedValue(USER);
        await expect(service.forgotPassword(EMAIL)).resolves.toEqual({ ok: true });
        expect(email.sendPasswordResetEmail).toHaveBeenCalled();

        (email.sendPasswordResetEmail as jest.Mock).mockClear();
        prisma.user.findUnique.mockResolvedValue(null);
        await expect(service.forgotPassword("nobody@example.com")).resolves.toEqual({ ok: true });
        expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it("resetPassword sets a new hash, verifies the email, and kills every session; rejects a bad token", async () => {
        redis.consumePasswordResetToken.mockResolvedValue(USER.id);
        await expect(service.resetPassword("good-token", "new-password")).resolves.toEqual({ ok: true });
        const data = prisma.user.update.mock.calls.at(-1)![0].data;
        expect(data.passwordHash).toBeDefined();
        expect(data.emailVerifiedAt).toEqual({ set: expect.any(Date) });
        expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER.id } });

        redis.consumePasswordResetToken.mockResolvedValue(null);
        await expect(service.resetPassword("bad-token", "new-password")).rejects.toThrow(
          /invalid or has expired/i,
        );
      });
    });

    describe("setPassword (migration path for OTP accounts)", () => {
      it("sets a hashed password and reports hasPassword true", async () => {
        const result = await service.setPassword(USER.id, "brand-new-password");
        const data = prisma.user.update.mock.calls.at(-1)![0].data;
        expect(data.passwordHash).toBeDefined();
        expect(result.user.hasPassword).toBe(true);
      });
    });

    describe("verifyOtp verifies the email as a side effect", () => {
      it("sets emailVerifiedAt when an OTP login lands on an unverified account", async () => {
        prisma.user.findUnique.mockResolvedValue({ ...USER, emailVerifiedAt: null });
        await service.verifyOtp({ email: EMAIL, code: "123456" });
        expect(prisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }) }),
        );
      });
    });
  });
});
