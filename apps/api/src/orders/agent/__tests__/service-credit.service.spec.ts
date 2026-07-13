import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { ServiceCreditService } from "../service-credit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { EntitlementsService } from "../../../entitlements/entitlements.service";
import type { User } from "@prisma/client";

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("ServiceCreditService", () => {
  let service: ServiceCreditService;
  let prisma: { serviceCredit: { create: jest.Mock; update: jest.Mock } };
  let entitlements: { getIntLimit: jest.Mock };

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      id: "u1",
      subscriptionTier: "free",
      stripeCustomerId: null,
      ...overrides,
    } as User;
  }

  beforeEach(async () => {
    prisma = {
      serviceCredit: {
        create: jest.fn().mockResolvedValue({ id: "credit-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    entitlements = { getIntLimit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCreditService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(ServiceCreditService);
  });

  it("issues no credit for a free-tier user (amountCents 0)", async () => {
    entitlements.getIntLimit.mockResolvedValue(0);

    const result = await service.issueCredit(makeUser({ subscriptionTier: "free" }), "job-1", "timeout");

    expect(result).toBe(false);
    expect(prisma.serviceCredit.create).not.toHaveBeenCalled();
    expect(entitlements.getIntLimit).toHaveBeenCalledWith("free", "serviceCreditCents", 0);
  });

  it("issues a $9.99 credit for a pro-tier user with no Stripe customer on file", async () => {
    entitlements.getIntLimit.mockResolvedValue(999);

    const result = await service.issueCredit(makeUser({ subscriptionTier: "pro" }), "job-1", "timeout");

    expect(result).toBe(true);
    expect(prisma.serviceCredit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountCents: 999, stripeCouponId: null }) }),
    );
    // No Stripe customer on file — nothing to reconcile afterward.
    expect(prisma.serviceCredit.update).not.toHaveBeenCalled();
  });

  it("skips issuing a duplicate credit within the same billing cycle (DB claim loses on the unique constraint)", async () => {
    entitlements.getIntLimit.mockResolvedValue(999);
    prisma.serviceCredit.create.mockRejectedValueOnce(p2002());

    const result = await service.issueCredit(makeUser({ subscriptionTier: "pro" }), "job-1", "timeout");

    expect(result).toBe(false);
  });

  it("re-throws a non-P2002 database error instead of treating it as a duplicate", async () => {
    entitlements.getIntLimit.mockResolvedValue(999);
    prisma.serviceCredit.create.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      service.issueCredit(makeUser({ subscriptionTier: "pro" }), "job-1", "timeout"),
    ).rejects.toThrow("connection lost");
  });

  it("regression: claims the DB row before ever touching Stripe, so a losing race never issues real money", async () => {
    // This is the actual bug: the old check-then-act order let two
    // concurrent callers both pass a findUnique miss, both call Stripe
    // (issuing two real credits), and only fail on the second DB insert —
    // by then the double charge was already unrecoverable. Now the DB
    // claim happens first via the unique constraint, so a losing caller
    // returns before Stripe is ever called. Proven here by deliberately
    // leaving STRIPE_SECRET_KEY unset — the private `stripe` getter throws
    // if it's ever accessed, so a clean `false` resolution (no throw) means
    // this losing caller genuinely never reached the Stripe call.
    delete process.env.STRIPE_SECRET_KEY;
    entitlements.getIntLimit.mockResolvedValue(999);
    prisma.serviceCredit.create.mockRejectedValueOnce(p2002());

    const result = await service.issueCredit(
      makeUser({ subscriptionTier: "pro", stripeCustomerId: "cus_123" }),
      "job-1",
      "timeout",
    );

    expect(result).toBe(false);
  });
});
