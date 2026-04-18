import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const TIER_PRICES_CENTS: Record<string, number> = {
  pro: 999,
  elite: 2499,
};

@Injectable()
export class ServiceCreditService {
  private readonly log = new Logger(ServiceCreditService.name);
  private stripeClient: InstanceType<typeof Stripe> | null = null;

  constructor(private readonly prisma: PrismaService) {
    if (!process.env.STRIPE_SECRET_KEY) {
      this.log.warn('STRIPE_SECRET_KEY not set — service credits disabled');
    }
  }

  private get stripe(): InstanceType<typeof Stripe> {
    if (!this.stripeClient) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error('STRIPE_SECRET_KEY is not configured — service credits unavailable');
      }
      this.stripeClient = new Stripe(key);
    }
    return this.stripeClient;
  }

  /**
   * Issue a service credit when a browser agent order fails.
   * One credit per user per billing cycle (month). Auto-applied — no support ticket.
   */
  async issueCredit(user: User, agentJobId: string, reason: string): Promise<boolean> {
    const billingCycleKey = this._currentCycleKey();
    const amountCents = TIER_PRICES_CENTS[user.subscriptionTier] || 0;

    if (!amountCents) {
      this.log.debug('No credit for free tier user %s', user.id);
      return false;
    }

    // Check if credit already issued this billing cycle
    const existing = await this.prisma.serviceCredit.findUnique({
      where: {
        uq_service_credit_user_cycle: {
          userId: user.id,
          billingCycleKey,
        },
      },
    });

    if (existing) {
      this.log.debug('Credit already issued for user %s in cycle %s', user.id, billingCycleKey);
      return false;
    }

    let stripeTxnId: string | null = null;
    if (user.stripeCustomerId) {
      try {
        const txn = await this.stripe.customers.createBalanceTransaction(
          user.stripeCustomerId,
          {
            amount: -amountCents,
            currency: 'usd',
            description: `Broflo service credit: ${reason}`,
          },
        );
        stripeTxnId = txn.id;
      } catch (err) {
        this.log.error('Failed to apply Stripe balance credit for user %s: %s', user.id, err);
      }
    }

    await this.prisma.serviceCredit.create({
      data: {
        userId: user.id,
        agentJobId,
        amountCents,
        reason: `Agent order failed: ${reason}`,
        billingCycleKey,
        stripeCouponId: stripeTxnId,
      },
    });

    this.log.log(
      'Service credit issued: $%s for user %s (cycle: %s, reason: %s)',
      (amountCents / 100).toFixed(2),
      user.id,
      billingCycleKey,
      reason,
    );

    return true;
  }

  async getCredits(userId: string) {
    return this.prisma.serviceCredit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12, // Last 12 months
    });
  }

  private _currentCycleKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
