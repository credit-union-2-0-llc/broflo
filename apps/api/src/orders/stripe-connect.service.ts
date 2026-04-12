import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

type StripeInstance = InstanceType<typeof Stripe>;

export interface ChargeResult {
  paymentIntentId: string;
  status: string;
}

@Injectable()
export class StripeConnectService {
  private readonly stripe: StripeInstance;
  private readonly log = new Logger(StripeConnectService.name);
  private readonly platformFeeBps: number;
  private readonly mockRetailerAccountId: string;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      this.log.warn('STRIPE_SECRET_KEY not set — Connect charges disabled');
    }
    this.stripe = new Stripe(key || 'sk_test_placeholder');
    this.platformFeeBps = parseInt(process.env.STRIPE_PLATFORM_FEE_BPS || '500', 10); // 500 bps = 5%
    this.mockRetailerAccountId = process.env.STRIPE_MOCK_RETAILER_ACCOUNT_ID || '';
  }

  /**
   * Resolve the Stripe connected account ID for a given retailer key.
   * For MVP, only 'mock' is supported and maps to the test connected account.
   */
  getConnectedAccountId(retailerKey: string): string | null {
    if (retailerKey === 'mock') {
      return this.mockRetailerAccountId || null;
    }
    // Future: look up retailer -> connected account mapping
    return null;
  }

  /**
   * Create a PaymentIntent with destination charge to the retailer's connected account.
   * Uses idempotencyKey to prevent double charges on retry.
   *
   * Per Stripe docs (destination charges):
   * - transfer_data.destination routes funds to connected account
   * - application_fee_amount deducts Broflo's platform fee
   */
  async createCharge(params: {
    amountCents: number;
    customerId: string;
    paymentMethodId: string;
    connectedAccountId: string;
    orderId: string;
    userId: string;
  }): Promise<ChargeResult> {
    const feeAmount = Math.round((params.amountCents * this.platformFeeBps) / 10000);

    this.log.log(
      `Creating charge: ${params.amountCents}c, fee: ${feeAmount}c, dest: ${params.connectedAccountId}, order: ${params.orderId}`,
    );

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: params.amountCents,
        currency: 'usd',
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        transfer_data: {
          destination: params.connectedAccountId,
        },
        application_fee_amount: feeAmount,
        metadata: {
          brofloOrderId: params.orderId,
          brofloUserId: params.userId,
        },
      },
      {
        idempotencyKey: `order-${params.orderId}`,
      },
    );

    this.log.log(`PaymentIntent created: ${paymentIntent.id}, status: ${paymentIntent.status}`);

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    };
  }

  /**
   * Refund a PaymentIntent and reverse the transfer to the connected account.
   * Per Stripe docs: reverse_transfer: true pulls funds back from connected account.
   */
  async refund(paymentIntentId: string, orderId: string): Promise<{ refundId: string }> {
    this.log.log(`Refunding PaymentIntent: ${paymentIntentId} for order: ${orderId}`);

    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      reverse_transfer: true,
    });

    this.log.log(`Refund created: ${refund.id}, status: ${refund.status}`);

    return { refundId: refund.id };
  }

  /**
   * Calculate the platform fee in cents for a given amount.
   */
  calculateFeeCents(amountCents: number): number {
    return Math.round((amountCents * this.platformFeeBps) / 10000);
  }
}
