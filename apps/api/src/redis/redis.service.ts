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
    const keys = await this.getClient().keys(pattern);
    if (keys.length > 0) {
      await this.getClient().del(...keys);
    }
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

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }
}
