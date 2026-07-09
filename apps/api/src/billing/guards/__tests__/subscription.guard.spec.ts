import { ExecutionContext, HttpException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SubscriptionGuard } from "../subscription.guard";
import { EntitlementsService, PlanWithLimits } from "../../../entitlements/entitlements.service";

function buildContext(user: { subscriptionTier: string } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

const PLANS = [
  { key: "free" },
  { key: "pro" },
  { key: "elite" },
] as PlanWithLimits[];

describe("SubscriptionGuard", () => {
  let guard: SubscriptionGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let entitlements: { getAllPlans: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    entitlements = { getAllPlans: jest.fn().mockResolvedValue(PLANS) };
    guard = new SubscriptionGuard(
      reflector as unknown as Reflector,
      entitlements as unknown as EntitlementsService,
    );
  });

  it("allows through when no tier is required", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const result = await guard.canActivate(buildContext({ subscriptionTier: "free" }));
    expect(result).toBe(true);
  });

  it("denies when there's no user on the request", async () => {
    reflector.getAllAndOverride.mockReturnValue(["pro"]);
    const result = await guard.canActivate(buildContext(undefined));
    expect(result).toBe(false);
  });

  it("allows a pro user through a pro-required route", async () => {
    reflector.getAllAndOverride.mockReturnValue(["pro", "elite"]);
    const result = await guard.canActivate(buildContext({ subscriptionTier: "pro" }));
    expect(result).toBe(true);
  });

  it("allows an elite user through a pro-required route (rank above minimum)", async () => {
    reflector.getAllAndOverride.mockReturnValue(["pro", "elite"]);
    const result = await guard.canActivate(buildContext({ subscriptionTier: "elite" }));
    expect(result).toBe(true);
  });

  it("throws 402 for a free user on a pro-required route", async () => {
    reflector.getAllAndOverride.mockReturnValue(["pro", "elite"]);
    try {
      await guard.canActivate(buildContext({ subscriptionTier: "free" }));
      fail("expected canActivate to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(402);
      expect((err as HttpException).getResponse()).toMatchObject({
        requiredTier: "pro",
        currentTier: "free",
      });
    }
  });
});
