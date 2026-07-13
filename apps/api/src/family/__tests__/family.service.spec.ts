import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { FamilyService } from "../family.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../../email/email.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import { EventsService } from "../../events/events.service";

describe("FamilyService", () => {
  let service: FamilyService;
  let prisma: {
    familyGroup: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; create: jest.Mock; delete: jest.Mock };
    familyMembership: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; delete: jest.Mock };
    familyInvite: { findUnique: jest.Mock; updateMany: jest.Mock; create: jest.Mock; update: jest.Mock };
    user: { update: jest.Mock; updateMany: jest.Mock; findUniqueOrThrow: jest.Mock };
    event: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let email: { sendFamilyInvite: jest.Mock };
  let notifications: { create: jest.Mock };
  let entitlements: { getIntLimit: jest.Mock };
  let events: { computeNextOccurrence: jest.Mock };

  const FAMILY_USER = { id: "owner-1", email: "owner@example.com", name: "Owner", subscriptionTier: "family" } as User;
  const FREE_USER = { id: "user-2", email: "member@example.com", name: "Member", subscriptionTier: "free" } as User;

  beforeEach(async () => {
    prisma = {
      familyGroup: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "group-1", ownerId: "owner-1", name: null }),
        delete: jest.fn().mockResolvedValue({}),
      },
      familyMembership: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "membership-1" }),
        delete: jest.fn().mockResolvedValue({}),
      },
      familyInvite: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: "invite-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      event: { findMany: jest.fn().mockResolvedValue([]) },
      // Supports both $transaction([...]) (array of operations) and the
      // interactive $transaction(async (tx) => {...}) form (used by
      // acceptInvite's serializable seat-count check) — the callback form
      // just re-runs against this same mocked client.
      $transaction: jest.fn().mockImplementation(
        (arg: Promise<unknown>[] | ((tx: unknown) => unknown)) =>
          Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    email = { sendFamilyInvite: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    entitlements = { getIntLimit: jest.fn().mockResolvedValue(5) };
    events = { computeNextOccurrence: jest.fn((date: Date) => date) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamilyService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(FamilyService);
  });

  describe("createGroup", () => {
    it("throws 402 when the user isn't on the family tier", async () => {
      await expect(service.createGroup(FREE_USER, {})).rejects.toBeInstanceOf(HttpException);
      expect(prisma.familyGroup.create).not.toHaveBeenCalled();
    });

    it("throws when the user already owns a group", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "existing-group" });
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      await expect(service.createGroup(FAMILY_USER, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws when the user is already a member of another group", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      prisma.familyMembership.findUnique.mockResolvedValue({ id: "existing-membership" });
      await expect(service.createGroup(FAMILY_USER, {})).rejects.toBeInstanceOf(BadRequestException);
    });

    it("creates a group for a family-tier user with no existing group/membership", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      const result = await service.createGroup(FAMILY_USER, { name: "The Smiths" });
      expect(prisma.familyGroup.create).toHaveBeenCalledWith({
        data: { ownerId: "owner-1", name: "The Smiths" },
      });
      expect(result.id).toBe("group-1");
    });
  });

  describe("inviteMember", () => {
    const GROUP = { id: "group-1", name: "The Smiths", memberships: [] };

    it("throws when the group is full", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({
        ...GROUP,
        memberships: [{ userId: "m1" }, { userId: "m2" }, { userId: "m3" }, { userId: "m4" }],
      });
      entitlements.getIntLimit.mockResolvedValue(5);

      await expect(
        service.inviteMember(FAMILY_USER, { email: "new@example.com" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(email.sendFamilyInvite).not.toHaveBeenCalled();
    });

    it("rejects inviting your own email", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(GROUP);
      await expect(
        service.inviteMember(FAMILY_USER, { email: "OWNER@example.com" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("supersedes a prior pending invite to the same email and sends a new one", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(GROUP);
      await service.inviteMember(FAMILY_USER, { email: "New@Example.com" });

      expect(prisma.familyInvite.updateMany).toHaveBeenCalledWith({
        where: { familyGroupId: "group-1", email: "new@example.com", status: "pending" },
        data: { status: "revoked" },
      });
      expect(prisma.familyInvite.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ familyGroupId: "group-1", email: "new@example.com" }),
        }),
      );
      expect(email.sendFamilyInvite).toHaveBeenCalledWith(
        "new@example.com",
        "Owner",
        "The Smiths",
        expect.any(String),
      );
    });

    it("throws NotFoundException when the caller has no group", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      await expect(
        service.inviteMember(FAMILY_USER, { email: "new@example.com" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("acceptInvite", () => {
    const VALID_INVITE = {
      id: "invite-1",
      familyGroupId: "group-1",
      email: "member@example.com",
      status: "pending",
      expiresAt: new Date(Date.now() + 86400000),
      familyGroup: { name: "The Smiths", owner: { name: "Owner" } },
    };
    const GROUP_WITH_ROOM = {
      id: "group-1",
      ownerId: "owner-1",
      memberships: [],
      owner: { subscriptionTier: "family" },
    };

    it("throws GoneException for an expired invite", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue({
        ...VALID_INVITE,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.acceptInvite(FREE_USER, "token")).rejects.toBeInstanceOf(GoneException);
    });

    it("throws ForbiddenException when the invite email doesn't match the caller", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      const wrongUser = { ...FREE_USER, email: "someone-else@example.com" } as User;
      await expect(service.acceptInvite(wrongUser, "token")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws when the caller is already part of a family plan", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      prisma.familyMembership.findUnique.mockResolvedValue({ id: "already-a-member" });
      await expect(service.acceptInvite(FREE_USER, "token")).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws when the group is full at accept time", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      prisma.familyGroup.findUniqueOrThrow.mockResolvedValue({
        ...GROUP_WITH_ROOM,
        memberships: [{ userId: "m1" }, { userId: "m2" }, { userId: "m3" }, { userId: "m4" }],
      });
      entitlements.getIntLimit.mockResolvedValue(5);

      await expect(service.acceptInvite(FREE_USER, "token")).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.familyMembership.create).not.toHaveBeenCalled();
    });

    it("creates a membership, materializes the family tier, and notifies the owner", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      prisma.familyGroup.findUniqueOrThrow.mockResolvedValue(GROUP_WITH_ROOM);

      const result = await service.acceptInvite(FREE_USER, "token");

      expect(prisma.familyMembership.create).toHaveBeenCalledWith({
        data: { familyGroupId: "group-1", userId: "user-2" },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { subscriptionTier: "family" },
      });
      expect(prisma.familyInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "accepted", acceptedAt: expect.any(Date) },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "owner-1",
        expect.objectContaining({ type: "family_member_joined" }),
      );
      expect(result.joined).toBe(true);
    });

    it("uses a serializable transaction for the seat-count check + create", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      prisma.familyGroup.findUniqueOrThrow.mockResolvedValue(GROUP_WITH_ROOM);

      await service.acceptInvite(FREE_USER, "token");

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });

    it("regression: translates a Postgres serialization failure (two invitees racing for the last seat) into a plain BadRequestException, not a 500", async () => {
      prisma.familyInvite.findUnique.mockResolvedValue(VALID_INVITE);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict", {
          code: "P2034",
          clientVersion: "test",
        }),
      );

      await expect(service.acceptInvite(FREE_USER, "token")).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("removeMember / leaveFamily", () => {
    it("removeMember reverts the removed member's tier to free", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "group-1" });
      prisma.familyMembership.findFirst.mockResolvedValue({ id: "membership-1", userId: "user-2" });

      await service.removeMember(FAMILY_USER, "user-2");

      expect(prisma.familyMembership.delete).toHaveBeenCalledWith({ where: { id: "membership-1" } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { subscriptionTier: "free" },
      });
    });

    it("removeMember throws when the caller doesn't own a group", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      await expect(service.removeMember(FAMILY_USER, "user-2")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("leaveFamily reverts the caller's own tier to free", async () => {
      prisma.familyMembership.findUnique.mockResolvedValue({ id: "membership-1" });

      await service.leaveFamily(FREE_USER);

      expect(prisma.familyMembership.delete).toHaveBeenCalledWith({ where: { id: "membership-1" } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-2" },
        data: { subscriptionTier: "free" },
      });
    });

    it("leaveFamily throws when the caller isn't a member of any family plan", async () => {
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      await expect(service.leaveFamily(FREE_USER)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("cascadeDowngradeIfOwnerLostFamilyTier", () => {
    it("does nothing if the user doesn't own a family group", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      await service.cascadeDowngradeIfOwnerLostFamilyTier("owner-1");
      expect(prisma.familyGroup.delete).not.toHaveBeenCalled();
    });

    it("does nothing if the owner is still on the family tier", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "group-1", memberships: [] });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "owner-1", subscriptionTier: "family" });
      await service.cascadeDowngradeIfOwnerLostFamilyTier("owner-1");
      expect(prisma.familyGroup.delete).not.toHaveBeenCalled();
    });

    it("reverts every member to free and deletes the group when the owner lost family tier", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({
        id: "group-1",
        memberships: [{ userId: "m1" }, { userId: "m2" }],
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "owner-1", subscriptionTier: "free" });

      await service.cascadeDowngradeIfOwnerLostFamilyTier("owner-1");

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ["m1", "m2"] } },
        data: { subscriptionTier: "free" },
      });
      expect(prisma.familyGroup.delete).toHaveBeenCalledWith({ where: { id: "group-1" } });
    });

    it("still deletes the group when it has no members", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "group-1", memberships: [] });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "owner-1", subscriptionTier: "free" });

      await service.cascadeDowngradeIfOwnerLostFamilyTier("owner-1");

      expect(prisma.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.familyGroup.delete).toHaveBeenCalledWith({ where: { id: "group-1" } });
    });
  });

  describe("getSharedEvents", () => {
    it("throws when the caller isn't part of a family plan", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue(null);
      prisma.familyMembership.findUnique.mockResolvedValue(null);
      await expect(service.getSharedEvents("owner-1")).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns only date/occasion/first-name/owner — never notes, budget, or gift plans", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "group-1", ownerId: "owner-1" });
      prisma.familyGroup.findUniqueOrThrow.mockResolvedValue({
        id: "group-1",
        ownerId: "owner-1",
        memberships: [{ userId: "member-1" }],
      });
      prisma.event.findMany.mockResolvedValue([
        {
          userId: "member-1",
          occasionType: "birthday",
          date: new Date("2026-08-15"),
          isRecurring: true,
          person: { name: "Alice Smith" },
        },
      ]);
      events.computeNextOccurrence.mockReturnValue(new Date("2026-08-15"));

      const result = await service.getSharedEvents("owner-1");

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { userId: { in: ["owner-1", "member-1"] }, sharedWithFamily: true, userDeleted: false },
        include: { person: { select: { name: true } } },
      });
      expect(result).toEqual([
        { personFirstName: "Alice", occasionType: "birthday", date: "2026-08-15", ownerUserId: "member-1" },
      ]);
    });

    it("sorts multiple shared events by date", async () => {
      prisma.familyGroup.findUnique.mockResolvedValue({ id: "group-1", ownerId: "owner-1" });
      prisma.familyGroup.findUniqueOrThrow.mockResolvedValue({
        id: "group-1",
        ownerId: "owner-1",
        memberships: [],
      });
      prisma.event.findMany.mockResolvedValue([
        { userId: "owner-1", occasionType: "birthday", date: new Date("2026-12-01"), isRecurring: false, person: { name: "Later Person" } },
        { userId: "owner-1", occasionType: "anniversary", date: new Date("2026-08-01"), isRecurring: false, person: { name: "Earlier Person" } },
      ]);
      events.computeNextOccurrence.mockImplementation((date: Date) => date);

      const result = await service.getSharedEvents("owner-1");

      expect(result.map((e) => e.personFirstName)).toEqual(["Earlier", "Later"]);
    });
  });
});
