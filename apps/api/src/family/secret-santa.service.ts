import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { FamilyService } from "./family.service";
import type { CreateExchangeDto, JoinExchangeDto } from "./dto/secret-santa.dto";

const MIN_PARTICIPANTS = 3;
const MAX_ASSIGNMENT_ATTEMPTS = 200;

@Injectable()
export class SecretSantaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly family: FamilyService,
  ) {}

  private async requireMyGroup(userId: string): Promise<string> {
    const groupId = await this.family.getMyFamilyGroupId(userId);
    if (!groupId) throw new ForbiddenException("You're not part of a family plan.");
    return groupId;
  }

  async createExchange(user: User, dto: CreateExchangeDto) {
    const groupId = await this.requireMyGroup(user.id);

    const exchange = await this.prisma.secretSantaExchange.create({
      data: {
        familyGroupId: groupId,
        createdByUserId: user.id,
        name: dto.name,
        budgetCents: dto.budgetCents,
      },
    });

    // Creator automatically joins as the first participant.
    await this.prisma.secretSantaParticipant.create({
      data: { exchangeId: exchange.id, userId: user.id },
    });

    return exchange;
  }

  async listExchanges(user: User) {
    const groupId = await this.requireMyGroup(user.id);
    const exchanges = await this.prisma.secretSantaExchange.findMany({
      where: { familyGroupId: groupId },
      include: { participants: { select: { userId: true } } },
      orderBy: { createdAt: "desc" },
    });

    return exchanges.map((e) => ({
      id: e.id,
      name: e.name,
      budgetCents: e.budgetCents,
      status: e.status,
      createdByUserId: e.createdByUserId,
      participantCount: e.participants.length,
      isParticipant: e.participants.some((p) => p.userId === user.id),
    }));
  }

  private async getExchangeInMyGroup(user: User, exchangeId: string) {
    const groupId = await this.requireMyGroup(user.id);
    const exchange = await this.prisma.secretSantaExchange.findFirst({
      where: { id: exchangeId, familyGroupId: groupId },
      include: { participants: true },
    });
    if (!exchange) throw new NotFoundException("Exchange not found");
    return exchange;
  }

  async joinExchange(user: User, exchangeId: string, dto: JoinExchangeDto) {
    const exchange = await this.getExchangeInMyGroup(user, exchangeId);
    if (exchange.status !== "open") {
      throw new BadRequestException("This exchange has already been assigned.");
    }
    if (exchange.participants.some((p) => p.userId === user.id)) {
      throw new BadRequestException("You've already joined this exchange.");
    }

    return this.prisma.secretSantaParticipant.create({
      data: {
        exchangeId,
        userId: user.id,
        excludeUserIds: dto.excludeUserIds ?? [],
      },
    });
  }

  async assign(user: User, exchangeId: string) {
    const exchange = await this.getExchangeInMyGroup(user, exchangeId);
    if (exchange.createdByUserId !== user.id) {
      throw new ForbiddenException("Only the organizer can run the assignment.");
    }
    if (exchange.status !== "open") {
      throw new BadRequestException("This exchange has already been assigned.");
    }
    if (exchange.participants.length < MIN_PARTICIPANTS) {
      throw new BadRequestException(
        `Need at least ${MIN_PARTICIPANTS} participants to run a Secret Santa.`,
      );
    }

    const participants = exchange.participants;
    // Symmetric exclusions — if A excludes B, treat it as B excluding A too;
    // the real-world case is usually mutual (e.g. don't pair spouses).
    const exclusions = new Map<string, Set<string>>();
    for (const p of participants) {
      if (!exclusions.has(p.userId)) exclusions.set(p.userId, new Set());
      for (const excluded of p.excludeUserIds) {
        exclusions.get(p.userId)!.add(excluded);
        if (!exclusions.has(excluded)) exclusions.set(excluded, new Set());
        exclusions.get(excluded)!.add(p.userId);
      }
    }

    const userIds = participants.map((p) => p.userId);
    const assignment = this.findValidAssignment(userIds, exclusions);
    if (!assignment) {
      throw new BadRequestException(
        "Couldn't find a valid pairing with these exclusions — try removing one.",
      );
    }

    await this.prisma.$transaction([
      ...participants.map((p) =>
        this.prisma.secretSantaParticipant.update({
          where: { id: p.id },
          data: { assignedToUserId: assignment.get(p.userId) },
        }),
      ),
      this.prisma.secretSantaExchange.update({
        where: { id: exchangeId },
        data: { status: "assigned" },
      }),
    ]);

    await Promise.all(
      userIds.map((userId) =>
        this.notifications.create(userId, {
          type: "secret_santa_assigned",
          title: `${exchange.name} assignments are ready`,
          body: "Your Secret Santa match is ready to reveal.",
          linkUrl: "/family",
        }),
      ),
    );

    return { assigned: true };
  }

  // Randomized cyclic-shuffle derangement with retry, falling back to
  // backtracking if exclusions are tight enough that random retries don't
  // converge (family-sized groups mean this almost always succeeds fast).
  private findValidAssignment(
    userIds: string[],
    exclusions: Map<string, Set<string>>,
  ): Map<string, string> | null {
    const isValid = (giver: string, receiver: string) =>
      giver !== receiver && !exclusions.get(giver)?.has(receiver);

    for (let attempt = 0; attempt < MAX_ASSIGNMENT_ATTEMPTS; attempt++) {
      const shuffled = [...userIds].sort(() => Math.random() - 0.5);
      const assignment = new Map<string, string>();
      let ok = true;
      for (let i = 0; i < shuffled.length; i++) {
        const giver = shuffled[i];
        const receiver = shuffled[(i + 1) % shuffled.length];
        if (!isValid(giver, receiver)) {
          ok = false;
          break;
        }
        assignment.set(giver, receiver);
      }
      if (ok) return assignment;
    }

    return this.backtrackAssignment(userIds, isValid);
  }

  private backtrackAssignment(
    userIds: string[],
    isValid: (giver: string, receiver: string) => boolean,
  ): Map<string, string> | null {
    const assignment = new Map<string, string>();
    const usedReceivers = new Set<string>();

    const backtrack = (index: number): boolean => {
      if (index === userIds.length) return true;
      const giver = userIds[index];
      for (const receiver of userIds) {
        if (usedReceivers.has(receiver) || !isValid(giver, receiver)) continue;
        assignment.set(giver, receiver);
        usedReceivers.add(receiver);
        if (backtrack(index + 1)) return true;
        usedReceivers.delete(receiver);
        assignment.delete(giver);
      }
      return false;
    };

    return backtrack(0) ? assignment : null;
  }

  async getMyAssignment(user: User, exchangeId: string) {
    const exchange = await this.getExchangeInMyGroup(user, exchangeId);
    const myParticipation = exchange.participants.find((p) => p.userId === user.id);
    if (!myParticipation) {
      throw new ForbiddenException("You're not a participant in this exchange.");
    }
    if (!myParticipation.assignedToUserId) {
      return { assigned: false as const };
    }

    const recipient = await this.prisma.user.findUniqueOrThrow({
      where: { id: myParticipation.assignedToUserId },
      select: { name: true, email: true },
    });

    return {
      assigned: true as const,
      recipientName: recipient.name || recipient.email.split("@")[0],
    };
  }
}
