import { Injectable } from '@nestjs/common';
import {
  RetailerAdapter,
  RetailerProduct,
  ShippingAddress,
  OrderResult,
  CancelResult,
  OrderStatusResult,
  OrderStatusValue,
  RetailerOrderError,
} from '../retailer.adapter';
import { MOCK_CATALOG } from './mock-catalog';

function randomAlphanumeric6(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface MockOrderRecord {
  status: OrderStatusValue;
  placedAt: Date;
}

@Injectable()
export class MockAdapter implements RetailerAdapter {
  readonly retailerKey = 'mock';

  private readonly orders = new Map<string, MockOrderRecord>();

  async searchProducts(
    keywords: string,
    budgetMinCents: number,
    budgetMaxCents: number,
  ): Promise<RetailerProduct[]> {
    // Simulated network delay: 1-3 seconds (per D-07)
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

    const lower = keywords.toLowerCase();
    const keywordMatches = MOCK_CATALOG.filter((p) => {
      const matchesKeyword =
        p.title.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower) ||
        p.retailerHint.toLowerCase().includes(lower);
      const inBudget =
        p.priceCents >= budgetMinCents && p.priceCents <= budgetMaxCents;
      return matchesKeyword && inBudget;
    });

    // Budget fallback: if no keyword matches, return all products in budget range
    const results =
      keywordMatches.length > 0
        ? keywordMatches
        : MOCK_CATALOG.filter(
            (p) =>
              p.priceCents >= budgetMinCents && p.priceCents <= budgetMaxCents,
          );

    return results.sort((a, b) => a.priceCents - b.priceCents);
  }

  async getProduct(productId: string): Promise<RetailerProduct> {
    const product = MOCK_CATALOG.find((p) => p.id === productId);
    if (!product) {
      throw new RetailerOrderError('Product not found', 'NOT_FOUND');
    }
    return product;
  }

  async placeOrder(
    product: RetailerProduct,
    shippingAddress: ShippingAddress,
    _stripePaymentIntentId: string,
  ): Promise<OrderResult> {
    // Simulated processing delay: 2-3 seconds
    await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));

    // 5% failure rate (per D-07)
    if (Math.random() < 0.05) {
      throw new RetailerOrderError('Mock: simulated order failure', 'MOCK_FAILURE');
    }

    // Suppress unused variable warning
    void shippingAddress;

    const retailerOrderId = `MOCK-${Date.now()}`;
    const confirmationNumber = `CONF-${randomAlphanumeric6()}`;

    this.orders.set(retailerOrderId, {
      status: 'ordered',
      placedAt: new Date(),
    });

    return {
      retailerOrderId,
      confirmationNumber,
      estimatedDeliveryDate: addDays(new Date(), product.estimatedDeliveryDays).toISOString(),
      actualPriceCents: product.priceCents,
    };
  }

  async cancelOrder(retailerOrderId: string): Promise<CancelResult> {
    const order = this.orders.get(retailerOrderId);
    if (!order) {
      // Order not in our map — allow cancel for unknown orders (may be pre-existing)
      return { success: true };
    }

    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (Date.now() - order.placedAt.getTime() >= twoHoursMs) {
      throw new RetailerOrderError('Cancel window expired', 'CANCEL_WINDOW_EXPIRED');
    }

    order.status = 'cancelled';
    return { success: true };
  }

  async getOrderStatus(retailerOrderId: string): Promise<OrderStatusResult> {
    const order = this.orders.get(retailerOrderId);
    if (!order) {
      return { status: 'pending' };
    }

    if (order.status === 'cancelled') {
      return { status: 'cancelled' };
    }

    const elapsed = Date.now() - order.placedAt.getTime();
    const oneHour = 60 * 60 * 1000;
    const fourHours = 4 * 60 * 60 * 1000;
    const twoDays = 2 * 24 * 60 * 60 * 1000;

    const trackingNumber = `MOCK-TRK-${retailerOrderId.slice(-6)}`;
    const trackingUrl = `https://track.mock.example/${trackingNumber}`;
    const carrierName = 'MockShip';

    if (elapsed > twoDays) {
      order.status = 'delivered';
      return { status: 'delivered', trackingNumber, trackingUrl, carrierName };
    }

    if (elapsed > fourHours) {
      order.status = 'shipped';
      return { status: 'shipped', trackingNumber, trackingUrl, carrierName };
    }

    if (elapsed > oneHour) {
      order.status = 'processing';
      return { status: 'processing' };
    }

    return { status: order.status };
  }
}
