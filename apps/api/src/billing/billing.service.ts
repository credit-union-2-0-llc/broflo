import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../prisma/prisma.service";
import type { User } from "@prisma/client";

type StripeInstance = InstanceType<typeof Stripe>;

@Injectable()
export class BillingService {
  private stripeClient: StripeInstance | null = null;
  private readonly log = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {
    if (!process.env.STRIPE_SECRET_KEY) {
      this.log.warn("STRIPE_SECRET_KEY not set — billing disabled");
    }
  }

  private get stripe(): StripeInstance {
    if (!this.stripeClient) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new Error("STRIPE_SECRET_KEY is not configured — billing unavailable");
      }
      this.stripeClient = new Stripe(key);
    }
    return this.stripeClient;
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { brofloUserId: user.id },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(
    user: User,
    priceId: string,
  ): Promise<{ url: string }> {
    const customerId = await this.getOrCreateCustomer(user);

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.WEB_URL || "http://localhost:3000"}/billing?success=true`,
      cancel_url: `${process.env.WEB_URL || "http://localhost:3000"}/upgrade?canceled=true`,
      subscription_data: {
        metadata: { brofloUserId: user.id },
      },
      payment_method_collection: "always",
    });

    if (!session.url) {
      throw new InternalServerErrorException("Stripe returned no checkout URL");
    }

    return { url: session.url };
  }

  async createPortalSession(user: User): Promise<{ url: string }> {
    if (!user.stripeCustomerId) {
      throw new BadRequestException("No billing account found");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.WEB_URL || "http://localhost:3000"}/billing`,
    });

    return { url: session.url };
  }

  async getSubscription(user: User) {
    return {
      subscriptionTier: user.subscriptionTier,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeCustomerId: user.stripeCustomerId,
      hasPaymentMethod: !!user.stripePaymentMethodId,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private webhookEvent(rawBody: Buffer, signature: string, secret: string): any {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new InternalServerErrorException("Webhook secret not configured");
    }

    let event: { type: string; id: string; data: { object: Record<string, unknown> } };
    try {
      event = this.webhookEvent(rawBody, signature, secret);
    } catch (err) {
      this.log.error(`Webhook signature verification failed: ${err}`);
      throw new BadRequestException("Invalid webhook signature");
    }

    this.log.log(`Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object);
        break;
      default:
        this.log.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(
    session: Record<string, unknown>,
  ) {
    const userId = session.subscription
      ? (
          await this.stripe.subscriptions.retrieve(
            session.subscription as string,
          )
        ).metadata?.brofloUserId
      : (session.metadata as Record<string, string> | undefined)?.brofloUserId;

    if (!userId) {
      this.log.warn("checkout.session.completed: no brofloUserId in metadata");
      return;
    }

    const subscriptionId = session.subscription as string;
    const subscription = await this.stripe.subscriptions.retrieve(
      subscriptionId,
      { expand: ["default_payment_method"] },
    );

    const tier = this.tierFromPriceId(
      subscription.items.data[0]?.price?.id,
    );

    const pm = subscription.default_payment_method;
    const paymentMethodId = typeof pm === "object" && pm !== null
      ? (pm as { id: string }).id
      : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: session.customer as string,
        stripePaymentMethodId: paymentMethodId,
      },
    });

    this.log.log(`User ${userId} upgraded to ${tier}`);
  }

  private async handleSubscriptionUpdated(
    sub: Record<string, unknown>,
  ) {
    const metadata = sub.metadata as Record<string, string> | undefined;
    const userId = metadata?.brofloUserId;
    if (!userId) return;

    const items = sub.items as { data: Array<{ price?: { id: string } }> };
    const tier = this.tierFromPriceId(items?.data[0]?.price?.id);

    const expanded = await this.stripe.subscriptions.retrieve(
      sub.id as string,
      { expand: ["default_payment_method"] },
    );
    const pm = expanded.default_payment_method;
    const paymentMethodId = typeof pm === "object" && pm !== null
      ? (pm as { id: string }).id
      : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: tier,
        stripeSubscriptionId: sub.id as string,
        stripePaymentMethodId: paymentMethodId,
      },
    });

    this.log.log(`User ${userId} subscription updated → ${tier}`);
  }

  private async handleSubscriptionDeleted(
    sub: Record<string, unknown>,
  ) {
    const metadata = sub.metadata as Record<string, string> | undefined;
    const userId = metadata?.brofloUserId;
    if (!userId) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripePaymentMethodId: null,
      },
    });

    this.log.log(`User ${userId} subscription canceled → free`);
  }

  private async handlePaymentFailed(invoice: Record<string, unknown>) {
    const customerId = invoice.customer as string;
    if (!customerId) return;

    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.log.warn(`payment_failed: no user for customer ${customerId}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { subscriptionTier: "free" },
    });

    this.log.warn(`User ${user.id} payment failed → downgraded to free`);
    // TODO: Send notification email via Resend
  }

  private tierFromPriceId(priceId: string | undefined): string {
    if (!priceId) return "free";

    const proMonthly = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    const proAnnual = process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
    const eliteMonthly = process.env.STRIPE_ELITE_MONTHLY_PRICE_ID;
    const eliteAnnual = process.env.STRIPE_ELITE_ANNUAL_PRICE_ID;

    if (priceId === proMonthly || priceId === proAnnual) return "pro";
    if (priceId === eliteMonthly || priceId === eliteAnnual) return "elite";

    this.log.warn(`Unknown price ID: ${priceId} — defaulting to pro`);
    return "pro";
  }
}
