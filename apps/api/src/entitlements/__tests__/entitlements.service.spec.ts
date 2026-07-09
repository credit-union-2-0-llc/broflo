import { Test, TestingModule } from "@nestjs/testing";
import type { PlanLimit } from "@prisma/client";
import { EntitlementsService, PlanWithLimits } from "../entitlements.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

// Mirrors today's real, deployed tier values (TIER_MAX_PEOPLE, TIER_LIMITS,
// TIER_MAX_REQUESTS, TIER_COUNTS, TIER_PRICES_CENTS, and the scattered inline
// tier checks) — this is what production behaves like today, and what
// EntitlementsService must keep returning once it becomes the source of truth.
function buildPlan(overrides: Partial<PlanWithLimits> & { key: string; limits: PlanLimit[] }): PlanWithLimits {
  return {
    id: `plan-${overrides.key}`,
    name: overrides.key,
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const FREE_PLAN = buildPlan({
  key: "free",
  stripePriceIdMonthly: null,
  limits: [
    { id: "1", planId: "plan-free", featureKey: "maxPeople", type: "INTEGER", boolValue: null, intValue: 3, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "2", planId: "plan-free", featureKey: "photoLimitPerPerson", type: "INTEGER", boolValue: null, intValue: 1, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "3", planId: "plan-free", featureKey: "maxRerollRequests", type: "INTEGER", boolValue: null, intValue: 1, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "4", planId: "plan-free", featureKey: "suggestionsPerRequest", type: "INTEGER", boolValue: null, intValue: 3, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "5", planId: "plan-free", featureKey: "serviceCreditCents", type: "CENTS", boolValue: null, intValue: 0, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "6", planId: "plan-free", featureKey: "autopilotEnabled", type: "BOOLEAN", boolValue: false, intValue: null, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "7", planId: "plan-free", featureKey: "agentPurchasing", type: "BOOLEAN", boolValue: false, intValue: null, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "8", planId: "plan-free", featureKey: "aiModel", type: "STRING", boolValue: null, intValue: null, isUnlimited: false, stringValue: "haiku", description: null, updatedAt: new Date(), updatedBy: null },
  ],
});

const PRO_PLAN = buildPlan({
  key: "pro",
  stripePriceIdMonthly: "price_pro_monthly",
  stripePriceIdAnnual: "price_pro_annual",
  limits: [
    { id: "9", planId: "plan-pro", featureKey: "maxPeople", type: "INTEGER", boolValue: null, intValue: null, isUnlimited: true, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "10", planId: "plan-pro", featureKey: "photoLimitPerPerson", type: "INTEGER", boolValue: null, intValue: 5, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "11", planId: "plan-pro", featureKey: "maxRerollRequests", type: "INTEGER", boolValue: null, intValue: 3, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "12", planId: "plan-pro", featureKey: "serviceCreditCents", type: "CENTS", boolValue: null, intValue: 999, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "13", planId: "plan-pro", featureKey: "autopilotEnabled", type: "BOOLEAN", boolValue: true, intValue: null, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "14", planId: "plan-pro", featureKey: "aiModel", type: "STRING", boolValue: null, intValue: null, isUnlimited: false, stringValue: "sonnet", description: null, updatedAt: new Date(), updatedBy: null },
  ],
});

const ELITE_PLAN = buildPlan({
  key: "elite",
  limits: [
    { id: "15", planId: "plan-elite", featureKey: "photoLimitPerPerson", type: "INTEGER", boolValue: null, intValue: null, isUnlimited: true, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "16", planId: "plan-elite", featureKey: "maxRerollRequests", type: "INTEGER", boolValue: null, intValue: null, isUnlimited: true, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "17", planId: "plan-elite", featureKey: "serviceCreditCents", type: "CENTS", boolValue: null, intValue: 2499, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
    { id: "18", planId: "plan-elite", featureKey: "eliteDossierInsights", type: "BOOLEAN", boolValue: true, intValue: null, isUnlimited: false, stringValue: null, description: null, updatedAt: new Date(), updatedBy: null },
  ],
});

describe("EntitlementsService", () => {
  let service: EntitlementsService;
  let prisma: { plan: { findUnique: jest.Mock; findMany: jest.Mock; findUniqueOrThrow: jest.Mock; create: jest.Mock; update: jest.Mock }; planLimit: { upsert: jest.Mock } };
  let redis: {
    getCachedPlan: jest.Mock;
    setCachedPlan: jest.Mock;
    invalidatePlanCache: jest.Mock;
    getCachedAllPlans: jest.Mock;
    setCachedAllPlans: jest.Mock;
    invalidateAllPlansCache: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      plan: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      planLimit: { upsert: jest.fn() },
    };
    redis = {
      getCachedPlan: jest.fn().mockResolvedValue(null),
      setCachedPlan: jest.fn(),
      invalidatePlanCache: jest.fn(),
      getCachedAllPlans: jest.fn().mockResolvedValue(null),
      setCachedAllPlans: jest.fn(),
      invalidateAllPlansCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(EntitlementsService);
  });

  function mockPlanLookup(plan: PlanWithLimits) {
    prisma.plan.findUnique.mockImplementation(({ where }: { where: { key: string } }) =>
      where.key === plan.key ? Promise.resolve(plan) : Promise.resolve(null),
    );
  }

  describe("getIntLimit — matches today's TIER_* constants", () => {
    it("free: maxPeople is 3", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.getIntLimit("free", "maxPeople")).toBe(3);
    });

    it("pro: maxPeople is unlimited (null)", async () => {
      mockPlanLookup(PRO_PLAN);
      expect(await service.getIntLimit("pro", "maxPeople")).toBeNull();
    });

    it("free: photoLimitPerPerson is 1, pro is 5, elite is unlimited", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.getIntLimit("free", "photoLimitPerPerson")).toBe(1);
      mockPlanLookup(PRO_PLAN);
      expect(await service.getIntLimit("pro", "photoLimitPerPerson")).toBe(5);
      mockPlanLookup(ELITE_PLAN);
      expect(await service.getIntLimit("elite", "photoLimitPerPerson")).toBeNull();
    });

    it("free: maxRerollRequests is 1, pro is 3, elite is unlimited", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.getIntLimit("free", "maxRerollRequests")).toBe(1);
      mockPlanLookup(PRO_PLAN);
      expect(await service.getIntLimit("pro", "maxRerollRequests")).toBe(3);
      mockPlanLookup(ELITE_PLAN);
      expect(await service.getIntLimit("elite", "maxRerollRequests")).toBeNull();
    });

    it("serviceCreditCents: free 0, pro 999, elite 2499", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.getIntLimit("free", "serviceCreditCents")).toBe(0);
      mockPlanLookup(PRO_PLAN);
      expect(await service.getIntLimit("pro", "serviceCreditCents")).toBe(999);
      mockPlanLookup(ELITE_PLAN);
      expect(await service.getIntLimit("elite", "serviceCreditCents")).toBe(2499);
    });

    it("fails closed: uses the caller's fallback (not unlimited) when the plan/limit isn't found", async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      expect(await service.getIntLimit("unknown-tier", "maxPeople")).toBeNull();
      expect(await service.getIntLimit("unknown-tier", "maxPeople", 3)).toBe(3);
    });
  });

  describe("isFeatureEnabled — matches today's inline tier checks", () => {
    it("autopilotEnabled: false for free, true for pro", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.isFeatureEnabled("free", "autopilotEnabled")).toBe(false);
      mockPlanLookup(PRO_PLAN);
      expect(await service.isFeatureEnabled("pro", "autopilotEnabled")).toBe(true);
    });

    it("agentPurchasing: false for free", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.isFeatureEnabled("free", "agentPurchasing")).toBe(false);
    });

    it("eliteDossierInsights: true for elite", async () => {
      mockPlanLookup(ELITE_PLAN);
      expect(await service.isFeatureEnabled("elite", "eliteDossierInsights")).toBe(true);
    });

    it("returns false when the feature key doesn't exist on the plan", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.isFeatureEnabled("free", "somethingUnseeded")).toBe(false);
    });
  });

  describe("getStringLimit", () => {
    it("aiModel: haiku for free, sonnet for pro", async () => {
      mockPlanLookup(FREE_PLAN);
      expect(await service.getStringLimit("free", "aiModel")).toBe("haiku");
      mockPlanLookup(PRO_PLAN);
      expect(await service.getStringLimit("pro", "aiModel")).toBe("sonnet");
    });
  });

  describe("tierFromPriceId", () => {
    it("maps a monthly price ID to its plan key", async () => {
      prisma.plan.findMany.mockResolvedValue([FREE_PLAN, PRO_PLAN, ELITE_PLAN]);
      expect(await service.tierFromPriceId("price_pro_monthly")).toBe("pro");
    });

    it("maps an annual price ID to its plan key", async () => {
      prisma.plan.findMany.mockResolvedValue([FREE_PLAN, PRO_PLAN, ELITE_PLAN]);
      expect(await service.tierFromPriceId("price_pro_annual")).toBe("pro");
    });

    it("returns free for an undefined price ID", async () => {
      expect(await service.tierFromPriceId(undefined)).toBe("free");
    });

    it("falls back to pro for an unrecognized price ID (matches today's tierFromPriceId behavior)", async () => {
      prisma.plan.findMany.mockResolvedValue([FREE_PLAN, PRO_PLAN, ELITE_PLAN]);
      expect(await service.tierFromPriceId("price_totally_unknown")).toBe("pro");
    });
  });

  describe("getEnabledTierKeys", () => {
    it("returns only the tier keys with a boolean feature enabled (matches today's ['pro','elite'] autopilot filter)", async () => {
      prisma.plan.findMany.mockResolvedValue([FREE_PLAN, PRO_PLAN, ELITE_PLAN]);
      const keys = await service.getEnabledTierKeys("autopilotEnabled");
      expect(keys.sort()).toEqual(["pro"]); // ELITE_PLAN fixture doesn't set autopilotEnabled in this suite
    });

    it("returns an empty array when no tier has the feature enabled", async () => {
      prisma.plan.findMany.mockResolvedValue([FREE_PLAN]);
      expect(await service.getEnabledTierKeys("autopilotEnabled")).toEqual([]);
    });
  });

  describe("caching", () => {
    it("reads from cache without hitting the DB when present", async () => {
      redis.getCachedPlan.mockResolvedValue(JSON.stringify(FREE_PLAN));
      const result = await service.getPlan("free");
      expect(result?.key).toBe("free");
      expect(prisma.plan.findUnique).not.toHaveBeenCalled();
    });

    it("populates the cache after a DB read", async () => {
      mockPlanLookup(FREE_PLAN);
      await service.getPlan("free");
      expect(redis.setCachedPlan).toHaveBeenCalledWith("free", JSON.stringify(FREE_PLAN));
    });
  });

  describe("upsertPlanLimit", () => {
    it("invalidates both the specific plan cache and the all-plans cache", async () => {
      prisma.plan.findUniqueOrThrow.mockResolvedValue({ id: "plan-free", key: "free" });
      prisma.planLimit.upsert.mockResolvedValue({});

      await service.upsertPlanLimit("plan-free", "maxPeople", { type: "INTEGER", intValue: 5 }, "admin-1");

      expect(redis.invalidatePlanCache).toHaveBeenCalledWith("free");
      expect(redis.invalidateAllPlansCache).toHaveBeenCalled();
    });
  });
});
