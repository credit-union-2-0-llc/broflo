import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

type User = Prisma.UserGetPayload<Record<string, never>>;

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY', ''), {
      apiVersion: '2025-01-27.acacia',
    });
  }

  async getSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        subscriptionTier: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePaymentMethodId: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      tier: user.subscriptionTier,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripePaymentMethodId: user.stripePaymentMethodId,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
  }

  async createCheckoutSession(userId: string, tier: string, returnUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const validTiers = ['pro', 'family'];
    if (!validTiers.includes(tier)) {
      throw new BadRequestException(`Invalid tier: ${tier}`);
    }

    const priceId = this.getPriceIdForTier(tier);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?success=true`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: { userId, tier },
    });

    return { url: session.url };
  }

  async createPortalSession(userId: string, returnUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return { received: true };
  }

  async getServiceCredits(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { serviceCreditCents: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { serviceCreditCents: user.serviceCreditCents ?? 0 };
  }

  private getPriceIdForTier(tier: string): string {
    const priceMap: Record<string, string> = {
      pro: this.config.get<string>('STRIPE_PRO_PRICE_ID', 'price_pro'),
      family: this.config.get<string>('STRIPE_FAMILY_PRICE_ID', 'price_family'),
    };
    return priceMap[tier];
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier;

    if (!userId || !tier) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: session.subscription as string,
      },
    });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    const status = subscription.status;
    if (status === 'active' || status === 'trialing') {
      // subscription remains active
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: 'free' },
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: 'free', stripeSubscriptionId: null },
    });
  }

  // Used for internal type resolution of User shape from Prisma
  private _userTypeRef?: User;
}