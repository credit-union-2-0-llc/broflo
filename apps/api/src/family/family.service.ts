import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import { EventsService } from "../events/events.service";
import type { CreateFamilyGroupDto, InviteFamilyMemberDto } from "./dto/family.dto";

const INVITE_TTL_DAYS = 14;
const DEFAULT_MAX_SEATS = 5;

@Injectable()
export class FamilyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementsService,
    private readonly events: EventsService,
  ) {}

  private requireFamilyTier(user: User) {
    if (user.subscriptionTier !== "family") {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: "Family features require the Family plan.",
          upgradeUrl: "/upgrade",
          currentTier: user.subscriptionTier,
          requiredTier: "family",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  // Resolves the family group a user belongs to, whether as owner or
  // member — shared by Secret Santa, gift pooling, and the shared calendar,
  // which all need to know "which group am I in" without caring which role.
  async getMyFamilyGroupId(userId: string): Promise<string | null> {
    const owned = await this.prisma.familyGroup.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (owned) return owned.id;

    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId },
      select: { familyGroupId: true },
    });
    return membership?.familyGroupId ?? null;
  }

  async getFamilyMemberUserIds(familyGroupId: string): Promise<string[]> {
    const group = await this.prisma.familyGroup.findUniqueOrThrow({
      where: { id: familyGroupId },
      include: { memberships: { select: { userId: true } } },
    });
    return [group.ownerId, ...group.memberships.map((m) => m.userId)];
  }

  // Date + occasion only — never the person's full record (no notes, gift
  // plans, or budget). Each member's own people/gifts/events stay private;
  // this is the one deliberate, opt-in exception (per-event, via
  // Event.sharedWithFamily) for "who's coming up" visibility across the group.
  async getSharedEvents(userId: string) {
    const groupId = await this.getMyFamilyGroupId(userId);
    if (!groupId) throw new ForbiddenException("You're not part of a family plan.");

    const memberUserIds = await this.getFamilyMemberUserIds(groupId);
    const events = await this.prisma.event.findMany({
      where: { userId: { in: memberUserIds }, sharedWithFamily: true, userDeleted: false },
      include: { person: { select: { name: true } } },
    });

    // UTC, not local — see computeNextOccurrence's comment.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return events
      .map((e) => {
        const nextOccurrence = this.events.computeNextOccurrence(e.date, e.isRecurring, today);
        return {
          personFirstName: e.person.name.split(" ")[0],
          occasionType: e.occasionType,
          date: nextOccurrence.toISOString().split("T")[0],
          ownerUserId: e.userId,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getMyFamily(user: User) {
    const owned = await this.prisma.familyGroup.findUnique({
      where: { ownerId: user.id },
      include: {
        memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (owned) {
      const maxSeats = await this.entitlements.getIntLimit(
        user.subscriptionTier,
        "familyMaxSeats",
        DEFAULT_MAX_SEATS,
      );
      return {
        role: "owner" as const,
        group: {
          id: owned.id,
          name: owned.name,
          seatsUsed: owned.memberships.length + 1,
          seatsMax: maxSeats ?? DEFAULT_MAX_SEATS,
          members: owned.memberships.map((m) => ({
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            joinedAt: m.joinedAt,
          })),
        },
      };
    }

    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId: user.id },
      include: {
        familyGroup: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
    });

    if (membership) {
      const owner = membership.familyGroup.owner;
      const peers = [
        { userId: owner.id, name: owner.name, email: owner.email },
        ...membership.familyGroup.memberships
          .filter((m) => m.userId !== user.id)
          .map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email })),
      ];
      return {
        role: "member" as const,
        ownerName: owner.name,
        ownerEmail: owner.email,
        familyName: membership.familyGroup.name,
        joinedAt: membership.joinedAt,
        peers,
      };
    }

    return { role: "none" as const };
  }

  async createGroup(user: User, dto: CreateFamilyGroupDto) {
    this.requireFamilyTier(user);

    const [existingGroup, existingMembership] = await Promise.all([
      this.prisma.familyGroup.findUnique({ where: { ownerId: user.id } }),
      this.prisma.familyMembership.findUnique({ where: { userId: user.id } }),
    ]);
    if (existingGroup) {
      throw new BadRequestException("You already have a family group.");
    }
    if (existingMembership) {
      throw new BadRequestException("You're already part of another family plan.");
    }

    return this.prisma.familyGroup.create({
      data: { ownerId: user.id, name: dto.name },
    });
  }

  async inviteMember(user: User, dto: InviteFamilyMemberDto) {
    this.requireFamilyTier(user);

    const group = await this.prisma.familyGroup.findUnique({
      where: { ownerId: user.id },
      include: { memberships: true },
    });
    if (!group) {
      throw new NotFoundException("Create a family group first.");
    }

    const invitedEmail = dto.email.toLowerCase();
    if (invitedEmail === user.email.toLowerCase()) {
      throw new BadRequestException("You can't invite yourself.");
    }

    const maxSeats =
      (await this.entitlements.getIntLimit(
        user.subscriptionTier,
        "familyMaxSeats",
        DEFAULT_MAX_SEATS,
      )) ?? DEFAULT_MAX_SEATS;
    const seatsUsed = group.memberships.length + 1;
    if (seatsUsed >= maxSeats) {
      throw new BadRequestException(
        `Your family plan is full (${maxSeats} seats). Remove someone before inviting another member.`,
      );
    }

    // Superseding a previous pending invite to the same email keeps things
    // simple — only the most recently sent invite for an email is valid.
    await this.prisma.familyInvite.updateMany({
      where: { familyGroupId: group.id, email: invitedEmail, status: "pending" },
      data: { status: "revoked" },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.familyInvite.create({
      data: { familyGroupId: group.id, email: invitedEmail, token, expiresAt },
    });

    const ownerName = user.name || user.email.split("@")[0];
    const familyName = group.name || `${ownerName}'s family`;
    await this.email.sendFamilyInvite(invitedEmail, ownerName, familyName, token);

    return { sent: true };
  }

  private async getValidInvite(token: string) {
    const invite = await this.prisma.familyInvite.findUnique({
      where: { token },
      include: { familyGroup: { include: { owner: { select: { name: true } } } } },
    });
    if (!invite) throw new NotFoundException("Invite not found");
    if (invite.status !== "pending") throw new GoneException("This invite is no longer valid");
    if (invite.expiresAt < new Date()) throw new GoneException("This invite has expired");
    return invite;
  }

  async getInvitePreview(token: string) {
    const invite = await this.getValidInvite(token);
    return {
      familyName: invite.familyGroup.name || `${invite.familyGroup.owner.name || "Someone"}'s family`,
      inviterFirstName: (invite.familyGroup.owner.name || "Someone").split(" ")[0],
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(user: User, token: string) {
    const invite = await this.getValidInvite(token);

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException("This invite was sent to a different email address.");
    }

    const existingMembership = await this.prisma.familyMembership.findUnique({
      where: { userId: user.id },
    });
    if (existingMembership) {
      throw new BadRequestException("You're already part of a family plan.");
    }

    const group = await this.prisma.familyGroup.findUniqueOrThrow({
      where: { id: invite.familyGroupId },
      include: { memberships: true, owner: true },
    });

    const maxSeats =
      (await this.entitlements.getIntLimit(
        group.owner.subscriptionTier,
        "familyMaxSeats",
        DEFAULT_MAX_SEATS,
      )) ?? DEFAULT_MAX_SEATS;
    if (group.memberships.length + 1 >= maxSeats) {
      throw new BadRequestException("This family plan is full.");
    }

    await this.prisma.$transaction([
      this.prisma.familyMembership.create({
        data: { familyGroupId: group.id, userId: user.id },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: "family" },
      }),
      this.prisma.familyInvite.update({
        where: { id: invite.id },
        data: { status: "accepted", acceptedAt: new Date() },
      }),
    ]);

    await this.notifications.create(group.ownerId, {
      type: "family_member_joined",
      title: "Someone joined your family plan",
      body: `${user.name || user.email} just joined your family plan.`,
      linkUrl: "/family",
    });

    return { joined: true, familyName: invite.familyGroup.name };
  }

  async removeMember(owner: User, memberUserId: string) {
    const group = await this.prisma.familyGroup.findUnique({ where: { ownerId: owner.id } });
    if (!group) throw new NotFoundException("You don't own a family group.");

    const membership = await this.prisma.familyMembership.findFirst({
      where: { familyGroupId: group.id, userId: memberUserId },
    });
    if (!membership) throw new NotFoundException("Member not found");

    await this.prisma.$transaction([
      this.prisma.familyMembership.delete({ where: { id: membership.id } }),
      this.prisma.user.update({
        where: { id: memberUserId },
        data: { subscriptionTier: "free" },
      }),
    ]);

    return { removed: true };
  }

  async leaveFamily(user: User) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId: user.id },
    });
    if (!membership) throw new BadRequestException("You're not part of a family plan.");

    await this.prisma.$transaction([
      this.prisma.familyMembership.delete({ where: { id: membership.id } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: "free" },
      }),
    ]);

    return { left: true };
  }

  // Called after something else (real Stripe downgrade, or the dev tier
  // override) has already changed a user's subscriptionTier away from
  // "family". If that user owned a family group, every member loses their
  // free ride too — there's no one left paying for the seats.
  async cascadeDowngradeIfOwnerLostFamilyTier(userId: string) {
    const group = await this.prisma.familyGroup.findUnique({
      where: { ownerId: userId },
      include: { memberships: true },
    });
    if (!group) return;

    const owner = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (owner.subscriptionTier === "family") return;

    const memberIds = group.memberships.map((m) => m.userId);
    await this.prisma.$transaction([
      ...(memberIds.length > 0
        ? [
            this.prisma.user.updateMany({
              where: { id: { in: memberIds } },
              data: { subscriptionTier: "free" },
            }),
          ]
        : []),
      this.prisma.familyGroup.delete({ where: { id: group.id } }),
    ]);
  }
}
