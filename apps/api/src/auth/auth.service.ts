import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EmailService } from '../email/email.service';
import { createHash, randomInt } from 'crypto';

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_LENGTH = 6;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}

  async requestOtp(email: string): Promise<{ message: string }> {
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Invalid email address');
    }

    const otp = String(randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
    const key = `otp:${email}`;

    await this.redis.setex(key, OTP_TTL_SECONDS, otp);
    await this.email.send(email, `Your broflo code: ${otp}`);

    return { message: 'OTP sent' };
  }

  async verifyOtp(email: string, otp: string): Promise<{ accessToken: string; refreshToken: string }> {
    const key = `otp:${email}`;
    const stored = await this.redis.get(key);

    if (!stored || stored !== otp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.redis.del(key);

    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          subscriptionTier: 'free',
        },
      });
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const rawRefresh = this.jwt.sign(payload, { expiresIn: '30d' });
    const hashedRefresh = hashToken(rawRefresh);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: hashedRefresh },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  async refreshTokens(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: string; email: string };
    try {
      payload = this.jwt.verify(refreshToken) as { sub: string; email: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('User not found or session expired');
    }

    const hashed = hashToken(refreshToken);
    if (hashed !== user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '15m' },
    );

    return { accessToken };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { message: 'Logged out' };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}