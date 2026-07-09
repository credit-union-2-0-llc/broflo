import { Test, TestingModule } from "@nestjs/testing";
import { ServiceCreditService } from "../service-credit.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { EntitlementsService } from "../../../entitlements/entitlements.service";
import type { User } from "@prisma/client";

describe("ServiceCreditService", () => {
  let service: ServiceCreditService;
  let prisma: { serviceCredit: { findUnique: jest.Mock; create: jest.Mock } };
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
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
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
      expect.objectContaining({ data: expect.objectContaining({ amountCents: 999 }) }),
    );
  });

  it("skips issuing a duplicate credit within the same billing cycle", async () => {
    entitlements.getIntLimit.mockResolvedValue(999);
    prisma.serviceCredit.findUnique.mockResolvedValue({ id: "existing" });

    const result = await service.issueCredit(makeUser({ subscriptionTier: "pro" }), "job-1", "timeout");

    expect(result).toBe(false);
    expect(prisma.serviceCredit.create).not.toHaveBeenCalled();
  });
});
