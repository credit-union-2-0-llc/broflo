import { Injectable, Logger } from "@nestjs/common";
import type { CarrierTrackingAdapter, CarrierTrackingResult } from "./carrier-tracking.adapter";
import { OAuthClientCredentialsCache } from "./oauth-client-credentials-cache";

const USPS_OAUTH_URL = "https://apis.usps.com/oauth2/v3/token";
const USPS_TRACKING_URL = "https://apis.usps.com/tracking/v3/tracking";

// USPS's 2026 API caps at 60 requests/hour — see order-polling.scheduler.ts's
// per-run cap, which is the real enforcement point; this adapter just makes
// the calls it's told to.
@Injectable()
export class UspsTrackingAdapter implements CarrierTrackingAdapter {
  readonly carrierKey = "usps";
  private readonly log = new Logger(UspsTrackingAdapter.name);
  private readonly tokenCache = new OAuthClientCredentialsCache(() => this.fetchToken());

  isConfigured(): boolean {
    return !!(process.env.USPS_CONSUMER_KEY && process.env.USPS_CONSUMER_SECRET);
  }

  private async fetchToken(): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const res = await fetch(USPS_OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: process.env.USPS_CONSUMER_KEY,
        client_secret: process.env.USPS_CONSUMER_SECRET,
      }),
    });
    if (!res.ok) {
      this.log.error(`USPS OAuth token request failed: ${res.status} ${await res.text().catch(() => "")}`);
      throw new Error(`USPS OAuth token request failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  }

  async getTrackingStatus(trackingNumber: string): Promise<CarrierTrackingResult> {
    const token = await this.tokenCache.getToken();
    const res = await fetch(`${USPS_TRACKING_URL}/${encodeURIComponent(trackingNumber)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      this.log.error(`USPS tracking request failed for ${trackingNumber}: ${res.status}`);
      throw new Error(`USPS tracking request failed: ${res.status}`);
    }

    // Response shape per USPS's published docs — verify field names against
    // a real sandbox response once credentials exist; this is our best
    // understanding from documentation, not yet confirmed live.
    const data = (await res.json()) as {
      status?: string;
      statusCategory?: string;
      expectedDeliveryDate?: string;
      statusSummary?: string;
    };

    return {
      status: this.mapStatus(data.status ?? data.statusCategory ?? ""),
      estimatedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      lastEventDescription: data.statusSummary,
    };
  }

  private mapStatus(rawStatus: string): CarrierTrackingResult["status"] {
    const s = rawStatus.toLowerCase();
    if (s.includes("delivered")) return "delivered";
    if (s.includes("return") || s.includes("undeliverable") || s.includes("unclaimed")) return "failed";
    return "shipped";
  }
}
