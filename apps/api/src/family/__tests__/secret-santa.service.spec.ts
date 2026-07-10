import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { User } from "@prisma/client";
import { SecretSantaService } from "../secret-santa.service";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { FamilyService } from "../family.service";

describe("SecretSantaService", () => {
  let service: SecretSantaService;
  let prisma: {
    secretSantaExchange: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    secretSantaParticipant: { create: jest.Mock; update: jest.Mock };
    user: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };
  let notifications: { create: jest.Mock };
  let family: { getMyFamilyGroupId: jest.Mock };

  const USER = { id: "user-1", email: "user1@example.com", name: "User One" } as User;

  beforeEach(async () => {
    prisma = {
      secretSantaExchange: {
        create: jest.fn().mockResolvedValue({ id: "exchange-1", name: "Office Party" }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      secretSantaParticipant: {
        create: jest.fn().mockResolvedValue({ id: "participant-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    family = { getMyFamilyGroupId: jest.fn().mockResolvedValue("group-1") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretSantaService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: FamilyService, useValue: family },
      ],
    }).compile();

    service = module.get(SecretSantaService);
  });

  describe("createExchange", () => {
    it("throws when the caller isn't part of a family plan", async () => {
      family.getMyFamilyGroupId.mockResolvedValue(null);
      await expect(
        service.createExchange(USER, { name: "Office Party" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("creates the exchange and adds the creator as the first participant", async () => {
      await service.createExchange(USER, { name: "Office Party", budgetCents: 2500 });

      expect(prisma.secretSantaExchange.create).toHaveBeenCalledWith({
        data: { familyGroupId: "group-1", createdByUserId: "user-1", name: "Office Party", budgetCents: 2500 },
      });
      expect(prisma.secretSantaParticipant.create).toHaveBeenCalledWith({
        data: { exchangeId: "exchange-1", userId: "user-1" },
      });
    });
  });

  describe("joinExchange", () => {
    const OPEN_EXCHANGE = {
      id: "exchange-1",
      familyGroupId: "group-1",
      createdByUserId: "user-1",
      status: "open",
      participants: [{ id: "p1", userId: "user-1", excludeUserIds: [] }],
    };

    it("throws NotFoundException when the exchange isn't in the caller's group", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue(null);
      await expect(service.joinExchange(USER, "exchange-1", {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws when the exchange has already been assigned", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue({ ...OPEN_EXCHANGE, status: "assigned" });
      await expect(service.joinExchange(USER, "exchange-1", {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws when the caller already joined", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue(OPEN_EXCHANGE);
      await expect(service.joinExchange(USER, "exchange-1", {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it("adds a new participant with exclusions", async () => {
      const otherUser = { ...USER, id: "user-2" } as User;
      prisma.secretSantaExchange.findFirst.mockResolvedValue(OPEN_EXCHANGE);

      await service.joinExchange(otherUser, "exchange-1", { excludeUserIds: ["user-3"] });

      expect(prisma.secretSantaParticipant.create).toHaveBeenCalledWith({
        data: { exchangeId: "exchange-1", userId: "user-2", excludeUserIds: ["user-3"] },
      });
    });
  });

  describe("assign", () => {
    function exchangeWith(participants: Array<{ userId: string; excludeUserIds?: string[] }>) {
      return {
        id: "exchange-1",
        name: "Office Party",
        familyGroupId: "group-1",
        createdByUserId: "user-1",
        status: "open",
        participants: participants.map((p, i) => ({
          id: `p${i}`,
          userId: p.userId,
          excludeUserIds: p.excludeUserIds ?? [],
        })),
      };
    }

    it("throws when the caller isn't the organizer", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue(
        exchangeWith([{ userId: "user-1" }, { userId: "user-2" }, { userId: "user-3" }]),
      );
      const notOrganizer = { ...USER, id: "user-2" } as User;
      await expect(service.assign(notOrganizer, "exchange-1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws when there are fewer than 3 participants", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue(
        exchangeWith([{ userId: "user-1" }, { userId: "user-2" }]),
      );
      await expect(service.assign(USER, "exchange-1")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("assigns everyone to someone else, never themselves, respecting exclusions", async () => {
      const participants = [
        { userId: "user-1", excludeUserIds: ["user-2"] }, // user-1 and user-2 mutually excluded (e.g. spouses)
        { userId: "user-2" },
        { userId: "user-3" },
        { userId: "user-4" },
      ];
      prisma.secretSantaExchange.findFirst.mockResolvedValue(exchangeWith(participants));

      await service.assign(USER, "exchange-1");

      const updateCalls = prisma.secretSantaParticipant.update.mock.calls;
      expect(updateCalls).toHaveLength(4);

      const assignment = new Map<string, string>();
      for (const [call] of updateCalls) {
        const participantIndex = Number(call.where.id.replace("p", ""));
        assignment.set(participants[participantIndex].userId, call.data.assignedToUserId);
      }

      // No self-assignment
      for (const [giver, receiver] of assignment) {
        expect(giver).not.toBe(receiver);
      }
      // Mutual exclusion respected both directions
      expect(assignment.get("user-1")).not.toBe("user-2");
      expect(assignment.get("user-2")).not.toBe("user-1");
      // Everyone assigned exactly once as a receiver (it's a permutation)
      expect(new Set(assignment.values()).size).toBe(4);

      expect(prisma.secretSantaExchange.update).toHaveBeenCalledWith({
        where: { id: "exchange-1" },
        data: { status: "assigned" },
      });
      expect(notifications.create).toHaveBeenCalledTimes(4);
    });

    it("throws when exclusions make a valid assignment impossible", async () => {
      // 3 participants, each excludes both others — no valid assignment can exist.
      const participants = [
        { userId: "user-1", excludeUserIds: ["user-2", "user-3"] },
        { userId: "user-2", excludeUserIds: ["user-1", "user-3"] },
        { userId: "user-3", excludeUserIds: ["user-1", "user-2"] },
      ];
      prisma.secretSantaExchange.findFirst.mockResolvedValue(exchangeWith(participants));

      await expect(service.assign(USER, "exchange-1")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("getMyAssignment", () => {
    it("throws when the caller isn't a participant", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue({
        id: "exchange-1",
        participants: [{ id: "p1", userId: "user-2", assignedToUserId: null }],
      });
      await expect(service.getMyAssignment(USER, "exchange-1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns assigned: false when the exchange hasn't been assigned yet", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue({
        id: "exchange-1",
        participants: [{ id: "p1", userId: "user-1", assignedToUserId: null }],
      });
      const result = await service.getMyAssignment(USER, "exchange-1");
      expect(result).toEqual({ assigned: false });
    });

    it("returns only the caller's own recipient, never the full mapping", async () => {
      prisma.secretSantaExchange.findFirst.mockResolvedValue({
        id: "exchange-1",
        participants: [
          { id: "p1", userId: "user-1", assignedToUserId: "user-2" },
          { id: "p2", userId: "user-2", assignedToUserId: "user-3" },
        ],
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ name: "Alice", email: "alice@example.com" });

      const result = await service.getMyAssignment(USER, "exchange-1");

      expect(result).toEqual({ assigned: true, recipientName: "Alice" });
      expect(Object.keys(result)).not.toContain("participants");
    });
  });
});
