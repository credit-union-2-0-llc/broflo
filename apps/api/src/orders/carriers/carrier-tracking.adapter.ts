export type NormalizedOrderStatus = "shipped" | "delivered" | "failed";

export interface CarrierTrackingResult {
  status: NormalizedOrderStatus;
  estimatedDeliveryDate?: Date;
  lastEventDescription?: string;
}

export interface CarrierTrackingAdapter {
  readonly carrierKey: string;
  isConfigured(): boolean;
  getTrackingStatus(trackingNumber: string): Promise<CarrierTrackingResult>;
}
