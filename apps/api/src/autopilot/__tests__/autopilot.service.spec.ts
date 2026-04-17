/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AutopilotService } from '../autopilot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('AutopilotService', () => {
  let service: AutopilotService;
  let prisma: any;
  let notifications: { create: jest.Mock };

  const userId = 'user-1';
  const ruleId = 'rule-1';
  const personId = 'person-1';

  const baseDto = {
    personId,
    occasionTypes: ['birthday'],
    budgetMinCents: 2000,
    budgetMaxCents: 5000,
    monthlyCapCents: 10000,
    leadDays: 7,
    consentGiven: true,
  };

  const mockRule = {
    id: ruleId,
    userId,
    personId,
    budgetMinCents: 2000,
    budgetMaxCents: 5000,
    monthlyCapCents: 10000,
    leadDays: 7,
    isActive: true,
    person: { name: 'Test Person' },
  };

  beforeEach(async () => {
    prisma = {
      person: { findFirst: jest.fn() },
      autopilotRule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      autopilotRun: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: null } }),
      },
    };

    notifications = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutopilotService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(AutopilotService);
  });

  describe('createRule', () => {
    it('creates a rule and sends notification', async () => {
      prisma.person.findFirst.mockResolvedValue({ id: personId, name: 'Test Person' });
      prisma.autopilotRule.findUnique.mockResolvedValue(null);
      prisma.autopilotRule.create.mockResolvedValue(mockRule);

      const result = await service.createRule(userId, baseDto, '127.0.0.1');

      expect(result).toEqual(mockRule);
      expect(prisma.autopilotRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            personId,
            budgetMinCents: 2000,
            budgetMaxCents: 5000,
            consentedFromIp: '127.0.0.1',
          }),
        }),
      );
      expect(notifications.create).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ type: 'autopilot_enabled' }),
      );
    });

    it('throws when consent not given', async () => {
      await expect(
        service.createRule(userId, { ...baseDto, consentGiven: false }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when min budget exceeds max', async () => {
      await expect(
        service.createRule(userId, { ...baseDto, budgetMinCents: 6000, budgetMaxCents: 5000 }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when monthly cap exceeds platform limit', async () => {
      await expect(
        service.createRule(userId, { ...baseDto, monthlyCapCents: 300000 }, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when person not found', async () => {
      prisma.person.findFirst.mockResolvedValue(null);

      await expect(
        service.createRule(userId, baseDto, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when rule already exists for person', async () => {
      prisma.person.findFirst.mockResolvedValue({ id: personId, name: 'Test' });
      prisma.autopilotRule.findUnique.mockResolvedValue({ id: 'existing-rule' });

      await expect(
        service.createRule(userId, baseDto, '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults leadDays to 7 when not provided', async () => {
      prisma.person.findFirst.mockResolvedValue({ id: personId, name: 'Test' });
      prisma.autopilotRule.findUnique.mockResolvedValue(null);
      prisma.autopilotRule.create.mockResolvedValue(mockRule);

      const { leadDays, ...dtoWithoutLead } = baseDto;
      await service.createRule(userId, dtoWithoutLead as any, '127.0.0.1');

      expect(prisma.autopilotRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ leadDays: 7 }),
        }),
      );
    });
  });

  describe('updateRule', () => {
    it('updates rule with partial data', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);
      prisma.autopilotRule.update.mockResolvedValue({ ...mockRule, budgetMaxCents: 8000 });

      const result = await service.updateRule(userId, ruleId, { budgetMaxCents: 8000 });
      expect(result.budgetMaxCents).toBe(8000);
    });

    it('throws when rule not found', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateRule(userId, 'nonexistent', { budgetMaxCents: 8000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when monthly cap exceeds platform limit', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);

      await expect(
        service.updateRule(userId, ruleId, { monthlyCapCents: 300000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates budget range using existing values for missing fields', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);

      await expect(
        service.updateRule(userId, ruleId, { budgetMinCents: 9000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('toggles isActive', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);
      prisma.autopilotRule.update.mockResolvedValue({ ...mockRule, isActive: false });

      await service.updateRule(userId, ruleId, { isActive: false });

      expect(prisma.autopilotRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('deleteRule', () => {
    it('deletes rule and returns confirmation', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);
      prisma.autopilotRule.delete.mockResolvedValue(mockRule);

      const result = await service.deleteRule(userId, ruleId);
      expect(result).toEqual({ deleted: true });
      expect(prisma.autopilotRule.delete).toHaveBeenCalledWith({ where: { id: ruleId } });
    });

    it('throws when rule not found', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(null);

      await expect(service.deleteRule(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRules', () => {
    it('returns rules with person names and recent runs', async () => {
      prisma.autopilotRule.findMany.mockResolvedValue([mockRule]);

      const result = await service.listRules(userId);

      expect(result).toEqual([mockRule]);
      expect(prisma.autopilotRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          include: expect.objectContaining({
            person: { select: { name: true } },
            runs: expect.objectContaining({ take: 5 }),
          }),
        }),
      );
    });

    it('returns empty array when no rules exist', async () => {
      prisma.autopilotRule.findMany.mockResolvedValue([]);
      const result = await service.listRules(userId);
      expect(result).toEqual([]);
    });
  });

  describe('getRule', () => {
    it('returns rule with last 20 runs', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);

      const result = await service.getRule(userId, ruleId);

      expect(result).toEqual(mockRule);
      expect(prisma.autopilotRule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            runs: expect.objectContaining({ take: 20 }),
          }),
        }),
      );
    });

    it('throws when rule not found', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(null);
      await expect(service.getRule(userId, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRuns', () => {
    it('returns paginated runs with defaults', async () => {
      prisma.autopilotRun.count.mockResolvedValue(50);
      prisma.autopilotRun.findMany.mockResolvedValue([]);

      const result = await service.listRuns(userId, {});

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 50 });
      expect(prisma.autopilotRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('applies page and limit params', async () => {
      prisma.autopilotRun.count.mockResolvedValue(100);
      prisma.autopilotRun.findMany.mockResolvedValue([]);

      await service.listRuns(userId, { page: 3, limit: 10 });

      expect(prisma.autopilotRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('filters by ruleId when provided', async () => {
      prisma.autopilotRun.count.mockResolvedValue(5);
      prisma.autopilotRun.findMany.mockResolvedValue([]);

      await service.listRuns(userId, { ruleId: 'rule-1' });

      expect(prisma.autopilotRun.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ruleId: 'rule-1' }),
        }),
      );
    });
  });

  describe('getMonthlySpend', () => {
    it('returns aggregated spend for current month', async () => {
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: 4500 } });

      const result = await service.getMonthlySpend(userId);
      expect(result).toBe(4500);
    });

    it('returns 0 when no runs exist', async () => {
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: null } });

      const result = await service.getMonthlySpend(userId);
      expect(result).toBe(0);
    });

    it('filters by ruleId when provided', async () => {
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: 1000 } });

      await service.getMonthlySpend(userId, 'rule-1');

      expect(prisma.autopilotRun.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ruleId: 'rule-1' }),
        }),
      );
    });
  });

  describe('checkSpendingCap', () => {
    it('allows spend under cap', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: 2000 } });

      const result = await service.checkSpendingCap(userId, ruleId, 3000);

      expect(result.allowed).toBe(true);
      expect(result.monthlySpentCents).toBe(2000);
      expect(result.monthlyCap).toBe(10000);
    });

    it('denies spend that exceeds cap', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(mockRule);
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: 8000 } });

      const result = await service.checkSpendingCap(userId, ruleId, 3000);
      expect(result.allowed).toBe(false);
    });

    it('uses platform cap when rule cap is higher', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue({
        ...mockRule,
        monthlyCapCents: 500000,
      });
      prisma.autopilotRun.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });

      const result = await service.checkSpendingCap(userId, ruleId, 1000);
      expect(result.monthlyCap).toBe(200000);
    });

    it('throws when rule not found', async () => {
      prisma.autopilotRule.findFirst.mockResolvedValue(null);

      await expect(
        service.checkSpendingCap(userId, 'nonexistent', 1000),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
