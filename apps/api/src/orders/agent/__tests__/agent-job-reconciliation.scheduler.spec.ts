import { AgentJobReconciliationScheduler } from '../agent-job-reconciliation.scheduler';
import { PrismaService } from '../../../prisma/prisma.service';
import { StripeIssuingService } from '../stripe-issuing.service';
import { NotificationsService } from '../../../notifications/notifications.service';

describe('AgentJobReconciliationScheduler', () => {
  let prisma: {
    agentJob: { findMany: jest.Mock; update: jest.Mock };
    failureReview: { create: jest.Mock };
  };
  let stripeIssuing: { cancelCard: jest.Mock };
  let notifications: { create: jest.Mock };
  let scheduler: AgentJobReconciliationScheduler;

  function buildScheduler() {
    return new AgentJobReconciliationScheduler(
      prisma as unknown as PrismaService,
      stripeIssuing as unknown as StripeIssuingService,
      notifications as unknown as NotificationsService,
    );
  }

  beforeEach(() => {
    process.env.AGENT_JOB_RECONCILIATION_ENABLED = 'true';
    prisma = {
      agentJob: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      failureReview: { create: jest.fn().mockResolvedValue({}) },
    };
    stripeIssuing = { cancelCard: jest.fn().mockResolvedValue(undefined) };
    notifications = { create: jest.fn().mockResolvedValue({}) };
    scheduler = buildScheduler();
  });

  afterEach(() => {
    delete process.env.AGENT_JOB_RECONCILIATION_ENABLED;
  });

  it('does nothing when disabled', async () => {
    process.env.AGENT_JOB_RECONCILIATION_ENABLED = 'false';
    const disabled = buildScheduler();
    await disabled.reconcile();
    expect(prisma.agentJob.findMany).not.toHaveBeenCalled();
  });

  it('marks a stuck placing job as failed with post_confirmation_uncertain, cancels its card, and flags it for review', async () => {
    prisma.agentJob.findMany
      .mockResolvedValueOnce([
        { id: 'job-1', userId: 'user-1', retailerDomain: 'example.com', stripeVirtualCardId: 'card-1' },
      ])
      .mockResolvedValueOnce([]);

    await scheduler.reconcile();

    expect(stripeIssuing.cancelCard).toHaveBeenCalledWith('card-1');
    expect(prisma.agentJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'failed', failureReason: 'post_confirmation_uncertain' }),
      }),
    );
    expect(prisma.failureReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentJobId: 'job-1' }) }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'Still confirming your order' }),
    );
  });

  it('cancels an orphaned virtual card left on a terminal job and clears the reference', async () => {
    prisma.agentJob.findMany
      .mockResolvedValueOnce([]) // no stuck placing jobs
      .mockResolvedValueOnce([{ id: 'job-2', stripeVirtualCardId: 'card-2' }]);

    await scheduler.reconcile();

    expect(stripeIssuing.cancelCard).toHaveBeenCalledWith('card-2');
    expect(prisma.agentJob.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: { stripeVirtualCardId: null },
    });
  });
});
