import { Test, TestingModule } from "@nestjs/testing";
import { GiftsService } from "../gifts.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";

describe("GiftsService", () => {
  let service: GiftsService;
  let prisma: {
    person: { findFirst: jest.Mock };
    giftRecord: { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
  };
  let entitlements: { isFeatureEnabled: jest.Mock };

  beforeEach(async () => {
    prisma = {
      person: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }) },
      giftRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { priceCents: 5000 }, _avg: { rating: 4.5 } }),
      },
    };
    entitlements = { isFeatureEnabled: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: {} },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(GiftsService);
  });

  describe("listGifts — year filter + aggregates gate", () => {
    it("ignores the year param and skips aggregates for a free-tier user", async () => {
      entitlements.isFeatureEnabled.mockResolvedValue(false);

      const result = await service.listGifts("u1", "p1", { year: 2025 }, "free");

      expect(prisma.giftRecord.aggregate).not.toHaveBeenCalled();
      expect(result.meta.totalSpendCents).toBeUndefined();
      expect(result.meta.averageRating).toBeUndefined();
      const whereArg = prisma.giftRecord.findMany.mock.calls[0][0].where;
      expect(whereArg.givenAt).toBeUndefined();
    });

    it("applies the year filter and computes aggregates for a pro user", async () => {
      entitlements.isFeatureEnabled.mockResolvedValue(true);

      const result = await service.listGifts("u1", "p1", { year: 2025 }, "pro");

      expect(entitlements.isFeatureEnabled).toHaveBeenCalledWith("pro", "giftHistoryYearFilter");
      expect(prisma.giftRecord.aggregate).toHaveBeenCalled();
      expect(result.meta.totalSpendCents).toBe(5000);
      expect(result.meta.averageRating).toBe(4.5);
      const whereArg = prisma.giftRecord.findMany.mock.calls[0][0].where;
      expect(whereArg.givenAt).toBeDefined();
    });
  });
});
