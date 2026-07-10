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
import type { CreatePoolDto, ContributeDto } from "./dto/gift-pool.dto";

@Injectable()
export class GiftPoolService {
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

  async createPool(user: User, dto: CreatePoolDto) {
    const groupId = await this.requireMyGroup(user.id);
    return this.prisma.giftPool.create({
      data: {
        familyGroupId: groupId,
        createdByUserId: user.id,
        title: dto.title,
        targetCents: dto.targetCents,
      },
    });
  }

  async listPools(user: User) {
    const groupId = await this.requireMyGroup(user.id);
    const pools = await this.prisma.giftPool.findMany({
      where: { familyGroupId: groupId },
      include: {
        contributions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const contributorIds = [...new Set(pools.flatMap((p) => p.contributions.map((c) => c.userId)))];
    const contributors = contributorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const nameById = new Map(contributors.map((u) => [u.id, u.name || u.email.split("@")[0]]));

    return pools.map((p) => ({
      id: p.id,
      title: p.title,
      targetCents: p.targetCents,
      status: p.status,
      createdByUserId: p.createdByUserId,
      totalCents: p.contributions.reduce((sum, c) => sum + c.amountCents, 0),
      contributions: p.contributions.map((c) => ({
        id: c.id,
        userId: c.userId,
        contributorName: nameById.get(c.userId) ?? "Someone",
        amountCents: c.amountCents,
        note: c.note,
        createdAt: c.createdAt,
      })),
    }));
  }

  private async getPoolInMyGroup(userId: string, poolId: string) {
    const groupId = await this.requireMyGroup(userId);
    const pool = await this.prisma.giftPool.findFirst({
      where: { id: poolId, familyGroupId: groupId },
    });
    if (!pool) throw new NotFoundException("Pool not found");
    return pool;
  }

  async addContribution(user: User, poolId: string, dto: ContributeDto) {
    const pool = await this.getPoolInMyGroup(user.id, poolId);
    if (pool.status !== "open") {
      throw new BadRequestException("This pool is no longer accepting contributions.");
    }

    const contribution = await this.prisma.giftPoolContribution.create({
      data: {
        poolId,
        userId: user.id,
        amountCents: dto.amountCents,
        note: dto.note,
      },
    });

    if (pool.createdByUserId !== user.id) {
      await this.notifications.create(pool.createdByUserId, {
        type: "gift_pool_contribution",
        title: `New chip-in for ${pool.title}`,
        body: `${user.name || user.email} just contributed to the pool.`,
        linkUrl: "/family",
      });
    }

    return contribution;
  }

  async updateContribution(user: User, poolId: string, contributionId: string, dto: ContributeDto) {
    await this.getPoolInMyGroup(user.id, poolId);
    const contribution = await this.prisma.giftPoolContribution.findFirst({
      where: { id: contributionId, poolId, userId: user.id },
    });
    if (!contribution) throw new NotFoundException("Contribution not found");

    return this.prisma.giftPoolContribution.update({
      where: { id: contributionId },
      data: { amountCents: dto.amountCents, note: dto.note },
    });
  }

  async deleteContribution(user: User, poolId: string, contributionId: string) {
    await this.getPoolInMyGroup(user.id, poolId);
    const contribution = await this.prisma.giftPoolContribution.findFirst({
      where: { id: contributionId, poolId, userId: user.id },
    });
    if (!contribution) throw new NotFoundException("Contribution not found");

    await this.prisma.giftPoolContribution.delete({ where: { id: contributionId } });
    return { deleted: true };
  }
}
