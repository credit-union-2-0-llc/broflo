import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAutopilotRuleDto, UpdateAutopilotRuleDto, ListAutopilotRunsDto } from './dto/autopilot.dto';

const PLATFORM_MONTHLY_CAP_CENTS = 200000; // $2,000 hard cap

@Injectable()
export class AutopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createRule(userId: string, dto: CreateAutopilotRuleDto, ip: string) {
    if (!dto.consentGiven) {
      throw new BadRequestException('You must consent to automatic ordering to enable Autopilot.');
    }

    if (dto.budgetMinCents > dto.budgetMaxCents) {
      throw new BadRequestException('Minimum budget must be less than maximum.');
    }

    if (dto.monthlyCapCents > PLATFORM_MONTHLY_CAP_CENTS) {
      throw new BadRequestException(`Monthly cap cannot exceed $${PLATFORM_MONTHLY_CAP_CENTS / 100}.`);
    }

    // Verify person ownership
    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, userId, deletedAt: null },
    });
    if (!person) throw new NotFoundException('Person not found');

    // Check for existing rule
    const existing = await this.prisma.autopilotRule.findUnique({
      where: { uq_autopilot_user_person: { userId, personId: dto.personId } },
    });
    if (existing) {
      throw new BadRequestException('An autopilot rule already exists for this person. Update it instead.');
    }

    const rule = await this.prisma.autopilotRule.create({
      data: {
        userId,
        personId: dto.personId,
        occasionTypes: dto.occasionTypes,
        budgetMinCents: dto.budgetMinCents,
        budgetMaxCents: dto.budgetMaxCents,
        monthlyCapCents: dto.monthlyCapCents,
        leadDays: dto.leadDays ?? 7,
        consentedAt: new Date(),
        consentedFromIp: ip,
      },
      include: { person: { select: { name: true } } },
    });

    await this.notifications.create(userId, {
      type: 'autopilot_enabled',
      title: 'Autopilot Enabled',
      body: `Autopilot is now active for ${person.name}. We'll handle gifts automatically.`,
      linkUrl: '/autopilot',
    });

    return rule;
  }

  async updateRule(userId: string, ruleId: string, dto: UpdateAutopilotRuleDto) {
    const rule = await this.prisma.autopilotRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) throw new NotFoundException('Autopilot rule not found');

    if (dto.monthlyCapCents && dto.monthlyCapCents > PLATFORM_MONTHLY_CAP_CENTS) {
      throw new BadRequestException(`Monthly cap cannot exceed $${PLATFORM_MONTHLY_CAP_CENTS / 100}.`);
    }

    const minCents = dto.budgetMinCents ?? rule.budgetMinCents;
    const maxCents = dto.budgetMaxCents ?? rule.budgetMaxCents;
    if (minCents > maxCents) {
      throw new BadRequestException('Minimum budget must be less than maximum.');
    }

    return this.prisma.autopilotRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.occasionTypes !== undefined && { occasionTypes: dto.occasionTypes }),
        ...(dto.budgetMinCents !== undefined && { budgetMinCents: dto.budgetMinCents }),
        ...(dto.budgetMaxCents !== undefined && { budgetMaxCents: dto.budgetMaxCents }),
        ...(dto.monthlyCapCents !== undefined && { monthlyCapCents: dto.monthlyCapCents }),
        ...(dto.leadDays !== undefined && { leadDays: dto.leadDays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { person: { select: { name: true } } },
    });
  }

  async deleteRule(userId: string, ruleId: string) {
    const rule = await this.prisma.autopilotRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) throw new NotFoundException('Autopilot rule not found');

    await this.prisma.autopilotRule.delete({ where: { id: ruleId } });
    return { deleted: true };
  }

  async listRules(userId: string) {
    return this.prisma.autopilotRule.findMany({
      where: { userId },
      include: {
        person: { select: { name: true } },
        runs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRule(userId: string, ruleId: string) {
    const rule = await this.prisma.autopilotRule.findFirst({
      where: { id: ruleId, userId },
      include: {
        person: { select: { name: true } },
        runs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!rule) throw new NotFoundException('Autopilot rule not found');
    return rule;
  }

  async listRuns(userId: string, dto: ListAutopilotRunsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Record<string, unknown> = {
      rule: { userId },
    };
    if (dto.ruleId) where.ruleId = dto.ruleId;

    const [total, runs] = await Promise.all([
      this.prisma.autopilotRun.count({ where }),
      this.prisma.autopilotRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: { select: { person: { select: { name: true } } } },
          event: { select: { name: true, occasionType: true } },
        },
      }),
    ]);

    return { data: runs, meta: { page, limit, total } };
  }

  async getMonthlySpend(userId: string, ruleId?: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
      rule: { userId },
      status: 'order_placed',
      createdAt: { gte: startOfMonth },
    };
    if (ruleId) where.ruleId = ruleId;

    const result = await this.prisma.autopilotRun.aggregate({
      where,
      _sum: { amountCents: true },
    });

    return result._sum.amountCents ?? 0;
  }

  async checkSpendingCap(userId: string, ruleId: string, proposedAmountCents: number): Promise<{
    allowed: boolean;
    monthlySpentCents: number;
    monthlyCap: number;
  }> {
    const rule = await this.prisma.autopilotRule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    const monthlySpentCents = await this.getMonthlySpend(userId, ruleId);
    const cap = Math.min(rule.monthlyCapCents, PLATFORM_MONTHLY_CAP_CENTS);

    return {
      allowed: monthlySpentCents + proposedAmountCents <= cap,
      monthlySpentCents,
      monthlyCap: cap,
    };
  }
}
