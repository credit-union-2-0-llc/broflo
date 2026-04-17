import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';

export interface VirtualCard {
  cardId: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  spendingLimitCents: number;
}

@Injectable()
export class StripeIssuingService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly log = new Logger(StripeIssuingService.name);
  private readonly cardholderId: string;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      this.log.warn('STRIPE_SECRET_KEY not set — Issuing disabled');
    }
    this.stripe = new Stripe(key || '');
    // Broflo's Stripe Issuing cardholder (created once via Stripe dashboard)
    this.cardholderId = process.env.STRIPE_ISSUING_CARDHOLDER_ID || '';
  }

  /**
   * Create a single-use virtual card with an exact spending limit.
   * Card auto-expires after 24 hours. Used for browser agent purchases.
   *
   * The spending limit prevents the agent from spending more than the approved amount.
   * After the order is placed, the card should be cancelled.
   */
  async createVirtualCard(params: {
    amountCents: number;
    orderId: string;
    userId: string;
  }): Promise<VirtualCard> {
    this.log.log(
      `Creating virtual card: ${params.amountCents}c for order ${params.orderId}`,
    );

    if (!this.cardholderId) {
      this.log.warn('No cardholder ID — returning mock virtual card');
      return {
        cardId: `mock_card_${params.orderId}`,
        cardNumber: '4242424242424242',
        expMonth: 12,
        expYear: 2027,
        cvc: '123',
        spendingLimitCents: params.amountCents,
      };
    }

    const card = await this.stripe.issuing.cards.create({
      cardholder: this.cardholderId,
      type: 'virtual',
      currency: 'usd',
      status: 'active',
      spending_controls: {
        spending_limits: [
          {
            amount: params.amountCents,
            interval: 'all_time',
          },
        ],
      },
      metadata: {
        brofloOrderId: params.orderId,
        brofloUserId: params.userId,
        purpose: 'browser_agent_purchase',
      },
    });

    // Retrieve the full card details (number, CVC)
    const details = await this.stripe.issuing.cards.retrieve(card.id, {
      expand: ['number', 'cvc'],
    });

    this.log.log(`Virtual card created: ${card.id}`);

    return {
      cardId: card.id,
      cardNumber: (details as unknown as { number: string }).number,
      expMonth: card.exp_month,
      expYear: card.exp_year,
      cvc: (details as unknown as { cvc: string }).cvc,
      spendingLimitCents: params.amountCents,
    };
  }

  /**
   * Cancel a virtual card after use or on agent failure.
   */
  async cancelCard(cardId: string): Promise<void> {
    if (cardId.startsWith('mock_card_')) {
      this.log.log(`Mock card cancelled: ${cardId}`);
      return;
    }

    try {
      await this.stripe.issuing.cards.update(cardId, { status: 'canceled' });
      this.log.log(`Virtual card cancelled: ${cardId}`);
    } catch (err) {
      this.log.error(`Failed to cancel card ${cardId}: ${err}`);
    }
  }
}
