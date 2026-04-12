import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BrowserAgentClient } from './browser-agent.client';
import { StripeIssuingService } from './stripe-issuing.service';
import { RetailerProfileService } from './retailer-profile.service';
import { ServiceCreditService } from './service-credit.service';
import { OrdersService } from '../orders.service';
import { OrderAuditService } from '../audit/order-audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AgentPreviewDto, AgentPlaceDto } from './dto/agent-order.dto';
import { randomUUID } from 'crypto';

const MAX_CONCURRENT_JOBS = 3;

@Injectable()
export class AgentOrdersService {
  private readonly log = new Logger(AgentOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentClient: BrowserAgentClient,
    private readonly stripeIssuing: StripeIssuingService,
    private readonly retailerProfile: RetailerProfileService,
    private readonly serviceCredit: ServiceCreditService,
    private readonly ordersService: OrdersService,
    private readonly orderAudit: OrderAuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async preview(user: User, dto: AgentPreviewDto) {
    this._requireTier(user);
    await this._checkConcurrencyLimit(user.id);

    const suggestion = await this.prisma.giftSuggestion.findFirst({
      where: { id: dto.suggestionId, userId: user.id, eventId: dto.eventId },
    });
    if (!suggestion) throw new NotFoundException('Suggestion not found');

    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, userId: user.id, deletedAt: null },
    });
    if (!person) throw new NotFoundException('Person not found');

    const retailerUrl = dto.retailerUrl || suggestion.retailerHint || '';
    const searchTerms = dto.searchTerms || suggestion.title;

    if (!retailerUrl) {
      throw new BadRequestException('No retailer URL available for this suggestion');
    }

    const retailerDomain = new URL(retailerUrl).hostname.replace('www.', '');

    // Check if retailer is supported
    const supported = await this.retailerProfile.isSupported(retailerDomain);
    if (!supported) {
      throw new BadRequestException(
        `${retailerDomain} is currently unavailable for agent orders. Use the manual link instead.`,
      );
    }

    // Create agent job
    const job = await this.prisma.agentJob.create({
      data: {
        userId: user.id,
        suggestionId: dto.suggestionId,
        status: 'queued',
        retailerDomain,
        retailerUrl,
        searchTerms,
        maxBudgetCents: suggestion.estimatedPriceMaxCents,
        shippingName: person.name,
        shippingAddress1: person.shippingAddress1 || '',
        shippingAddress2: person.shippingAddress2,
        shippingCity: person.shippingCity || '',
        shippingState: person.shippingState || '',
        shippingZip: person.shippingZip || '',
        idempotencyKey: `preview-${dto.suggestionId}-${randomUUID().slice(0, 8)}`,
      },
    });

    // Execute agent in preview mode (async — returns when done)
    try {
      await this.prisma.agentJob.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: new Date() },
      });

      const result = await this.agentClient.execute({
        jobId: job.id,
        retailerUrl,
        searchTerms,
        maxBudgetCents: suggestion.estimatedPriceMaxCents,
        shippingAddress: {
          name: person.name,
          address1: person.shippingAddress1 || '',
          address2: person.shippingAddress2 || undefined,
          city: person.shippingCity || '',
          state: person.shippingState || '',
          zip: person.shippingZip || '',
        },
        mode: 'preview',
      });

      // Persist steps
      await this._persistSteps(job.id, result.steps);

      // Update job with preview result
      const updatedJob = await this.prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: result.status === 'previewing' ? 'previewing' : 'failed',
          foundProductTitle: result.found_product_title,
          foundProductPrice: result.found_product_price,
          foundProductUrl: result.found_product_url,
          foundProductImage: result.found_product_image,
          matchConfidence: result.match_confidence,
          browserSessionId: result.browser_session_id,
          failureReason: result.failure_reason as never,
          completedAt: result.status !== 'previewing' ? new Date() : undefined,
        },
      });

      // Update retailer stats
      await this.retailerProfile.recordAttempt(
        retailerDomain,
        result.status !== 'failed',
        result.failure_reason === 'captcha',
      );

      // If failed, trigger self-heal
      if (result.status === 'failed' || result.status === 'aborted') {
        await this._handleFailure(user, updatedJob, result.failure_reason || 'unknown');
      }

      return updatedJob;
    } catch (err) {
      await this.prisma.agentJob.update({
        where: { id: job.id },
        data: { status: 'failed', failureReason: 'unknown', completedAt: new Date() },
      });
      await this.retailerProfile.recordAttempt(retailerDomain, false, false);
      throw err;
    }
  }

  async place(user: User, dto: AgentPlaceDto) {
    this._requireTier(user);

    const job = await this.prisma.agentJob.findFirst({
      where: { id: dto.jobId, userId: user.id, status: 'previewing' },
    });
    if (!job) throw new NotFoundException('Agent job not found or not in preview state');

    const person = await this.prisma.person.findFirst({
      where: { userId: user.id, name: job.shippingName, deletedAt: null },
    });

    // Create virtual card for this purchase
    const virtualCard = await this.stripeIssuing.createVirtualCard({
      amountCents: Math.round((job.foundProductPrice || job.maxBudgetCents) * 1.05), // 5% buffer
      orderId: job.id,
      userId: user.id,
    });

    try {
      await this.prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'placing',
          stripeVirtualCardId: virtualCard.cardId,
        },
      });

      const result = await this.agentClient.execute({
        jobId: job.id,
        retailerUrl: job.retailerUrl,
        searchTerms: job.searchTerms,
        maxBudgetCents: job.maxBudgetCents,
        shippingAddress: {
          name: job.shippingName,
          address1: job.shippingAddress1,
          address2: job.shippingAddress2 || undefined,
          city: job.shippingCity,
          state: job.shippingState,
          zip: job.shippingZip,
        },
        mode: 'place',
        stripeVirtualCardId: virtualCard.cardId,
        virtualCardNumber: virtualCard.cardNumber,
        virtualCardExp: `${virtualCard.expMonth}/${virtualCard.expYear}`,
        virtualCardCvc: virtualCard.cvc,
      });

      await this._persistSteps(job.id, result.steps);

      if (result.status === 'completed') {
        // Create the Order record (same as API orders)
        const order = await this.prisma.order.create({
          data: {
            userId: user.id,
            personId: person?.id || job.shippingName,
            eventId: null,
            retailerKey: 'browser-agent',
            retailerProductId: result.found_product_url || job.retailerUrl,
            retailerOrderId: result.confirmation_number,
            confirmationNumber: result.confirmation_number,
            productTitle: result.found_product_title || job.searchTerms,
            productDescription: `Purchased by Broflo Agent from ${job.retailerDomain}`,
            productImageUrl: result.found_product_image,
            priceCents: result.found_product_price || job.maxBudgetCents,
            status: 'ordered',
            shippingName: job.shippingName,
            shippingAddress1: job.shippingAddress1,
            shippingAddress2: job.shippingAddress2,
            shippingCity: job.shippingCity,
            shippingState: job.shippingState,
            shippingZip: job.shippingZip,
            placedAt: new Date(),
          },
        });

        await this.prisma.agentJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            orderId: order.id,
            confirmationNumber: result.confirmation_number,
            completedAt: new Date(),
          },
        });

        await this.retailerProfile.recordAttempt(job.retailerDomain, true, false);

        await this.notifications.create(user.id, {
          type: 'agent_order_placed',
          title: 'Order Placed by Broflo',
          body: `We placed your order for "${result.found_product_title}" on ${job.retailerDomain}.`,
          linkUrl: `/orders/${order.id}`,
        });

        return { job: { ...job, status: 'completed', orderId: order.id }, order };
      }

      // Failed
      await this.prisma.agentJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          failureReason: result.failure_reason as never,
          completedAt: new Date(),
        },
      });

      await this.retailerProfile.recordAttempt(
        job.retailerDomain,
        false,
        result.failure_reason === 'captcha',
      );

      await this._handleFailure(user, job, result.failure_reason || 'unknown');

      return { job: { ...job, status: 'failed', failureReason: result.failure_reason } };
    } finally {
      // Always cancel the virtual card
      await this.stripeIssuing.cancelCard(virtualCard.cardId);
    }
  }

  async getJob(userId: string, jobId: string) {
    const job = await this.prisma.agentJob.findFirst({
      where: { id: jobId, userId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });
    if (!job) throw new NotFoundException('Agent job not found');
    return job;
  }

  async getJobSteps(userId: string, jobId: string) {
    const job = await this.prisma.agentJob.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new NotFoundException('Agent job not found');
    return this.prisma.agentStep.findMany({
      where: { jobId },
      orderBy: { stepNumber: 'asc' },
    });
  }

  async cancelJob(userId: string, jobId: string) {
    const job = await this.prisma.agentJob.findFirst({
      where: { id: jobId, userId, status: { in: ['queued', 'running', 'previewing'] } },
    });
    if (!job) throw new NotFoundException('Agent job not found or already completed');

    if (job.stripeVirtualCardId) {
      await this.stripeIssuing.cancelCard(job.stripeVirtualCardId);
    }

    return this.prisma.agentJob.update({
      where: { id: jobId },
      data: { status: 'aborted', completedAt: new Date() },
    });
  }

  private async _handleFailure(user: User, job: { id: string; retailerDomain: string }, reason: string) {
    // Layer 1: Auto service credit
    await this.serviceCredit.issueCredit(user, job.id, reason);

    // Layer 2: Create failure review for human review
    await this.prisma.failureReview.create({
      data: {
        agentJobId: job.id,
        retailerDomain: job.retailerDomain,
        failureReason: reason,
      },
    });

    // Notify user
    await this.notifications.create(user.id, {
      type: 'agent_order_failed',
      title: "That didn't work",
      body: "We've credited your next month of Broflo as an apology. Here's a direct link to order manually.",
      linkUrl: `/orders`,
    });
  }

  private _requireTier(user: User) {
    if (!['pro', 'elite'].includes(user.subscriptionTier)) {
      throw new ForbiddenException('Browser agent orders require a Pro or Elite subscription.');
    }
  }

  private async _checkConcurrencyLimit(userId: string) {
    const activeJobs = await this.prisma.agentJob.count({
      where: { userId, status: { in: ['queued', 'running', 'placing'] } },
    });
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
      throw new BadRequestException(
        `You have ${activeJobs} agent orders in progress. Wait for one to complete.`,
      );
    }
  }

  private async _persistSteps(jobId: string, steps: Array<{
    step_number: number;
    action: string;
    status: string;
    screenshot_url?: string;
    page_url?: string;
    ai_model_used?: string;
    ai_confidence?: number;
    metadata?: Record<string, unknown>;
  }>) {
    if (!steps.length) return;
    await this.prisma.agentStep.createMany({
      data: steps.map((s) => ({
        jobId,
        stepNumber: s.step_number,
        action: s.action as never,
        status: s.status as never,
        screenshotUrl: s.screenshot_url,
        pageUrl: s.page_url,
        aiModelUsed: s.ai_model_used,
        aiConfidence: s.ai_confidence,
        metadata: s.metadata ?? undefined,
      })),
    });
  }
}
