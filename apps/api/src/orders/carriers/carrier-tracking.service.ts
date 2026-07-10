import { Injectable } from "@nestjs/common";
import type { CarrierKey } from "./carrier-detection.service";
import type { CarrierTrackingAdapter } from "./carrier-tracking.adapter";
import { UspsTrackingAdapter } from "./usps-tracking.adapter";
import { UpsTrackingAdapter } from "./ups-tracking.adapter";
import { FedexTrackingAdapter } from "./fedex-tracking.adapter";

@Injectable()
export class CarrierTrackingService {
  private readonly adapters: Record<CarrierKey, CarrierTrackingAdapter>;

  constructor(
    usps: UspsTrackingAdapter,
    ups: UpsTrackingAdapter,
    fedex: FedexTrackingAdapter,
  ) {
    this.adapters = { usps, ups, fedex };
  }

  // Returns null for an unknown key or a carrier with no credentials
  // configured — callers treat both as "can't track this one right now".
  getAdapter(carrierKey: string): CarrierTrackingAdapter | null {
    const adapter = this.adapters[carrierKey as CarrierKey];
    if (!adapter || !adapter.isConfigured()) return null;
    return adapter;
  }

  getConfiguredCarrierKeys(): CarrierKey[] {
    return (Object.keys(this.adapters) as CarrierKey[]).filter((key) =>
      this.adapters[key].isConfigured(),
    );
  }
}
