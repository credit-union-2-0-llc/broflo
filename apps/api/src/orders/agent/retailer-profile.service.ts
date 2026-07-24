import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const CAPTCHA_DELIST_THRESHOLD = 0.3;
const SUCCESS_DELIST_THRESHOLD = 0.7;

// Explicit allowlist of retailers the browser agent may spend against.
// The target URL is user-supplied and the agent carries a funded Stripe
// Issuing virtual card, so an unknown / attacker-controlled domain must never
// be attempted (H2). Default-deny everything not listed here. Override the set
// with AGENT_RETAILER_ALLOWLIST (comma-separated apex domains).
const DEFAULT_ALLOWED_RETAILERS = [
  'amazon.com',
  'etsy.com',
  'target.com',
  'walmart.com',
  'bestbuy.com',
  'nordstrom.com',
  'uncommongoods.com',
  'rei.com',
  'wayfair.com',
  'sephora.com',
];

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '');
}

@Injectable()
export class RetailerProfileService {
  private readonly log = new Logger(RetailerProfileService.name);
  private readonly allowlist: string[];

  constructor(private readonly prisma: PrismaService) {
    const raw = process.env.AGENT_RETAILER_ALLOWLIST;
    this.allowlist = (raw ? raw.split(',') : DEFAULT_ALLOWED_RETAILERS)
      .map(normalizeDomain)
      .filter(Boolean);
  }

  /**
   * Whether a domain is on the retailer allowlist. Matches an apex exactly or
   * any subdomain of it (the leading "." prevents suffix-confusion attacks
   * such as `amazon.com.evil.com` or `evil-amazon.com`).
   */
  isAllowedRetailer(domain: string): boolean {
    const d = normalizeDomain(domain);
    return this.allowlist.some((apex) => d === apex || d.endsWith(`.${apex}`));
  }

  async isSupported(domain: string): Promise<boolean> {
    // Default-deny: only allowlisted retailers may ever be attempted.
    if (!this.isAllowedRetailer(domain)) return false;

    const profile = await this.prisma.retailerProfile.findUnique({
      where: { retailerDomain: domain },
    });
    // Allowlisted with no adverse history yet — allowed.
    if (!profile) return true;
    // Allowlisted but subject to the adaptive circuit breaker below.
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
