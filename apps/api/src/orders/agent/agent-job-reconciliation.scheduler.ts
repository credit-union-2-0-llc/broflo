import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeIssuingService } from './stripe-issuing.service';
import { NotificationsService } from '../../notifications/notifications.service';

// Comfortably past the 3m20s HTTP timeout BrowserAgentClient enforces on the
// browser-agent call — anything still 'placing' past this genuinely lost
// track of the request, rather than just being slow.
const STUCK_PLACING_TTL_MINUTES = 10;

@Injectable()
export class AgentJobReconciliationScheduler {
  private readonly log = new Logger(AgentJobReconciliationScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeIssuing: StripeIssuingService,
    private readonly notifications: NotificationsService,
  ) {
    this.enabled = process.env.AGENT_JOB_RECONCILIATION_ENABLED === 'true';
    if (!this.enabled) {
      this.log.warn('Agent job reconciliation disabled (AGENT_JOB_RECONCILIATION_ENABLED != true)');
    }
  }

  @Cron('*/5 * * * *')
  async reconcile() {
    if (!this.enabled) return;
    await this.reconcileStuckPlacingJobs();
    await this.reconcileOrphanedVirtualCards();
  }

  // A job stuck in 'placing' means the browser-agent call was severed
  // mid-flight — the real-world order status is unknown, and it may have
  // already gone through. Same treatment as a post-confirmation failure:
  // never auto-credit, never tell the user it failed, always route to a
  // human for manual reconciliation against the retailer.
  private async reconcileStuckPlacingJobs() {
    const cutoff = new Date(Date.now() - STUCK_PLACING_TTL_MINUTES * 60 * 1000);
    const stuckJobs = await this.prisma.agentJob.findMany({
      where: { status: 'placing', updatedAt: { lt: cutoff } },
    });

    if (stuckJobs.length === 0) return;
    this.log.warn(`Found ${stuckJobs.length} agent job(s) stuck in 'placing'`);

    for (const job of stuckJobs) {
      try {
        if (job.stripeVirtualCardId) {
          await this.stripeIssuing.cancelCard(job.stripeVirtualCardId);
        }

        await this.prisma.agentJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            failureReason: 'post_confirmation_uncertain',
            stripeVirtualCardId: null,
            completedAt: new Date(),
          },
        });

        await this.prisma.failureReview.create({
          data: {
            agentJobId: job.id,
            retailerDomain: job.retailerDomain,
            failureReason: 'post_confirmation_uncertain',
          },
        });

        await this.notifications.create(job.userId, {
          type: 'agent_order_failed',
          title: 'Still confirming your order',
          body: "We lost track of your order right after checkout — we're double-checking with the retailer and will follow up shortly.",
          linkUrl: '/orders',
        });

        this.log.log(`Reconciled stuck job ${job.id}: marked failed, flagged for review`);
      } catch (err) {
        this.log.error(`Failed to reconcile stuck job ${job.id}: ${err}`);
      }
    }
  }

  // Safety net independent of the in-process `finally` in
  // AgentOrdersService.place() — covers the case where the whole process
  // died before that block ran, leaving a real, spendable virtual card active.
  private async reconcileOrphanedVirtualCards() {
    const orphaned = await this.prisma.agentJob.findMany({
      where: {
        status: { in: ['completed', 'failed', 'aborted'] },
        stripeVirtualCardId: { not: null },
      },
    });

    if (orphaned.length === 0) return;
    this.log.warn(`Found ${orphaned.length} terminal agent job(s) with an uncancelled virtual card`);

    for (const job of orphaned) {
      try {
        await this.stripeIssuing.cancelCard(job.stripeVirtualCardId!);
        await this.prisma.agentJob.update({
          where: { id: job.id },
          data: { stripeVirtualCardId: null },
        });
        this.log.log(`Cancelled orphaned virtual card for job ${job.id}`);
      } catch (err) {
        this.log.error(`Failed to cancel orphaned virtual card for job ${job.id}: ${err}`);
      }
    }
  }
}
