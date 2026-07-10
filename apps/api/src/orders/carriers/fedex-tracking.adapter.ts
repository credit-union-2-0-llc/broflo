import { Injectable, Logger } from "@nestjs/common";
import type { CarrierTrackingAdapter, CarrierTrackingResult } from "./carrier-tracking.adapter";
import { OAuthClientCredentialsCache } from "./oauth-client-credentials-cache";

const FEDEX_OAUTH_URL = "https://apis.fedex.com/oauth/token";
const FEDEX_TRACKING_URL = "https://apis.fedex.com/track/v1/trackingnumbers";

@Injectable()
export class FedexTrackingAdapter implements CarrierTrackingAdapter {
  readonly carrierKey = "fedex";
  private readonly log = new Logger(FedexTrackingAdapter.name);
  private readonly tokenCache = new OAuthClientCredentialsCache(() => this.fetchToken());

  isConfigured(): boolean {
    return !!(process.env.FEDEX_CLIENT_ID && process.env.FEDEX_CLIENT_SECRET);
  }

  private async fetchToken(): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const res = await fetch(FEDEX_OAUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.FEDEX_CLIENT_ID ?? "",
        client_secret: process.env.FEDEX_CLIENT_SECRET ?? "",
      }).toString(),
    });
    if (!res.ok) {
      this.log.error(`FedEx OAuth token request failed: ${res.status} ${await res.text().catch(() => "")}`);
      throw new Error(`FedEx OAuth token request failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  }

  async getTrackingStatus(trackingNumber: string): Promise<CarrierTrackingResult> {
    const token = await this.tokenCache.getToken();
    const res = await fetch(FEDEX_TRACKING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-locale": "en_US",
      },
      body: JSON.stringify({
        trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
        includeDetailedScans: true,
      }),
    });
    if (!res.ok) {
      this.log.error(`FedEx tracking request failed for ${trackingNumber}: ${res.status}`);
      throw new Error(`FedEx tracking request failed: ${res.status}`);
    }

    // Response shape per FedEx's published docs — verify field names against
    // a real sandbox response once credentials exist.
    const data = (await res.json()) as {
      output?: {
        completeTrackResults?: Array<{
          trackResults?: Array<{
            latestStatusDetail?: { code?: string; description?: string };
            dateAndTimes?: Array<{ type?: string; dateTime?: string }>;
          }>;
        }>;
      };
    };

    const trackResult = data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    const estimatedDelivery = trackResult?.dateAndTimes?.find(
      (d) => d.type === "ESTIMATED_DELIVERY",
    )?.dateTime;

    return {
      status: this.mapStatus(trackResult?.latestStatusDetail?.code ?? ""),
      estimatedDeliveryDate: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
      lastEventDescription: trackResult?.latestStatusDetail?.description,
    };
  }

  private mapStatus(code: string): CarrierTrackingResult["status"] {
    if (code === "DL") return "delivered";
    if (code === "DE" || code === "CA") return "failed";
    return "shipped";
  }
}
