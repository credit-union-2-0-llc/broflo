import { Injectable, Logger } from "@nestjs/common";
import type { Plan, PlanLimit, PlanLimitType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

export interface PlanWithLimits extends Plan {
  limits: PlanLimit[];
}

export interface PlanLimitInput {
  type: PlanLimitType;
  boolValue?: boolean | null;
  intValue?: number | null;
  isUnlimited?: boolean;
  stringValue?: string | null;
  description?: string | null;
}

export interface CreatePlanInput {
  key: string;
  name: string;
  priceMonthlyCents?: number;
  priceAnnualCents?: number;
  sortOrder?: number;
}

@Injectable()
export class EntitlementsService {
  private readonly log = new Logger(EntitlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPlan(tierKey: string): Promise<PlanWithLimits | null> {
    const cached = await this.redis.getCachedPlan(tierKey);
    if (cached) return JSON.parse(cached);

    const plan = await this.prisma.plan.findUnique({
      where: { key: tierKey },
      include: { limits: true },
    });
    if (!plan) return null;

    await this.redis.setCachedPlan(tierKey, JSON.stringify(plan));
    return plan;
  }

  async getAllPlans(): Promise<PlanWithLimits[]> {
    const cached = await this.redis.getCachedAllPlans();
    if (cached) return JSON.parse(cached);

    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: { limits: true },
      orderBy: { sortOrder: "asc" },
    });

    await this.redis.setCachedAllPlans(JSON.stringify(plans));
    return plans;
  }

  private findLimit(plan: PlanWithLimits | null, featureKey: string): PlanLimit | undefined {
    return plan?.limits.find((l) => l.featureKey === featureKey);
  }

  /**
   * Returns null for "unlimited". `notFoundFallback` is what's returned when
   * the plan or feature key can't be found at all (e.g. the DB hasn't been
   * seeded yet) — defaults to null, but callers gating a paid limit (like
   * maxPeople) should pass an explicit restrictive fallback so missing data
   * fails closed instead of silently becoming "unlimited".
   */
  async getIntLimit(
    tierKey: string,
    featureKey: string,
    notFoundFallback: number | null = null,
  ): Promise<number | null> {
    const plan = await this.getPlan(tierKey);
    const limit = this.findLimit(plan, featureKey);
    if (!limit) {
      this.log.warn(`No PlanLimit found for tier=${tierKey} featureKey=${featureKey}`);
      return notFoundFallback;
    }
    if (limit.isUnlimited) return null;
    return limit.intValue ?? notFoundFallback;
  }

  async isFeatureEnabled(tierKey: string, featureKey: string): Promise<boolean> {
    const plan = await this.getPlan(tierKey);
    const limit = this.findLimit(plan, featureKey);
    if (!limit) {
      this.log.warn(`No PlanLimit found for tier=${tierKey} featureKey=${featureKey}`);
      return false;
    }
    return !!limit.boolValue;
  }

  /**
   * For call sites that filter a DB query by tier (e.g. `subscriptionTier:
   * { in: [...] }`) rather than checking one user at a time — returns the
   * plan keys where a boolean feature is enabled, so that `in` list can stay
   * dynamic instead of a hardcoded ['pro', 'elite'].
   */
  async getEnabledTierKeys(featureKey: string): Promise<string[]> {
    const plans = await this.getAllPlans();
    return plans
      .filter((p) => p.limits.find((l) => l.featureKey === featureKey)?.boolValue)
      .map((p) => p.key);
  }

  async getStringLimit(tierKey: string, featureKey: string): Promise<string | null> {
    const plan = await this.getPlan(tierKey);
    const limit = this.findLimit(plan, featureKey);
    return limit?.stringValue ?? null;
  }

  async tierFromPriceId(priceId: string | undefined): Promise<string> {
    if (!priceId) return "free";
    const plans = await this.getAllPlans();
    const match = plans.find(
      (p) => p.stripePriceIdMonthly === priceId || p.stripePriceIdAnnual === priceId,
    );
    return match?.key ?? "pro";
  }

  // --- Admin writes ---

  async upsertPlanLimit(
    planId: string,
    featureKey: string,
    value: PlanLimitInput,
    adminUserId: string,
  ): Promise<PlanLimit> {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });

    const limit = await this.prisma.planLimit.upsert({
      where: { uq_plan_limit_plan_feature: { planId, featureKey } },
      update: {
        type: value.type,
        boolValue: value.boolValue ?? null,
        intValue: value.intValue ?? null,
        isUnlimited: value.isUnlimited ?? false,
        stringValue: value.stringValue ?? null,
        description: value.description,
        updatedBy: adminUserId,
      },
      create: {
        planId,
        featureKey,
        type: value.type,
        boolValue: value.boolValue ?? null,
        intValue: value.intValue ?? null,
        isUnlimited: value.isUnlimited ?? false,
        stringValue: value.stringValue ?? null,
        description: value.description,
        updatedBy: adminUserId,
      },
    });

    await this.invalidateCache(plan.key);
    return limit;
  }

  async createPlan(input: CreatePlanInput): Promise<Plan> {
    const plan = await this.prisma.plan.create({
      data: {
        key: input.key,
        name: input.name,
        priceMonthlyCents: input.priceMonthlyCents ?? 0,
        priceAnnualCents: input.priceAnnualCents ?? 0,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    await this.invalidateCache();
    return plan;
  }

  async setPlanActive(planId: string, isActive: boolean): Promise<Plan> {
    const plan = await this.prisma.plan.update({
      where: { id: planId },
      data: { isActive },
    });
    await this.invalidateCache(plan.key);
    return plan;
  }

  private async invalidateCache(tierKey?: string): Promise<void> {
    if (tierKey) await this.redis.invalidatePlanCache(tierKey);
    await this.redis.invalidateAllPlansCache();
  }
}
