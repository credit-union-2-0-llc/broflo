import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { RedisService } from "../redis/redis.service";
import type { User } from "@prisma/client";
import type { SendOtpDto, VerifyOtpDto } from "./dto/auth.dto";

const BCRYPT_ROUNDS = 12;

// A real bcrypt hash of a random string, used to equalize response time on the
// login path when the account doesn't exist or has no password — so an attacker
// can't distinguish "no such user" from "wrong password" by timing.
const DUMMY_HASH = bcrypt.hashSync("unused-timing-equalizer", BCRYPT_ROUNDS);

function webUrl(): string {
  return process.env.WEB_URL || "https://broflo.ai";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly redis: RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Email + password (primary)
  // ─────────────────────────────────────────────────────────────

  async signup(email: string, password: string): Promise<{ ok: true }> {
    const emailLower = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });

    // Enumeration-safe: always return the same shape. Never overwrite an
    // existing account's password here (that would be account takeover) — an
    // existing user who wants a password uses forgot-password instead. We just
    // (re)send a verification link for genuinely new, unverified accounts.
    if (existing) {
      if (!existing.emailVerifiedAt) {
        await this.sendVerification(emailLower);
      }
      return { ok: true };
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.user.create({
      data: { email: emailLower, passwordHash },
    });
    await this.sendVerification(emailLower);
    return { ok: true };
  }

  async login(email: string, password: string) {
    const emailLower = email.toLowerCase();

    // Per-email lockout on wrong attempts, independent of source IP.
    const attempt = await this.redis.checkAndIncrementLoginAttempts(emailLower);
    if (!attempt.allowed) {
      throw new UnauthorizedException(
        "Too many attempts. Wait a few minutes and try again.",
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: emailLower } });

    // Compare against a dummy hash when the user is missing / passwordless so
    // the timing is the same as a real wrong-password attempt (no enumeration).
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Verify-before-login: the account exists and the password is correct, so
    // telling them to verify is safe and actionable (not an enumeration leak).
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException(
        "Please verify your email first — check your inbox for the confirmation link.",
      );
    }

    await this.redis.clearLoginAttempts(emailLower);
    return this.issueTokens(user);
  }

  // Authenticated: set a password for the current account. This is the
  // migration path for accounts created via OTP (which have none) — the web app
  // forces them here on next sign-in — and doubles as change-password for a
  // logged-in user.
  async setPassword(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerifiedAt: { set: new Date() } },
    });
    return { user: this.userPayload(user) };
  }

  // ─────────────────────────────────────────────────────────────
  // Email verification
  // ─────────────────────────────────────────────────────────────

  private async sendVerification(emailLower: string): Promise<void> {
    const token = crypto.randomBytes(32).toString("hex");
    await this.redis.setEmailVerifyToken(token, emailLower);
    await this.email.sendVerificationEmail(
      emailLower,
      `${webUrl()}/verify-email?token=${token}`,
    );
  }

  async verifyEmail(token: string): Promise<{ verified: true; email: string }> {
    const emailLower = await this.redis.consumeEmailVerifyToken(token);
    if (!emailLower) {
      throw new BadRequestException("This link is invalid or has expired.");
    }
    await this.prisma.user.updateMany({
      where: { email: emailLower, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    return { verified: true, email: emailLower };
  }

  async resendVerification(email: string): Promise<{ ok: true }> {
    const emailLower = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: emailLower } });
    // Enumeration-safe: only actually send if the account exists and isn't
    // already verified, but always return the same response.
    if (user && !user.emailVerifiedAt) {
      await this.sendVerification(emailLower);
    }
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────
  // Password reset
  // ─────────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<{ ok: true }> {
    const emailLower = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await this.redis.setPasswordResetToken(token, user.id);
      await this.email.sendPasswordResetEmail(
        emailLower,
        `${webUrl()}/reset-password?token=${token}`,
      );
    }
    // Always the same response, whether or not the email exists.
    return { ok: true };
  }

  async resetPassword(token: string, password: string): Promise<{ ok: true }> {
    const userId = await this.redis.consumePasswordResetToken(token);
    if (!userId) {
      throw new BadRequestException("This reset link is invalid or has expired.");
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    // Resetting via an emailed link also proves email ownership, so mark
    // verified — this lets a never-verified account recover in one step.
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, emailVerifiedAt: { set: new Date() } },
    });
    // A password reset should end every existing session for that account.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────
  // OTP (kept as a fallback login: "email me a code instead")
  // ─────────────────────────────────────────────────────────────

  async sendOtp(
    dto: SendOtpDto,
    bypassRateLimit = false,
  ): Promise<{ sent: true; code?: string }> {
    const emailLower = dto.email.toLowerCase();

    if (!bypassRateLimit) {
      const rl = await this.redis.checkOtpRateLimit(emailLower);
      if (!rl.allowed) {
        throw new BadRequestException("Too many code requests. Try again in a few minutes.");
      }
    }

    const code = crypto.randomInt(100000, 999999).toString();
    await this.redis.setOtp(emailLower, code);
    await this.email.sendOtpCode(emailLower, code);

    // In test mode, return the code so E2E tests can use it
    if (process.env.NODE_ENV === "test") {
      return { sent: true, code };
    }

    return { sent: true };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const emailLower = dto.email.toLowerCase();

    // Per-email lockout on wrong guesses — independent of the per-IP
    // throttle on the controller, which a distributed attacker (many source
    // IPs) can route around entirely. Without this, a 6-digit code is only
    // ever protected by its 5-minute TTL, not by any real limit on attempts.
    const attempt = await this.redis.checkAndIncrementOtpVerifyAttempts(emailLower);
    if (!attempt.allowed) {
      throw new UnauthorizedException(
        "Too many incorrect attempts. Request a new code and try again.",
      );
    }

    const storedCode = await this.redis.getOtp(emailLower);
    if (!storedCode || storedCode !== dto.code) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    await this.redis.deleteOtp(emailLower);
    await this.redis.clearOtpVerifyAttempts(emailLower);

    let user = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { email: emailLower },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Receiving the code proves the person controls this inbox, so a
    // successful OTP login is itself email verification. This is what keeps
    // OTP-created and pre-existing accounts working under verify-before-login.
    if (!user.emailVerifiedAt) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    return this.issueTokens(user);
  }

  // ─────────────────────────────────────────────────────────────
  // Tokens / session (unchanged mechanics)
  // ─────────────────────────────────────────────────────────────

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private readonly REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Deliberately NOT single-use/rotated. NextAuth's JWT session strategy
    // means the refresh token lives in an encrypted cookie the browser
    // sends on every request — a single page load fires several requests
    // that all carry the SAME cookie snapshot, so more than one of them can
    // legitimately reach here with the same still-valid token before any
    // response has had a chance to hand back a new one. Rotating on every
    // use meant whichever request won invalidated the token out from under
    // every other concurrent request using that identical, still-good
    // cookie — which is exactly what was happening. Sliding the expiry
    // forward keeps long-idle tokens from accumulating forever without
    // that race.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS) },
    });

    return {
      accessToken: this.signAccessToken(stored.user),
      refreshToken,
      user: this.userPayload(stored.user),
    };
  }

  async logout(userId: string, jti: string, exp: number) {
    await this.prisma.revokedToken.create({
      data: {
        jti,
        expiresAt: new Date(exp * 1000),
      },
    });

    // Logout only has the access token's claims, not which specific refresh
    // token belongs to this device, so this still logs out every device —
    // same behavior as before. Narrowing this to just the current device
    // would need the client to also send its refresh token on logout.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private signAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, jti: uuidv4() };
    return this.jwt.sign(payload, { expiresIn: "15m" });
  }

  private userPayload(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscriptionTier: user.subscriptionTier,
      // Drives the "you must set a password" gate on the client.
      hasPassword: !!user.passwordHash,
    };
  }

  private async issueTokens(user: User) {
    const accessToken = this.signAccessToken(user);
    const refreshToken = uuidv4();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.userPayload(user),
    };
  }

  sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscriptionTier: user.subscriptionTier,
      hasPassword: !!user.passwordHash,
      createdAt: user.createdAt,
    };
  }
}
