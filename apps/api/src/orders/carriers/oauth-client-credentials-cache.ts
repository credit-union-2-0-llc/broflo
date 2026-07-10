// Shared OAuth 2.0 client-credentials token cache — USPS, UPS, and FedEx
// all use this flow, just with different endpoints/token lifetimes.
// Refreshes proactively (60s before expiry) rather than waiting for a 401.
export class OAuthClientCredentialsCache {
  private cached: { accessToken: string; expiresAt: number } | null = null;

  constructor(
    private readonly fetchToken: () => Promise<{ accessToken: string; expiresInSeconds: number }>,
  ) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt - 60_000 > now) {
      return this.cached.accessToken;
    }

    const { accessToken, expiresInSeconds } = await this.fetchToken();
    this.cached = { accessToken, expiresAt: now + expiresInSeconds * 1000 };
    return this.cached.accessToken;
  }
}
