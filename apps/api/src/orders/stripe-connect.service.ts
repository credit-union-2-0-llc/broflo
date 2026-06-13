import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2025-03-31.basil',
    });
  }

  getConnectedAccountId(retailerHint: string | null): string | null {
    if (!retailerHint) return null;
    const envKey = `STRIPE_CONNECTED_ACCOUNT_${retailerHint.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    return process.env[envKey] ?? null;
  }

  calculateFeeCents(amountCents: number, connectedAccountId: string | null): number {
    if (!connectedAccountId) return 0;
    return Math.round(amountCents * 0.02);
  }

  async createCharge(params: {
    amountCents: number;
    customerId: string;
    paymentMethodId: string;
    connectedAccountId: string | null;
    feeCents: number;
    metadata?: Record<string, string>;
  }): Promise<{ paymentIntentId: string }> {
    const { amountCents, customerId, paymentMethodId, connectedAccountId, feeCents, metadata } = params;

    const intentParams: Stripe.PaymentIntentCreateParams = {
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      metadata: metadata ?? {},
    };

    if (connectedAccountId && feeCents > 0) {
      intentParams.transfer_data = { destination: connectedAccountId };
      intentParams.application_fee_amount = feeCents;
    }

    const intent = await this.stripe.paymentIntents.create(intentParams);
    return { paymentIntentId: intent.id };
  }

  async refund(paymentIntentId: string, orderId: string): Promise<{ refundId: string }> {
    this.logger.log(`Initiating refund for paymentIntentId=${paymentIntentId} orderId=${orderId}`);

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      metadata: { orderId },
    });

    return { refundId: refund.id };
  }
}