import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { GiftPoolService } from "../gift-pool.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { FamilyService } from "../family.service";

describe("GiftPoolService", () => {
  let service: GiftPoolService;
  let prisma: {
    giftPool: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    giftPoolContribution: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let notifications: { create: jest.Mock };
  let family: { getMyFamilyGroupId: jest.Mock };

  const USER = { id: "user-1", email: "user1@example.com", name: "User One" } as User;

  beforeEach(async () => {
    prisma = {
      giftPool: {
        create: jest.fn().mockResolvedValue({ id: "pool-1", title: "Dad's grill", targetCents: 20000 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      giftPoolContribution: {
        create: jest.fn().mockResolvedValue({ id: "contribution-1" }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    family = { getMyFamilyGroupId: jest.fn().mockResolvedValue("group-1") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftPoolService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: FamilyService, useValue: family },
      ],
    }).compile();

    service = module.get(GiftPoolService);
  });

  describe("createPool", () => {
    it("throws when the caller isn't part of a family plan", async () => {
      family.getMyFamilyGroupId.mockResolvedValue(null);
      await expect(
        service.createPool(USER, { title: "Dad's grill", targetCents: 20000 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("creates a pool scoped to the caller's group", async () => {
      await service.createPool(USER, { title: "Dad's grill", targetCents: 20000 });
      expect(prisma.giftPool.create).toHaveBeenCalledWith({
        data: { familyGroupId: "group-1", createdByUserId: "user-1", title: "Dad's grill", targetCents: 20000 },
      });
    });
  });

  describe("listPools", () => {
    it("computes totalCents from contributions and attaches contributor names", async () => {
      prisma.giftPool.findMany.mockResolvedValue([
        {
          id: "pool-1",
          title: "Dad's grill",
          targetCents: 20000,
          status: "open",
          createdByUserId: "user-1",
          contributions: [
            { id: "c1", userId: "user-1", amountCents: 5000, note: null, createdAt: new Date() },
            { id: "c2", userId: "user-2", amountCents: 3000, note: "happy to help", createdAt: new Date() },
          ],
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: "user-1", name: "User One", email: "user1@example.com" },
        { id: "user-2", name: null, email: "user2@example.com" },
      ]);

      const result = await service.listPools(USER);

      expect(result).toHaveLength(1);
      expect(result[0].totalCents).toBe(8000);
      expect(result[0].contributions[0].contributorName).toBe("User One");
      expect(result[0].contributions[1].contributorName).toBe("user2"); // falls back to email local-part
    });
  });

  describe("addContribution", () => {
    const OPEN_POOL = { id: "pool-1", familyGroupId: "group-1", createdByUserId: "user-2", title: "Dad's grill", status: "open" };

    it("throws NotFoundException when the pool isn't in the caller's group", async () => {
      prisma.giftPool.findFirst.mockResolvedValue(null);
      await expect(
        service.addContribution(USER, "pool-1", { amountCents: 1000 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws when the pool is no longer open", async () => {
      prisma.giftPool.findFirst.mockResolvedValue({ ...OPEN_POOL, status: "completed" });
      await expect(
        service.addContribution(USER, "pool-1", { amountCents: 1000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates the contribution and notifies the pool creator", async () => {
      prisma.giftPool.findFirst.mockResolvedValue(OPEN_POOL);

      await service.addContribution(USER, "pool-1", { amountCents: 1000, note: "here you go" });

      expect(prisma.giftPoolContribution.create).toHaveBeenCalledWith({
        data: { poolId: "pool-1", userId: "user-1", amountCents: 1000, note: "here you go" },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "user-2",
        expect.objectContaining({ type: "gift_pool_contribution" }),
      );
    });

    it("does not notify when the contributor is the pool creator themselves", async () => {
      prisma.giftPool.findFirst.mockResolvedValue({ ...OPEN_POOL, createdByUserId: "user-1" });

      await service.addContribution(USER, "pool-1", { amountCents: 1000 });

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe("updateContribution / deleteContribution", () => {
    const OPEN_POOL = { id: "pool-1", familyGroupId: "group-1", createdByUserId: "user-2", status: "open" };

    it("throws when trying to modify someone else's contribution", async () => {
      prisma.giftPool.findFirst.mockResolvedValue(OPEN_POOL);
      prisma.giftPoolContribution.findFirst.mockResolvedValue(null); // scoped to userId: "user-1" in the query

      await expect(
        service.updateContribution(USER, "pool-1", "contribution-1", { amountCents: 2000 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.deleteContribution(USER, "pool-1", "contribution-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("updates the caller's own contribution", async () => {
      prisma.giftPool.findFirst.mockResolvedValue(OPEN_POOL);
      prisma.giftPoolContribution.findFirst.mockResolvedValue({ id: "contribution-1", userId: "user-1" });

      await service.updateContribution(USER, "pool-1", "contribution-1", { amountCents: 2000, note: "updated" });

      expect(prisma.giftPoolContribution.update).toHaveBeenCalledWith({
        where: { id: "contribution-1" },
        data: { amountCents: 2000, note: "updated" },
      });
    });

    it("deletes the caller's own contribution", async () => {
      prisma.giftPool.findFirst.mockResolvedValue(OPEN_POOL);
      prisma.giftPoolContribution.findFirst.mockResolvedValue({ id: "contribution-1", userId: "user-1" });

      const result = await service.deleteContribution(USER, "pool-1", "contribution-1");

      expect(prisma.giftPoolContribution.delete).toHaveBeenCalledWith({ where: { id: "contribution-1" } });
      expect(result).toEqual({ deleted: true });
    });
  });
});
