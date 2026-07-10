import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  private getClient(): Redis {
    if (!this.client) {
      const url = process.env.REDIS_URL;
      if (url) {
        this.client = new Redis(url);
        // ioredis emits 'error' for any transient connection issue (and
        // rethrows as an uncaught exception, crashing the whole process, if
        // nothing is listening) — log instead so a blip on the cache just
        // logs and reconnects rather than taking down every in-flight request.
        this.client.on("error", (err) => {
          this.logger.error(`Redis connection error: ${err.message}`);
        });
      } else {
        this.logger.warn("REDIS_URL not set — using in-memory fallback");
        this.client = null as unknown as Redis;
      }
    }
    return this.client;
  }

  private get isConnected(): boolean {
    return !!process.env.REDIS_URL && this.client !== null;
  }

  // --- In-memory fallback for local dev ---
  private memCache = new Map<string, { value: string; expiresAt: number }>();

  private memGet(key: string): string | null {
    const entry = this.memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memCache.delete(key);
      return null;
    }
    return entry.value;
  }

  private memSet(key: string, value: string, ttlSeconds: number): void {
    this.memCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  // --- Suggestion cache ---

  async getCachedSuggestions(key: string): Promise<string | null> {
    if (!this.isConnected) return this.memGet(key);
    return this.getClient().get(key);
  }

  async setCachedSuggestions(
    key: string,
    value: string,
    ttlSeconds: number = 86400,
  ): Promise<void> {
    if (!this.isConnected) {
      this.memSet(key, value, ttlSeconds);
      return;
    }
    await this.getClient().setex(key, ttlSeconds, value);
  }

  async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.isConnected) {
      for (const k of this.memCache.keys()) {
        if (k.includes(pattern.replace("*", ""))) {
          this.memCache.delete(k);
        }
      }
      return;
    }
    const client = this.getClient();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor, "MATCH", pattern, "COUNT", 100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== "0");
  }

  // --- Rate limiting (20 requests/user/hour) ---

  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `ratelimit:suggestions:${userId}`;
    const limit = 20;
    const windowSeconds = 3600;

    if (!this.isConnected) {
      const raw = this.memGet(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= limit) return { allowed: false, remaining: 0 };
      this.memSet(key, String(count + 1), windowSeconds);
      return { allowed: true, remaining: limit - count - 1 };
    }

    const client = this.getClient();
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }
    const allowed = current <= limit;
    return { allowed, remaining: Math.max(0, limit - current) };
  }

  // --- Spend tracking (F-05: $50/day global cap) ---

  private readonly DAILY_CAP_CENTS = 5000; // $50/day

  private getDailySpendKey(): string {
    return `spend:daily:${new Date().toISOString().slice(0, 10)}`;
  }

  async checkSpendCap(): Promise<{ withinCap: boolean; currentCents: number }> {
    const key = this.getDailySpendKey();

    if (!this.isConnected) {
      const raw = this.memGet(key);
      const current = raw ? parseInt(raw, 10) : 0;
      return { withinCap: current < this.DAILY_CAP_CENTS, currentCents: current };
    }

    const raw = await this.getClient().get(key);
    const current = raw ? parseInt(raw, 10) : 0;
    return { withinCap: current < this.DAILY_CAP_CENTS, currentCents: current };
  }

  async trackSpend(costCents: number): Promise<{ withinCap: boolean }> {
    const key = this.getDailySpendKey();

    if (!this.isConnected) {
      const raw = this.memGet(key);
      const current = raw ? parseInt(raw, 10) : 0;
      const newTotal = current + costCents;
      this.memSet(key, String(newTotal), 86400);
      return { withinCap: newTotal <= this.DAILY_CAP_CENTS };
    }

    const client = this.getClient();
    const newTotal = await client.incrby(key, costCents);
    if (newTotal === costCents) {
      await client.expire(key, 86400);
    }
    return { withinCap: newTotal <= this.DAILY_CAP_CENTS };
  }

  // --- OTP storage (5 min TTL, single use) ---

  private readonly OTP_TTL_SECONDS = 300;
  private readonly OTP_RATE_LIMIT_SECONDS = 900; // 15 min window
  private readonly OTP_RATE_LIMIT_MAX = 3;

  async setOtp(email: string, code: string): Promise<void> {
    const key = `otp:${email.toLowerCase()}`;
    if (!this.isConnected) {
      this.memSet(key, code, this.OTP_TTL_SECONDS);
      return;
    }
    await this.getClient().setex(key, this.OTP_TTL_SECONDS, code);
  }

  async getOtp(email: string): Promise<string | null> {
    const key = `otp:${email.toLowerCase()}`;
    if (!this.isConnected) return this.memGet(key);
    return this.getClient().get(key);
  }

  async deleteOtp(email: string): Promise<void> {
    const key = `otp:${email.toLowerCase()}`;
    if (!this.isConnected) {
      this.memCache.delete(key);
      return;
    }
    await this.getClient().del(key);
  }

  async checkOtpRateLimit(email: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `otp-rate:${email.toLowerCase()}`;
    const limit = this.OTP_RATE_LIMIT_MAX;

    if (!this.isConnected) {
      const raw = this.memGet(key);
      const count = raw ? parseInt(raw, 10) : 0;
      if (count >= limit) return { allowed: false, remaining: 0 };
      this.memSet(key, String(count + 1), this.OTP_RATE_LIMIT_SECONDS);
      return { allowed: true, remaining: limit - count - 1 };
    }

    const client = this.getClient();
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, this.OTP_RATE_LIMIT_SECONDS);
    }
    const allowed = current <= limit;
    return { allowed, remaining: Math.max(0, limit - current) };
  }

  // --- Recipient survey send rate limit (1 per person per 24h) ---

  private readonly SURVEY_SEND_RATE_LIMIT_SECONDS = 86400;

  async checkSurveySendRateLimit(personId: string): Promise<{ allowed: boolean }> {
    const key = `survey-send-rate:${personId}`;

    if (!this.isConnected) {
      const raw = this.memGet(key);
      if (raw) return { allowed: false };
      this.memSet(key, "1", this.SURVEY_SEND_RATE_LIMIT_SECONDS);
      return { allowed: true };
    }

    const client = this.getClient();
    const set = await client.set(key, "1", "EX", this.SURVEY_SEND_RATE_LIMIT_SECONDS, "NX");
    return { allowed: set === "OK" };
  }

  // --- Entitlements cache (60s TTL, explicitly invalidated on admin write) ---

  private readonly ENTITLEMENTS_TTL_SECONDS = 60;

  async getCachedPlan(tierKey: string): Promise<string | null> {
    const key = `entitlements:plan:${tierKey}`;
    if (!this.isConnected) return this.memGet(key);
    return this.getClient().get(key);
  }

  async setCachedPlan(tierKey: string, json: string): Promise<void> {
    const key = `entitlements:plan:${tierKey}`;
    if (!this.isConnected) {
      this.memSet(key, json, this.ENTITLEMENTS_TTL_SECONDS);
      return;
    }
    await this.getClient().setex(key, this.ENTITLEMENTS_TTL_SECONDS, json);
  }

  async invalidatePlanCache(tierKey?: string): Promise<void> {
    if (tierKey) {
      const key = `entitlements:plan:${tierKey}`;
      if (!this.isConnected) {
        this.memCache.delete(key);
        return;
      }
      await this.getClient().del(key);
      return;
    }
    await this.invalidateByPattern('entitlements:plan:*');
  }

  async getCachedAllPlans(): Promise<string | null> {
    const key = 'entitlements:all-plans';
    if (!this.isConnected) return this.memGet(key);
    return this.getClient().get(key);
  }

  async setCachedAllPlans(json: string): Promise<void> {
    const key = 'entitlements:all-plans';
    const ttlSeconds = 300;
    if (!this.isConnected) {
      this.memSet(key, json, ttlSeconds);
      return;
    }
    await this.getClient().setex(key, ttlSeconds, json);
  }

  async invalidateAllPlansCache(): Promise<void> {
    const key = 'entitlements:all-plans';
    if (!this.isConnected) {
      this.memCache.delete(key);
      return;
    }
    await this.getClient().del(key);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}
