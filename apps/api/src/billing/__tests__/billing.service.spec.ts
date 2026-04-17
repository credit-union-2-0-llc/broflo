/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { BillingService } from "../billing.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("BillingService", () => {
  let service: BillingService;
  let prisma: { user: { findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_pro_monthly";
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_pro_annual";
    process.env.STRIPE_ELITE_MONTHLY_PRICE_ID = "price_elite_monthly";
    process.env.STRIPE_ELITE_ANNUAL_PRICE_ID = "price_elite_annual";

    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
    delete process.env.STRIPE_PRO_ANNUAL_PRICE_ID;
    delete process.env.STRIPE_ELITE_MONTHLY_PRICE_ID;
    delete process.env.STRIPE_ELITE_ANNUAL_PRICE_ID;
  });

  describe("tierFromPriceId", () => {
    it("maps pro monthly price to pro", () => {
      const tier = (service as any).tierFromPriceId("price_pro_monthly");
      expect(tier).toBe("pro");
    });

    it("maps pro annual price to pro", () => {
      const tier = (service as any).tierFromPriceId("price_pro_annual");
      expect(tier).toBe("pro");
    });

    it("maps elite monthly price to elite", () => {
      const tier = (service as any).tierFromPriceId("price_elite_monthly");
      expect(tier).toBe("elite");
    });

    it("maps elite annual price to elite", () => {
      const tier = (service as any).tierFromPriceId("price_elite_annual");
      expect(tier).toBe("elite");
    });

    it("returns free for undefined price ID", () => {
      const tier = (service as any).tierFromPriceId(undefined);
      expect(tier).toBe("free");
    });

    it("defaults to pro for unknown price ID (current behavior)", () => {
      const tier = (service as any).tierFromPriceId("price_unknown_xyz");
      expect(tier).toBe("pro");
    });
  });

  describe("handleSubscriptionDeleted", () => {
    it("downgrades user to free and clears Stripe IDs", async () => {
      const sub = {
        id: "sub_123",
        metadata: { brofloUserId: "user-1" },
      };

      await (service as any).handleSubscriptionDeleted(sub);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          subscriptionTier: "free",
          stripeSubscriptionId: null,
          stripePaymentMethodId: null,
        },
      });
    });

    it("silently returns when no brofloUserId in metadata", async () => {
      await (service as any).handleSubscriptionDeleted({ metadata: {} });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentFailed", () => {
    it("downgrades user to free on payment failure", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        stripeCustomerId: "cus_123",
        subscriptionTier: "pro",
      });

      await (service as any).handlePaymentFailed({ customer: "cus_123" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { subscriptionTier: "free" },
      });
    });

    it("silently returns when customer not found", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await (service as any).handlePaymentFailed({ customer: "cus_unknown" });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("silently returns when no customer ID", async () => {
      await (service as any).handlePaymentFailed({});
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("handleCheckoutCompleted", () => {
    let stripeMock: { subscriptions: { retrieve: jest.Mock } };

    beforeEach(() => {
      stripeMock = { subscriptions: { retrieve: jest.fn() } };
      (service as any).stripe = stripeMock;
    });

    it("upgrades user to pro after checkout", async () => {
      stripeMock.subscriptions.retrieve
        .mockResolvedValueOnce({ metadata: { brofloUserId: "user-1" } })
        .mockResolvedValueOnce({
          items: { data: [{ price: { id: "price_pro_monthly" } }] },
          default_payment_method: { id: "pm_123" },
        });

      await (service as any).handleCheckoutCompleted({
        subscription: "sub_123",
        customer: "cus_456",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          subscriptionTier: "pro",
          stripeSubscriptionId: "sub_123",
          stripeCustomerId: "cus_456",
          stripePaymentMethodId: "pm_123",
        },
      });
    });

    it("upgrades to elite when elite price used", async () => {
      stripeMock.subscriptions.retrieve
        .mockResolvedValueOnce({ metadata: { brofloUserId: "user-1" } })
        .mockResolvedValueOnce({
          items: { data: [{ price: { id: "price_elite_annual" } }] },
          default_payment_method: { id: "pm_456" },
        });

      await (service as any).handleCheckoutCompleted({
        subscription: "sub_200",
        customer: "cus_789",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ subscriptionTier: "elite" }),
      });
    });

    it("sets paymentMethodId to null when payment method is not expanded object", async () => {
      stripeMock.subscriptions.retrieve
        .mockResolvedValueOnce({ metadata: { brofloUserId: "user-1" } })
        .mockResolvedValueOnce({
          items: { data: [{ price: { id: "price_pro_monthly" } }] },
          default_payment_method: null,
        });

      await (service as any).handleCheckoutCompleted({
        subscription: "sub_123",
        customer: "cus_456",
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ stripePaymentMethodId: null }),
      });
    });

    it("silently returns when no brofloUserId in subscription metadata", async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({ metadata: {} });

      await (service as any).handleCheckoutCompleted({
        subscription: "sub_123",
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("silently returns when no subscription and no session metadata userId", async () => {
      await (service as any).handleCheckoutCompleted({
        subscription: null,
        metadata: {},
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handleSubscriptionUpdated", () => {
    let stripeMock: { subscriptions: { retrieve: jest.Mock } };

    beforeEach(() => {
      stripeMock = { subscriptions: { retrieve: jest.fn() } };
      (service as any).stripe = stripeMock;
    });

    it("updates tier and payment method on plan change", async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        default_payment_method: { id: "pm_789" },
      });

      await (service as any).handleSubscriptionUpdated({
        id: "sub_123",
        metadata: { brofloUserId: "user-1" },
        items: { data: [{ price: { id: "price_elite_annual" } }] },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          subscriptionTier: "elite",
          stripeSubscriptionId: "sub_123",
          stripePaymentMethodId: "pm_789",
        },
      });
    });

    it("handles string payment method ID (not expanded)", async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({
        default_payment_method: "pm_string_id",
      });

      await (service as any).handleSubscriptionUpdated({
        id: "sub_123",
        metadata: { brofloUserId: "user-1" },
        items: { data: [{ price: { id: "price_pro_monthly" } }] },
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: expect.objectContaining({ stripePaymentMethodId: null }),
      });
    });

    it("silently returns when no brofloUserId in metadata", async () => {
      await (service as any).handleSubscriptionUpdated({
        id: "sub_123",
        metadata: {},
        items: { data: [] },
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhook", () => {
    it("throws when webhook secret not configured", async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      await expect(
        service.handleWebhook(Buffer.from("{}"), "sig"),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe("getSubscription", () => {
    it("returns subscription info from user", async () => {
      const user = {
        subscriptionTier: "pro",
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: "pm_123",
      } as any;

      const result = await service.getSubscription(user);

      expect(result).toEqual({
        subscriptionTier: "pro",
        stripeSubscriptionId: "sub_123",
        stripeCustomerId: "cus_123",
        hasPaymentMethod: true,
      });
    });

    it("returns hasPaymentMethod false when no payment method", async () => {
      const user = {
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePaymentMethodId: null,
      } as any;

      const result = await service.getSubscription(user);
      expect(result.hasPaymentMethod).toBe(false);
    });
  });

  describe("createPortalSession", () => {
    it("throws when user has no Stripe customer ID", async () => {
      const user = { stripeCustomerId: null } as any;
      await expect(service.createPortalSession(user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
