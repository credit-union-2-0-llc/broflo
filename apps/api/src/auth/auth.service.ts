import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { RedisService } from "../redis/redis.service";
import type { User } from "@prisma/client";
import type { SendOtpDto, VerifyOtpDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly redis: RedisService,
  ) {}

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

    const storedCode = await this.redis.getOtp(emailLower);
    if (!storedCode || storedCode !== dto.code) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    await this.redis.deleteOtp(emailLower);

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

    return this.issueTokens(user);
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const user = await this.prisma.user.findFirst({
      where: { refreshTokenHash: hash },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return this.issueTokens(user);
  }

  async logout(userId: string, jti: string, exp: number) {
    await this.prisma.revokedToken.create({
      data: {
        jti,
        expiresAt: new Date(exp * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
  }

  private async issueTokens(user: User) {
    const jti = uuidv4();
    const payload = { sub: user.id, email: user.email, jti };

    const accessToken = this.jwt.sign(payload, { expiresIn: "15m" });
    const refreshToken = uuidv4();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: this.hashToken(refreshToken) },
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
