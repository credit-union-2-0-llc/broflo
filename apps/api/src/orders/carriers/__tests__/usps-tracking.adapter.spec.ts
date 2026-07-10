import { UspsTrackingAdapter } from "../usps-tracking.adapter";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("UspsTrackingAdapter", () => {
  let adapter: UspsTrackingAdapter;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    adapter = new UspsTrackingAdapter();
    mockFetch.mockReset();
    process.env.USPS_CONSUMER_KEY = "test-key";
    process.env.USPS_CONSUMER_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("isConfigured", () => {
    it("is true when both env vars are set", () => {
      expect(adapter.isConfigured()).toBe(true);
    });

    it("is false when either env var is missing", () => {
      delete process.env.USPS_CONSUMER_SECRET;
      expect(adapter.isConfigured()).toBe(false);
    });
  });

  describe("getTrackingStatus", () => {
    function mockTokenThenTracking(trackingBody: unknown, trackingOk = true) {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: "tok_123", expires_in: 28800 }),
        })
        .mockResolvedValueOnce({
          ok: trackingOk,
          status: trackingOk ? 200 : 500,
          json: async () => trackingBody,
          text: async () => "error body",
        });
    }

    it("fetches an OAuth token then the tracking status", async () => {
      mockTokenThenTracking({ status: "Delivered", statusSummary: "Delivered to front door" });

      const result = await adapter.getTrackingStatus("9400111202555842761234");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain("oauth2/v3/token");
      expect(mockFetch.mock.calls[1][0]).toContain("9400111202555842761234");
      expect(result.status).toBe("delivered");
      expect(result.lastEventDescription).toBe("Delivered to front door");
    });

    it("reuses a cached token across calls instead of re-fetching", async () => {
      mockTokenThenTracking({ status: "In Transit" });
      await adapter.getTrackingStatus("123");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "In Transit" }),
      });
      await adapter.getTrackingStatus("456");

      // 2 calls for the first (token + tracking), only 1 more for the second
      // (tracking only — token was cached).
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("maps a return/undeliverable status to failed", async () => {
      mockTokenThenTracking({ status: "Return to Sender" });
      const result = await adapter.getTrackingStatus("123");
      expect(result.status).toBe("failed");
    });

    it("defaults to shipped for an in-transit style status", async () => {
      mockTokenThenTracking({ status: "In Transit, Arriving Late" });
      const result = await adapter.getTrackingStatus("123");
      expect(result.status).toBe("shipped");
    });

    it("throws when the tracking request itself fails", async () => {
      mockTokenThenTracking({}, false);
      await expect(adapter.getTrackingStatus("123")).rejects.toThrow(/USPS tracking request failed/);
    });
  });
});
