import { CarrierTrackingService } from "../carrier-tracking.service";
import { UspsTrackingAdapter } from "../usps-tracking.adapter";
import { UpsTrackingAdapter } from "../ups-tracking.adapter";
import { FedexTrackingAdapter } from "../fedex-tracking.adapter";

describe("CarrierTrackingService", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function buildService() {
    return new CarrierTrackingService(
      new UspsTrackingAdapter(),
      new UpsTrackingAdapter(),
      new FedexTrackingAdapter(),
    );
  }

  it("returns null for an unconfigured carrier", () => {
    delete process.env.USPS_CONSUMER_KEY;
    delete process.env.USPS_CONSUMER_SECRET;
    const service = buildService();
    expect(service.getAdapter("usps")).toBeNull();
  });

  it("returns null for an unknown carrier key", () => {
    const service = buildService();
    expect(service.getAdapter("dhl")).toBeNull();
  });

  it("returns the adapter once its env vars are configured", () => {
    process.env.UPS_CLIENT_ID = "id";
    process.env.UPS_CLIENT_SECRET = "secret";
    const service = buildService();
    expect(service.getAdapter("ups")).toBeInstanceOf(UpsTrackingAdapter);
  });

  it("getConfiguredCarrierKeys reflects only configured carriers", () => {
    delete process.env.USPS_CONSUMER_KEY;
    delete process.env.USPS_CONSUMER_SECRET;
    delete process.env.UPS_CLIENT_ID;
    delete process.env.UPS_CLIENT_SECRET;
    process.env.FEDEX_CLIENT_ID = "id";
    process.env.FEDEX_CLIENT_SECRET = "secret";

    const service = buildService();
    expect(service.getConfiguredCarrierKeys()).toEqual(["fedex"]);
  });
});
