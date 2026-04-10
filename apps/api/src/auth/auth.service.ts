import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import type { User } from "@prisma/client";
import type {
  SignupDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 30;
const RESET_TOKEN_HOURS = 1;
const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("Email already registered");
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        passwordHash,
      },
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account locked. Try again in ${minutesLeft} minute(s).`,
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        "This account uses Google sign-in. Please log in with Google.",
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      // Increment failed logins
      const failedLogins = user.failedLogins + 1;
      const lockedUntil =
        failedLogins >= LOCKOUT_THRESHOLD
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins, lockedUntil },
      });

      throw new UnauthorizedException("Invalid credentials");
    }

    // Reset failed logins on success
    if (user.failedLogins > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Rotation: issueTokens generates a new refresh token and persists it,
    // so the old refresh token is automatically invalidated.
    return this.issueTokens(user);
  }

  async logout(userId: string, jti: string, exp: number) {
    // Revoke the current access token
    await this.prisma.revokedToken.create({
      data: {
        jti,
        expiresAt: new Date(exp * 1000),
      },
    });

    // Clear refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) return;

    const resetToken = uuidv4();
    const resetTokenExpires = new Date(
      Date.now() + RESET_TOKEN_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    await this.email.sendPasswordReset(user.email, resetToken);
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: dto.token },
    });

    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    return { message: "Password reset successful" };
  }

  async issueTokensForOAuthUser(user: User) {
    return this.issueTokens(user);
  }

  private async issueTokens(user: User) {
    const jti = uuidv4();
    const payload = { sub: user.id, email: user.email, jti };

    const accessToken = this.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = uuidv4();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        subscriptionTier: user.subscriptionTier,
        brofloScore: user.brofloScore,
      },
    };
  }

  sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscriptionTier: user.subscriptionTier,
      brofloScore: user.brofloScore,
      createdAt: user.createdAt,
    };
  }
}
