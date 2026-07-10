import { UpsTrackingAdapter } from "../ups-tracking.adapter";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("UpsTrackingAdapter", () => {
  let adapter: UpsTrackingAdapter;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    adapter = new UpsTrackingAdapter();
    mockFetch.mockReset();
    process.env.UPS_CLIENT_ID = "test-id";
    process.env.UPS_CLIENT_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("isConfigured", () => {
    it("is true when both env vars are set", () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it("is false when either env var is missing", () => {
      delete process.env.UPS_CLIENT_ID;
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe("getTrackingStatus", () => {
    function mockTokenThenTracking(trackResponse: unknown) {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok_123", expires_in: "3599" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ trackResponse }),
        });
    }

    it("sends Basic auth for the OAuth request", async () => {
      mockTokenThenTracking({
        shipment: [{ package: [{ activity: [{ status: { type: "I", description: "In transit" } }] }] }],
      });

      await adapter.getTrackingStatus("1Z999AA10123456784");

      const oauthCall = mockFetch.mock.calls[0][1];
      expect(oauthCall.headers.Authorization).toMatch(/^Basic /);
      expect(oauthCall.body).toBe("grant_type=client_credentials");
    });

    it("maps status type D to delivered and parses the delivery date", async () => {
      mockTokenThenTracking({
        shipment: [
          {
            package: [
              {
                activity: [{ status: { type: "D", description: "Delivered" } }],
                deliveryDate: [{ date: "20260915" }],
              },
            ],
          },
        ],
      });

      const result = await adapter.getTrackingStatus("1Z999AA10123456784");

      expect(result.status).toBe("delivered");
      expect(result.estimatedDeliveryDate?.toISOString().slice(0, 10)).toBe("2026-09-15");
    });

    it("maps an exception status to failed", async () => {
      mockTokenThenTracking({
        shipment: [{ package: [{ activity: [{ status: { type: "X", description: "Exception" } }] }] }],
      });
      const result = await adapter.getTrackingStatus("1Z999AA10123456784");
      expect(result.status).toBe("failed");
    });

    it("throws when the tracking request fails", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "tok", expires_in: "3599" }) })
        .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "not found" });

      await expect(adapter.getTrackingStatus("bogus")).rejects.toThrow(/UPS tracking request failed/);
    });
  });
});
