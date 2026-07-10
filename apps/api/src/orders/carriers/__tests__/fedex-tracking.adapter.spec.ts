import { FedexTrackingAdapter } from "../fedex-tracking.adapter";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("FedexTrackingAdapter", () => {
  let adapter: FedexTrackingAdapter;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    adapter = new FedexTrackingAdapter();
    mockFetch.mockReset();
    process.env.FEDEX_CLIENT_ID = "test-id";
    process.env.FEDEX_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("isConfigured", () => {
    it("is true when both env vars are set", () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it("is false when either env var is missing", () => {
      delete process.env.FEDEX_CLIENT_SECRET;
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe("getTrackingStatus", () => {
    function mockTokenThenTracking(trackResults: unknown[]) {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok_123", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            output: { completeTrackResults: [{ trackResults }] },
          }),
        });
    }

    it("sends a form-urlencoded OAuth body then a POST tracking request", async () => {
      mockTokenThenTracking([
        { latestStatusDetail: { code: "IT", description: "In transit" } },
      ]);

      await adapter.getTrackingStatus("999999999999");

      const oauthCall = mockFetch.mock.calls[0][1];
      expect(oauthCall.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(oauthCall.body).toContain("grant_type=client_credentials");

      const trackingCall = mockFetch.mock.calls[1][1];
      const body = JSON.parse(trackingCall.body);
      expect(body.trackingInfo[0].trackingNumberInfo.trackingNumber).toBe("999999999999");
    });

    it("maps status code DL to delivered", async () => {
      mockTokenThenTracking([{ latestStatusDetail: { code: "DL", description: "Delivered" } }]);
      const result = await adapter.getTrackingStatus("999999999999");
      expect(result.status).toBe("delivered");
      expect(result.lastEventDescription).toBe("Delivered");
    });

    it("maps status code DE/CA to failed", async () => {
      mockTokenThenTracking([{ latestStatusDetail: { code: "CA", description: "Cancelled" } }]);
      const result = await adapter.getTrackingStatus("999999999999");
      expect(result.status).toBe("failed");
    });

    it("extracts the ESTIMATED_DELIVERY dateAndTimes entry", async () => {
      mockTokenThenTracking([
        {
          latestStatusDetail: { code: "IT", description: "In transit" },
          dateAndTimes: [
            { type: "ACTUAL_PICKUP", dateTime: "2026-09-10T10:00:00Z" },
            { type: "ESTIMATED_DELIVERY", dateTime: "2026-09-15T00:00:00Z" },
          ],
        },
      ]);
      const result = await adapter.getTrackingStatus("999999999999");
      expect(result.estimatedDeliveryDate?.toISOString().slice(0, 10)).toBe("2026-09-15");
    });

    it("throws when the tracking request fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: 3600 }) })
        .mockResolvedValueOnce({ ok: false, status: 400 });

      await expect(adapter.getTrackingStatus("bogus")).rejects.toThrow(/FedEx tracking request failed/);
    });
  });
});
