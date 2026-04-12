export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface RetailerProduct {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  imageUrl: string | null;
  estimatedDeliveryDays: number;
  retailerHint: string;
}

export interface OrderResult {
  retailerOrderId: string;
  confirmationNumber: string;
  estimatedDeliveryDate: string; // ISO date string
  actualPriceCents: number;
}

export interface CancelResult {
  success: boolean;
  reason?: string;
}

export type OrderStatusValue =
  | 'pending'
  | 'ordered'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface OrderStatusResult {
  status: OrderStatusValue;
  trackingNumber?: string;
  trackingUrl?: string;
  carrierName?: string;
}

export class RetailerOrderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'RetailerOrderError';
  }
}

export interface RetailerAdapter {
  readonly retailerKey: string;
  searchProducts(
    keywords: string,
    budgetMinCents: number,
    budgetMaxCents: number,
  ): Promise<RetailerProduct[]>;
  getProduct(productId: string): Promise<RetailerProduct>;
  placeOrder(
    product: RetailerProduct,
    shippingAddress: ShippingAddress,
    stripePaymentIntentId: string,
  ): Promise<OrderResult>;
  cancelOrder(retailerOrderId: string): Promise<CancelResult>;
  getOrderStatus(retailerOrderId: string): Promise<OrderStatusResult>;
}
