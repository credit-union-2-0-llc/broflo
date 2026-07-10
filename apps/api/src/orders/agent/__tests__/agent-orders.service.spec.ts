import { Test, TestingModule } from '@nestjs/testing';
import { AgentOrdersService } from '../agent-orders.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BrowserAgentClient } from '../browser-agent.client';
import { StripeIssuingService } from '../stripe-issuing.service';
import { RetailerProfileService } from '../retailer-profile.service';
import { ServiceCreditService } from '../service-credit.service';
import { OrderAuditService } from '../../audit/order-audit.service';
import { NotificationsService } from '../../../notifications/notifications.service';
import { EntitlementsService } from '../../../entitlements/entitlements.service';
import type { User } from '@prisma/client';

describe('AgentOrdersService - place()', () => {
  let service: AgentOrdersService;
  let prisma: {
    agentJob: { findFirst: jest.Mock; update: jest.Mock };
    giftSuggestion: { findUnique: jest.Mock };
    order: { create: jest.Mock };
    failureReview: { create: jest.Mock };
  };
  let agentClient: { execute: jest.Mock };
  let stripeIssuing: { createVirtualCard: jest.Mock; cancelCard: jest.Mock };
  let retailerProfile: { recordAttempt: jest.Mock };
  let serviceCredit: { issueCredit: jest.Mock };
  let notifications: { create: jest.Mock };
  let entitlements: { isFeatureEnabled: jest.Mock };

  const userId = 'user-1';
  const jobId = 'job-1';

  function makeUser(): User {
    return { id: userId, subscriptionTier: 'pro' } as User;
  }

  function makeJob(overrides: Record<string, unknown> = {}) {
    return {
      id: jobId,
      userId,
      status: 'previewing',
      suggestionId: null,
      retailerDomain: 'example.com',
      retailerUrl: 'https://example.com',
      searchTerms: 'cozy blanket',
      maxBudgetCents: 5000,
      foundProductPrice: 4999,
      shippingName: 'Test Person',
      shippingAddress1: '123 Main St',
      shippingAddress2: null,
      shippingCity: 'Portland',
      shippingState: 'OR',
      shippingZip: '97201',
      ...overrides,
    };
  }

  beforeEach(async () => {
    prisma = {
      agentJob: {
        findFirst: jest.fn().mockResolvedValue(makeJob()),
        update: jest.fn().mockResolvedValue({}),
      },
      giftSuggestion: { findUnique: jest.fn().mockResolvedValue(null) },
      order: { create: jest.fn().mockResolvedValue({ id: 'order-1' }) },
      failureReview: { create: jest.fn().mockResolvedValue({}) },
    };
    agentClient = { execute: jest.fn() };
    stripeIssuing = {
      createVirtualCard: jest.fn().mockResolvedValue({ cardId: 'card-1' }),
      cancelCard: jest.fn().mockResolvedValue(undefined),
    };
    retailerProfile = { recordAttempt: jest.fn().mockResolvedValue(undefined) };
    serviceCredit = { issueCredit: jest.fn().mockResolvedValue(true) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    entitlements = { isFeatureEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrowserAgentClient, useValue: agentClient },
        { provide: StripeIssuingService, useValue: stripeIssuing },
        { provide: RetailerProfileService, useValue: retailerProfile },
        { provide: ServiceCreditService, useValue: serviceCredit },
        { provide: OrderAuditService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: notifications },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(AgentOrdersService);
  });

  it('cancels the virtual card when the order completes successfully', async () => {
    agentClient.execute.mockResolvedValue({
      status: 'completed',
      found_product_title: 'Cozy Blanket',
      found_product_price: 4999,
      confirmation_number: 'CONF-1',
      steps: [],
    });

    await service.place(makeUser(), { jobId });

    expect(stripeIssuing.cancelCard).toHaveBeenCalledWith('card-1');
  });

  it('cancels the virtual card when the agent reports a failure', async () => {
    agentClient.execute.mockResolvedValue({
      status: 'failed',
      failure_reason: 'timeout',
      steps: [],
    });

    await service.place(makeUser(), { jobId });

    expect(stripeIssuing.cancelCard).toHaveBeenCalledWith('card-1');
  });

  it('cancels the virtual card even if the browser-agent call throws', async () => {
    agentClient.execute.mockRejectedValue(new Error('network error'));

    await expect(service.place(makeUser(), { jobId })).rejects.toThrow('network error');

    expect(stripeIssuing.cancelCard).toHaveBeenCalledWith('card-1');
  });

  it('skips auto-credit and uses a neutral message for post_confirmation_uncertain', async () => {
    agentClient.execute.mockResolvedValue({
      status: 'failed',
      failure_reason: 'post_confirmation_uncertain',
      steps: [],
    });

    await service.place(makeUser(), { jobId });

    expect(serviceCredit.issueCredit).not.toHaveBeenCalled();
    expect(prisma.failureReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failureReason: 'post_confirmation_uncertain' }),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ title: 'Still confirming your order' }),
    );
  });

  it('still auto-credits and uses the standard failure message for an ordinary failure', async () => {
    agentClient.execute.mockResolvedValue({
      status: 'failed',
      failure_reason: 'timeout',
      steps: [],
    });

    await service.place(makeUser(), { jobId });

    expect(serviceCredit.issueCredit).toHaveBeenCalledWith(makeUser(), jobId, 'timeout');
    expect(notifications.create).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ title: "That didn't work" }),
    );
  });
});
