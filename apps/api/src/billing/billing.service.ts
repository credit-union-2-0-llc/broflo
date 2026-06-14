import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';

// We reference the Prisma-generated User shape via PrismaService to avoid
// importing 'User' directly from '@prisma/client' (which may not export it
// under that name depending on the generated client version).
type BillingUser = {
  id: string;
  email: string;
  subscriptionTier: string;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  stripeSubscriptionId: string | null;
  stripeCurrentPeriodEnd: Date | null;
};

@Injectable()
export class BillingService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
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
        stripePaymentMethodId: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      tier: user.subscriptionTier,
      stripeCustomerId: user.stripeCustomerId,
      stripePaymentMethodId: user.stripePaymentMethodId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
    };
  }

  async createCheckoutSession(userId: string, tier: string): Promise<{ url: string }> {
    if (!['pro', 'premium'].includes(tier)) {
      throw new BadRequestException(`Invalid tier: ${tier}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const priceId = tier === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_PREMIUM_PRICE_ID;

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.WEB_URL}/billing?success=true`,
      cancel_url: `${process.env.WEB_URL}/billing?cancelled=true`,
    });

    return { url: session.url ?? '' };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET ?? '',
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        break;
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    const priceId = subscription.items.data[0]?.price?.id;
    let tier = 'free';
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) tier = 'pro';
    if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) tier = 'premium';

    const periodEnd = new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: subscription.id,
        stripeCurrentPeriodEnd: periodEnd,
      },
    });

    if (user.subscriptionTier !== tier) {
      await this.notifications.create(user.id, {
        type: 'subscription_updated',
        title: 'Subscription updated',
        body: `Your plan has been updated to ${tier}.`,
      });
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'free',
        stripeSubscriptionId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    await this.notifications.create(user.id, {
      type: 'subscription_cancelled',
      title: 'Subscription cancelled',
      body: 'Your subscription has been cancelled. You are now on the free plan.',
    });
  }

  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeSubscriptionId: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription to cancel');
    }

    await this.stripe.subscriptions.cancel(user.stripeSubscriptionId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'free',
        stripeSubscriptionId: null,
        stripeCurrentPeriodEnd: null,
      },
    });

    return { message: 'Subscription cancelled successfully' };
  }

  async attachPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email });
      customerId = customer.id;
    }

    await this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customerId,
        stripePaymentMethodId: paymentMethodId,
      },
    });
  }

  async getServiceCreditBalance(userId: string): Promise<{ balanceCents: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Service credit balance is tracked via autopilot runs
    const result = await this.prisma.autopilotRun.aggregate({
      where: {
        rule: { userId },
        status: 'completed',
      },
      _sum: { amountCents: true },
    });

    return { balanceCents: result._sum.amountCents ?? 0 };
  }
}