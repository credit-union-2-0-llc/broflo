import { Test, TestingModule } from "@nestjs/testing";
import { AutopilotScheduler } from "../autopilot.scheduler";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../../orders/orders.service";
import { AgentOrdersService } from "../../orders/agent/agent-orders.service";
import { AutopilotService } from "../autopilot.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { SuggestionsService } from "../../suggestions/suggestions.service";

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
  let ordersService: Record<string, jest.Mock>;
  let agentOrders: Record<string, jest.Mock>;
  let autopilotService: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;
  let suggestionsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    prisma = {
      autopilotRule: { findMany: jest.fn().mockResolvedValue([]) },
      autopilotRun: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUniqueOrThrow: jest.fn() },
    };
    ordersService = {
      preview: jest.fn(),
      place: jest.fn(),
    };
    agentOrders = {
      preview: jest.fn(),
      place: jest.fn(),
    };
    autopilotService = {
      checkSpendingCap: jest.fn().mockResolvedValue({ allowed: true, monthlySpentCents: 0, monthlyCap: 10000 }),
    };
    notifications = {
      create: jest.fn().mockResolvedValue({}),
    };
    suggestionsService = {
      generate: jest.fn().mockResolvedValue({ suggestions: [makeSuggestion()] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutopilotScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: OrdersService, useValue: ordersService },
        { provide: AgentOrdersService, useValue: agentOrders },
        { provide: AutopilotService, useValue: autopilotService },
        { provide: NotificationsService, useValue: notifications },
        { provide: SuggestionsService, useValue: suggestionsService },
      ],
    }).compile();

    scheduler = module.get(AutopilotScheduler);
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
      expect(ordersService.place).not.toHaveBeenCalled();
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
      ordersService.preview.mockResolvedValue({
        product: { id: "prod-1", title: "Watch", priceCents: 4500 },
      });
      ordersService.place.mockResolvedValue({ id: "order-1" });

      await scheduler.runAutopilot();

      expect(ordersService.place).toHaveBeenCalled();
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

  describe("order placement", () => {
    it("places order via API adapter when available", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      ordersService.preview.mockResolvedValue({
        product: { id: "prod-1", title: "Watch", priceCents: 4500 },
      });
      ordersService.place.mockResolvedValue({ id: "order-1" });

      await scheduler.runAutopilot();

      expect(ordersService.place).toHaveBeenCalled();
      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "order_placed" }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_ordered" }),
      );
    });

    it("falls back to browser agent when API preview fails", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      ordersService.preview.mockRejectedValue(new Error("No adapter"));
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "user-1" });
      agentOrders.preview.mockResolvedValue({ id: "job-1", status: "previewing" });
      agentOrders.place.mockResolvedValue({
        job: { status: "completed" },
        order: { id: "order-2", productTitle: "Watch", priceCents: 4500 },
      });

      await scheduler.runAutopilot();

      expect(agentOrders.preview).toHaveBeenCalled();
      expect(agentOrders.place).toHaveBeenCalled();
      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "order_placed",
            metadata: expect.objectContaining({ channel: "browser_agent" }),
          }),
        }),
      );
    });

    it("records failure and notifies when order placement fails", async () => {
      const rule = makeRule();
      prisma.autopilotRule.findMany.mockResolvedValue([rule]);
      prisma.event.findMany.mockResolvedValue([makeEvent()]);
      ordersService.preview.mockResolvedValue({
        product: { id: "prod-1", title: "Watch", priceCents: 4500 },
      });
      ordersService.place.mockRejectedValue(new Error("Stripe declined"));

      await scheduler.runAutopilot();

      expect(prisma.autopilotRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "failed" }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "autopilot_failed" }),
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
});
