import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CAPTCHA_DELIST_THRESHOLD = 0.3;
const SUCCESS_DELIST_THRESHOLD = 0.7;

@Injectable()
export class RetailerProfileService {
  private readonly log = new Logger(RetailerProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async isSupported(domain: string): Promise<boolean> {
    const profile = await this.prisma.retailerProfile.findUnique({
      where: { retailerDomain: domain },
    });
    // Unknown retailers are allowed (we try them)
    if (!profile) return true;
    return profile.supported && !profile.blockedSince;
  }

  async recordAttempt(domain: string, success: boolean, captchaEncountered: boolean): Promise<void> {
    const profile = await this.prisma.retailerProfile.upsert({
      where: { retailerDomain: domain },
      create: {
        retailerDomain: domain,
        displayName: domain,
        totalAttempts: 1,
        totalSuccesses: success ? 1 : 0,
        captchaRate: captchaEncountered ? 1 : 0,
        successRate: success ? 1 : 0,
        lastAttemptAt: new Date(),
      },
      update: {
        totalAttempts: { increment: 1 },
        totalSuccesses: success ? { increment: 1 } : undefined,
        lastAttemptAt: new Date(),
      },
    });

    // Recalculate rolling rates
    const total = profile.totalAttempts;
    if (total < 5) return; // Not enough data for circuit breaker

    const newSuccessRate = profile.totalSuccesses / total;

    // Count captcha encounters from recent agent jobs
    const recentJobs = await this.prisma.agentJob.count({
      where: {
        retailerDomain: domain,
        failureReason: 'captcha',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    const recentTotal = await this.prisma.agentJob.count({
      where: {
        retailerDomain: domain,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    const newCaptchaRate = recentTotal > 0 ? recentJobs / recentTotal : 0;

    const shouldDelist =
      newCaptchaRate > CAPTCHA_DELIST_THRESHOLD ||
      newSuccessRate < SUCCESS_DELIST_THRESHOLD;

    await this.prisma.retailerProfile.update({
      where: { retailerDomain: domain },
      data: {
        successRate: newSuccessRate,
        captchaRate: newCaptchaRate,
        supported: !shouldDelist,
        blockedSince: shouldDelist ? new Date() : null,
      },
    });

    if (shouldDelist) {
      this.log.warn(
        `Retailer ${domain} auto-delisted: captchaRate=${newCaptchaRate.toFixed(2)}, successRate=${newSuccessRate.toFixed(2)}`,
      );
    }
  }
}
