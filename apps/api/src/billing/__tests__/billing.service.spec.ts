/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, InternalServerErrorException } from "@nestjs/common";
import { BillingService } from "../billing.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../../email/email.service";
import { FamilyService } from "../../family/family.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";

// Real price->tier mapping now lives in, and is tested by,
// EntitlementsService.tierFromPriceId (see entitlements.service.spec.ts) —
// BillingService just calls it. Mirrors that method's real behavior so the
// checkout/subscription-update tests below don't need to know it's a mock.
function fakeTierFromPriceId(priceId: string | undefined): Promise<string> {
  if (!priceId) return Promise.resolve("free");
  if (priceId === "price_pro_monthly" || priceId === "price_pro_annual") return Promise.resolve("pro");
  if (priceId === "price_elite_monthly" || priceId === "price_elite_annual") return Promise.resolve("elite");
  return Promise.resolve("pro");
}

describe("BillingService", () => {
  let service: BillingService;
  let prisma: { user: { findFirst: jest.Mock; update: jest.Mock } };
  let email: { sendPaymentFailedEmail: jest.Mock };
  let family: { cascadeDowngradeIfOwnerLostFamilyTier: jest.Mock };
  let entitlements: { tierFromPriceId: jest.Mock };

  beforeEach(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    email = {
      sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined),
    };
    family = {
      cascadeDowngradeIfOwnerLostFamilyTier: jest.fn().mockResolvedValue(undefined),
    };
    entitlements = {
      tierFromPriceId: jest.fn().mockImplementation(fakeTierFromPriceId),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: FamilyService, useValue: family },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
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
      expect(family.cascadeDowngradeIfOwnerLostFamilyTier).toHaveBeenCalledWith("user-1");
    });

    it("silently returns when no brofloUserId in metadata", async () => {
      await (service as any).handleSubscriptionDeleted({ metadata: {} });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentFailed", () => {
    it("downgrades user to free and sends a payment-failed email", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user1@example.com",
        stripeCustomerId: "cus_123",
        subscriptionTier: "pro",
      });

      await (service as any).handlePaymentFailed({ customer: "cus_123" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { subscriptionTier: "free" },
      });
      expect(email.sendPaymentFailedEmail).toHaveBeenCalledWith("user1@example.com");
      expect(family.cascadeDowngradeIfOwnerLostFamilyTier).toHaveBeenCalledWith("user-1");
    });

    it("still downgrades the user even if the email send fails", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "user1@example.com",
        stripeCustomerId: "cus_123",
        subscriptionTier: "pro",
      });
      email.sendPaymentFailedEmail.mockRejectedValue(new Error("Resend is down"));

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
      expect(email.sendPaymentFailedEmail).not.toHaveBeenCalled();
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
      (service as any).stripeClient = stripeMock;
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
      (service as any).stripeClient = stripeMock;
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
      expect(family.cascadeDowngradeIfOwnerLostFamilyTier).toHaveBeenCalledWith("user-1");
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
        email: "someone@example.com",
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
        devTierOverrideEnabled: false,
      });
    });

    it("returns hasPaymentMethod false when no payment method", async () => {
      const user = {
        email: "someone@example.com",
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePaymentMethodId: null,
      } as any;

      const result = await service.getSubscription(user);
      expect(result.hasPaymentMethod).toBe(false);
    });

    it("devTierOverrideEnabled is false for a non-allowlisted email even when the master switch is on", async () => {
      process.env.ALLOW_DEV_TIER_OVERRIDE = "true";
      process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS = "test@example.com";
      const user = {
        email: "someone-else@example.com",
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePaymentMethodId: null,
      } as any;

      const result = await service.getSubscription(user);

      expect(result.devTierOverrideEnabled).toBe(false);
      delete process.env.ALLOW_DEV_TIER_OVERRIDE;
      delete process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS;
    });

    it("devTierOverrideEnabled is true for an allowlisted email (case-insensitive) when the master switch is on", async () => {
      process.env.ALLOW_DEV_TIER_OVERRIDE = "true";
      process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS = "Test@Example.com, other@example.com";
      const user = {
        email: "test@example.com",
        subscriptionTier: "free",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        stripePaymentMethodId: null,
      } as any;

      const result = await service.getSubscription(user);

      expect(result.devTierOverrideEnabled).toBe(true);
      delete process.env.ALLOW_DEV_TIER_OVERRIDE;
      delete process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS;
    });
  });

  describe("devSetTier", () => {
    const ORIGINAL_ENV = process.env.ALLOW_DEV_TIER_OVERRIDE;
    const ORIGINAL_ALLOWLIST = process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS;

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) delete process.env.ALLOW_DEV_TIER_OVERRIDE;
      else process.env.ALLOW_DEV_TIER_OVERRIDE = ORIGINAL_ENV;
      if (ORIGINAL_ALLOWLIST === undefined) delete process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS;
      else process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS = ORIGINAL_ALLOWLIST;
    });

    it("throws when the override flag is not enabled", async () => {
      delete process.env.ALLOW_DEV_TIER_OVERRIDE;
      const user = { id: "user-1", email: "test@example.com" } as any;
      await expect(service.devSetTier(user, "pro")).rejects.toThrow(ForbiddenException);
    });

    it("throws when the flag is enabled but the caller's email isn't allowlisted", async () => {
      process.env.ALLOW_DEV_TIER_OVERRIDE = "true";
      process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS = "someone-allowed@example.com";
      const user = { id: "user-1", email: "not-allowed@example.com" } as any;

      await expect(service.devSetTier(user, "pro")).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("throws when the flag is enabled but no allowlist is configured at all (fails closed)", async () => {
      process.env.ALLOW_DEV_TIER_OVERRIDE = "true";
      delete process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS;
      const user = { id: "user-1", email: "anyone@example.com" } as any;

      await expect(service.devSetTier(user, "pro")).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("updates only the caller's own subscriptionTier when enabled and allowlisted", async () => {
      process.env.ALLOW_DEV_TIER_OVERRIDE = "true";
      process.env.DEV_TIER_OVERRIDE_ALLOWED_EMAILS = "user1@example.com";
      const user = { id: "user-1", email: "user1@example.com" } as any;

      const result = await service.devSetTier(user, "elite");

      expect(result).toEqual({ subscriptionTier: "elite" });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { subscriptionTier: "elite" },
      });
      expect(family.cascadeDowngradeIfOwnerLostFamilyTier).toHaveBeenCalledWith("user-1");
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
