import { Injectable, Logger } from "@nestjs/common";
import type { CarrierTrackingAdapter, CarrierTrackingResult } from "./carrier-tracking.adapter";
import { OAuthClientCredentialsCache } from "./oauth-client-credentials-cache";

const UPS_OAUTH_URL = "https://onlinetools.ups.com/security/v1/oauth/token";
const UPS_TRACKING_URL = "https://onlinetools.ups.com/api/track/v1/details";

@Injectable()
export class UpsTrackingAdapter implements CarrierTrackingAdapter {
  readonly carrierKey = "ups";
  private readonly log = new Logger(UpsTrackingAdapter.name);
  private readonly tokenCache = new OAuthClientCredentialsCache(() => this.fetchToken());

  isConfigured(): boolean {
    return !!(process.env.UPS_CLIENT_ID && process.env.UPS_CLIENT_SECRET);
  }

  private async fetchToken(): Promise<{ accessToken: string; expiresInSeconds: number }> {
    const basicAuth = Buffer.from(
      `${process.env.UPS_CLIENT_ID}:${process.env.UPS_CLIENT_SECRET}`,
    ).toString("base64");

    const res = await fetch(UPS_OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      this.log.error(`UPS OAuth token request failed: ${res.status} ${await res.text().catch(() => "")}`);
      throw new Error(`UPS OAuth token request failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: string };
    return { accessToken: data.access_token, expiresInSeconds: parseInt(data.expires_in, 10) };
  }

  async getTrackingStatus(trackingNumber: string): Promise<CarrierTrackingResult> {
    const token = await this.tokenCache.getToken();
    const res = await fetch(`${UPS_TRACKING_URL}/${encodeURIComponent(trackingNumber)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        transId: `broflo-${Date.now()}`,
        transactionSrc: "broflo",
      },
    });
    if (!res.ok) {
      this.log.error(`UPS tracking request failed for ${trackingNumber}: ${res.status}`);
      throw new Error(`UPS tracking request failed: ${res.status}`);
    }

    // Response shape per UPS's published docs — verify field names against
    // a real sandbox response once credentials exist.
    const data = (await res.json()) as {
      trackResponse?: {
        shipment?: Array<{
          package?: Array<{
            activity?: Array<{ status?: { type?: string; description?: string } }>;
            deliveryDate?: Array<{ date?: string }>;
          }>;
        }>;
      };
    };

    const pkg = data.trackResponse?.shipment?.[0]?.package?.[0];
    const latestActivity = pkg?.activity?.[0];
    const deliveryDateRaw = pkg?.deliveryDate?.[0]?.date; // YYYYMMDD

    return {
      status: this.mapStatus(latestActivity?.status?.type ?? ""),
      estimatedDeliveryDate: deliveryDateRaw ? this.parseYyyymmdd(deliveryDateRaw) : undefined,
      lastEventDescription: latestActivity?.status?.description,
    };
  }

  private mapStatus(statusType: string): CarrierTrackingResult["status"] {
    if (statusType === "D") return "delivered";
    if (statusType === "X" || statusType === "RS") return "failed";
    return "shipped";
  }

  private parseYyyymmdd(raw: string): Date | undefined {
    if (!/^\d{8}$/.test(raw)) return undefined;
    const year = raw.slice(0, 4);
    const month = raw.slice(4, 6);
    const day = raw.slice(6, 8);
    return new Date(`${year}-${month}-${day}T00:00:00Z`);
  }
}
