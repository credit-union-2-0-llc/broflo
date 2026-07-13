import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GiftsService } from "../gifts.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";

describe("GiftsService", () => {
  let service: GiftsService;
  let prisma: {
    person: { findFirst: jest.Mock };
    giftRecord: { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };
  let entitlements: { isFeatureEnabled: jest.Mock };
  let redis: { invalidateByPattern: jest.Mock };

  beforeEach(async () => {
    prisma = {
      person: { findFirst: jest.fn().mockResolvedValue({ id: "p1" }) },
      giftRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { priceCents: 5000 }, _avg: { rating: 4.5 } }),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    entitlements = { isFeatureEnabled: jest.fn() };
    redis = { invalidateByPattern: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
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

  describe("confirmPurchase", () => {
    it("updates priceCents for a suggestion-sourced gift owned by the user", async () => {
      prisma.giftRecord.findFirst.mockResolvedValue({ id: "g1", userId: "u1", source: "suggestion" });
      prisma.giftRecord.update.mockResolvedValue({ id: "g1", priceCents: 4250 });

      const result = await service.confirmPurchase("u1", "g1", { priceCents: 4250 });

      expect(prisma.giftRecord.update).toHaveBeenCalledWith({
        where: { id: "g1" },
        data: { priceCents: 4250 },
      });
      expect(result.priceCents).toBe(4250);
    });

    it("throws NotFoundException when the gift doesn't exist or isn't owned by the user", async () => {
      prisma.giftRecord.findFirst.mockResolvedValue(null);

      await expect(service.confirmPurchase("u1", "g1", { priceCents: 4250 })).rejects.toThrow(NotFoundException);
      expect(prisma.giftRecord.update).not.toHaveBeenCalled();
    });

    it("throws BadRequestException for a manually-logged (non-suggestion) gift", async () => {
      prisma.giftRecord.findFirst.mockResolvedValue({ id: "g1", userId: "u1", source: "manual" });

      await expect(service.confirmPurchase("u1", "g1", { priceCents: 4250 })).rejects.toThrow(BadRequestException);
      expect(prisma.giftRecord.update).not.toHaveBeenCalled();
    });
  });

  describe("deleteGiftRecord", () => {
    it("deletes a gift owned by the user and invalidates that person's suggestion cache", async () => {
      prisma.giftRecord.findFirst.mockResolvedValue({ id: "g1", userId: "u1", personId: "p1" });

      const result = await service.deleteGiftRecord("u1", "g1");

      expect(prisma.giftRecord.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
      expect(redis.invalidateByPattern).toHaveBeenCalledWith("suggest:p1:*");
      expect(result).toEqual({ deleted: true });
    });

    it("throws NotFoundException when the gift doesn't exist or isn't owned by the user", async () => {
      prisma.giftRecord.findFirst.mockResolvedValue(null);

      await expect(service.deleteGiftRecord("u1", "g1")).rejects.toThrow(NotFoundException);
      expect(prisma.giftRecord.delete).not.toHaveBeenCalled();
    });

    it("this works even for a gift with a real order attached (Order.giftRecordId is onDelete: SetNull)", async () => {
      // No order-related mock needed here — the point is deleteGiftRecord
      // doesn't touch the Order table at all, Postgres/Prisma's SetNull
      // handles orphaning the order record automatically.
      prisma.giftRecord.findFirst.mockResolvedValue({ id: "g2", userId: "u1", personId: "p1", source: "ordered" });

      const result = await service.deleteGiftRecord("u1", "g2");

      expect(result).toEqual({ deleted: true });
    });
  });
});
