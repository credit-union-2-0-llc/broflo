import { Test, TestingModule } from "@nestjs/testing";
import { AutopilotScheduler } from "../autopilot.scheduler";
import { PrismaService } from "../../prisma/prisma.service";
import { AutopilotService } from "../autopilot.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SuggestionsService } from "../../suggestions/suggestions.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import { FamilyService } from "../../family/family.service";

const makeRule = (overrides = {}) => ({
  id: "rule-1",
  userId: "user-1",
  personId: "person-1",
  isActive: true,
  occasionTypes: ["birthday"],
  budgetMinCents: 2000,
  budgetMaxCents: 5000,
  monthlyCapCents: 10000,
  leadDays: 7,
  user: {
    id: "user-1",
    subscriptionTier: "pro",
    stripeCustomerId: "cus_123",
    stripePaymentMethodId: "pm_123",
  },
  person: {
    id: "person-1",
    name: "Jane",
    shippingAddress1: "123 Main St",
    shippingCity: "Portland",
    shippingState: "OR",
    shippingZip: "97201",
  },
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  id: "event-1",
  personId: "person-1",
  userId: "user-1",
  name: "Birthday",
  occasionType: "birthday",
  date: new Date(),
  ...overrides,
});

const makeSuggestion = (overrides = {}) => ({
  id: "sug-1",
  title: "Nice Watch",
  confidenceScore: 0.9,
  estimatedPriceMaxCents: 4500,
  retailerHint: "amazon.com",
  ...overrides,
});

describe("AutopilotScheduler", () => {
  let scheduler: AutopilotScheduler;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let autopilotService: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;
  let suggestionsService: Record<string, jest.Mock>;
  let entitlements: Record<string, jest.Mock>;
  let family: Record<string, jest.Mock>;

  beforeEach(async () => {
    process.env.AUTOPILOT_ENABLED = 'true';

    prisma = {
      autopilotRule: { findMany: jest.fn().mockResolvedValue([]) },
      autopilotRun: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUniqueOrThrow: jest.fn() },
    };
    autopilotService = {
      checkSpendingCap: jest.fn().mockResolvedValue({ allowed: true, monthlySpentCents: 0, monthlyCap: 10000 }),
    };
    notifications = {
      create: jest.fn().mockResolvedValue({}),
    };
    suggestionsService = {
      generate: jest.fn().mockResolvedValue({ suggestions: [makeSuggestion()] }),
      selectSuggestion: jest.fn().mockResolvedValue({}),
    };
    entitlements = {
      getEnabledTierKeys: jest.fn().mockResolvedValue(["pro", "elite"]),
    };
    family = {
      getMyFamilyGroupId: jest.fn().mockResolvedValue(null),
      getFamilyMemberUserIds: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutopilotScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: AutopilotService, useValue: autopilotService },
        { provide: NotificationsService, useValue: notifications },
        { provide: SuggestionsService, useValue: suggestionsService },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: FamilyService, useValue: family },
      ],
    }).compile();

    scheduler = module.get(AutopilotScheduler);
  });

  afterEach(() => {
    delete process.env.AUTOPILOT_ENABLED;
  });

  describe("spending cap enforcement", () => {
    it("skips rule when spending cap exceeded", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      autopilotService.checkSpendingCap.mockResolvedValue({
        allowed: false,
        monthlySpentCents: 9500,
        monthlyCap: 10000,
      });

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "skipped_budget" }),
        }),
      );
      expect(suggestionsService.selectSuggestion).not.toHaveBeenCalled();
    });

    it("sends budget warning at 80% cap", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      autopilotService.checkSpendingCap.mockResolvedValue({
        allowed: false,
        monthlySpentCents: 8500,
        monthlyCap: 10000,
      });

      await scheduler.runAutopilot();

      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_budget_warning" }),
      );
    });
  });

  describe("confidence threshold", () => {
    it("skips when confidence below 0.80", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ confidenceScore: 0.6 })],
      });

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "skipped_confidence" }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_needs_approval" }),
      );
    });

    it("proceeds when confidence at exactly 0.80", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ confidenceScore: 0.8 })],
      });

      await scheduler.runAutopilot();

      expect(suggestionsService.selectSuggestion).toHaveBeenCalled();
    });
  });

  describe("budget check", () => {
    it("skips when suggestion price exceeds rule budget", async () => {
      const rule = makeRule({ budgetMaxCents: 3000 });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 5000 })],
      });

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "skipped_budget" }),
        }),
      );
    });
  });

  describe("auto-select and notify (no real purchase-execution path exists)", () => {
    it("auto-selects the vetted suggestion and notifies the user to complete the purchase", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);

      await scheduler.runAutopilot();

      expect(suggestionsService.selectSuggestion).toHaveBeenCalledWith(
        "user-1",
        "event-1",
        { suggestionId: "sug-1" },
      );
      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ready_for_review" }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_ready" }),
      );
    });

    it("records failure without notifying an order-placed message if auto-select fails", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.selectSuggestion.mockRejectedValue(new Error("suggestion dismissed"));

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "failed" }),
        }),
      );
      expect(notifications.create).not.toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_ready" }),
      );
    });
  });

  describe("missing shipping address", () => {
    it("fails and notifies when shipping address missing", async () => {
      const rule = makeRule({
        person: { id: "person-1", name: "Jane", shippingAddress1: null, shippingCity: null, shippingState: null, shippingZip: null },
      });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "failed", reason: "Missing shipping address" }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_failed" }),
      );
    });
  });

  describe("MAX_RUNS_PER_CYCLE", () => {
    it("stops processing after 50 rules", async () => {
      const rules = Array.from({ length: 55 }, (_, i) => makeRule({ id: `rule-${i}` }));
      prisma.autopilotRule.findMany.mockResolvedValue(rules);
      prisma.event.findMany.mockResolvedValue([]);

      await scheduler.runAutopilot();

      // Each processRule is called but events query returns empty, so it's a no-op per rule.
      // The key thing: it processes exactly MAX_RUNS_PER_CYCLE (50) and logs the warning.
      expect(prisma.event.findMany).toHaveBeenCalledTimes(50);
    });
  });

  describe("family-pool auto-nudge", () => {
    it("does not nudge when the user isn't on the family tier", async () => {
      const rule = makeRule({ user: { id: "user-1", subscriptionTier: "pro", stripeCustomerId: "cus_123", stripePaymentMethodId: "pm_123" } });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 20000 })],
      });

      await scheduler.runAutopilot();

      expect(family.getMyFamilyGroupId).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "family_pool_suggested" }),
      );
    });

    it("does not nudge when the family-tier user's pick is below the big-ticket threshold", async () => {
      const rule = makeRule({ user: { id: "user-1", subscriptionTier: "family", stripeCustomerId: "cus_123", stripePaymentMethodId: "pm_123" } });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 4500 })],
      });

      await scheduler.runAutopilot();

      expect(family.getMyFamilyGroupId).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "family_pool_suggested" }),
      );
    });

    it("does not nudge when the family-tier user has no family group set up", async () => {
      const rule = makeRule({
        budgetMaxCents: 25000,
        user: { id: "user-1", subscriptionTier: "family", stripeCustomerId: "cus_123", stripePaymentMethodId: "pm_123" },
      });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 20000 })],
      });
      family.getMyFamilyGroupId.mockResolvedValue(null);

      await scheduler.runAutopilot();

      expect(family.getFamilyMemberUserIds).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "family_pool_suggested" }),
      );
    });

    it("notifies every family member with a prefilled gift-pool link for a big-ticket family-tier pick", async () => {
      const rule = makeRule({
        budgetMaxCents: 25000,
        user: { id: "user-1", subscriptionTier: "family", stripeCustomerId: "cus_123", stripePaymentMethodId: "pm_123" },
      });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 20000 })],
      });
      family.getMyFamilyGroupId.mockResolvedValue("group-1");
      family.getFamilyMemberUserIds.mockResolvedValue(["user-1", "user-2", "user-3"]);

      await scheduler.runAutopilot();

      expect(family.getMyFamilyGroupId).toHaveBeenCalledWith("user-1");
      expect(family.getFamilyMemberUserIds).toHaveBeenCalledWith("group-1");
      for (const memberId of ["user-1", "user-2", "user-3"]) {
        expect(notifications.create).toHaveBeenCalledWith(
          memberId,
          expect.objectContaining({
            type: "family_pool_suggested",
            linkUrl: expect.stringContaining("/family?prefillTitle="),
          }),
        );
      }
    });

    it("does not fail the autopilot run if the nudge itself throws", async () => {
      const rule = makeRule({
        budgetMaxCents: 25000,
        user: { id: "user-1", subscriptionTier: "family", stripeCustomerId: "cus_123", stripePaymentMethodId: "pm_123" },
      });
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      suggestionsService.generate.mockResolvedValue({
        suggestions: [makeSuggestion({ estimatedPriceMaxCents: 20000 })],
      });
      family.getMyFamilyGroupId.mockRejectedValue(new Error("db down"));

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ready_for_review" }),
        }),
      );
    });
  });
});
