import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { AgentOrdersService } from '../orders/agent/agent-orders.service';
import { AutopilotService } from './autopilot.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuggestionsService } from '../suggestions/suggestions.service';

const CONFIDENCE_THRESHOLD = 0.8;

@Injectable()
export class AutopilotScheduler {
  private readonly logger = new Logger(AutopilotScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly agentOrdersService: AgentOrdersService,
    private readonly autopilotService: AutopilotService,
    private readonly notifications: NotificationsService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAutopilot(): Promise<void> {
    if (process.env.AUTOPILOT_ENABLED !== 'true') {
      return;
    }

    this.logger.log('Autopilot scheduler tick');

    const rules = await this.prisma.autopilotRule.findMany({
      where: { isActive: true },
      include: { user: true, person: true },
    });

    for (const rule of rules) {
      try {
        await this.processRule(rule);
      } catch (err) {
        this.logger.error(
          `Autopilot rule ${rule.id} failed: ${(err as Error).message}`,
        );
      }
    }
  }

  private async processRule(rule: any): Promise<void> {
    const { userId, personId } = rule;

    // Check for upcoming events within lead days
    const now = new Date();
    const leadDate = new Date(now);
    leadDate.setDate(leadDate.getDate() + (rule.leadDays ?? 7));

    const events = await this.prisma.event.findMany({
      where: {
        userId,
        personId,
        date: {
          gte: now,
          lte: leadDate,
        },
        occasionType: {
          in: rule.occasionTypes ?? [],
        },
      },
    });

    if (events.length === 0) {
      return;
    }

    for (const event of events) {
      await this.processRuleForEvent(rule, event);
    }
  }

  private async processRuleForEvent(rule: any, event: any): Promise<void> {
    const { userId, personId, id: ruleId } = rule;

    // Check if we already ran for this rule+event combo
    const existingRun = await this.prisma.autopilotRun.findFirst({
      where: { ruleId, eventId: event.id },
    });

    if (existingRun) {
      return;
    }

    // Check spending cap
    const capCheck = await this.autopilotService.checkSpendingCap(
      userId,
      rule.monthlyCapCents,
    );

    if (!capCheck.allowed) {
      const pct = capCheck.monthlySpentCents / capCheck.monthlyCap;
      if (pct >= 0.8) {
        await this.notifications.create(userId, {
          type: 'autopilot_budget_warning',
          title: 'Autopilot budget warning',
          body: `You've used ${Math.round(pct * 100)}% of your monthly autopilot budget.`,
        });
      }

      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'skipped_budget',
        },
      });
      return;
    }

    // Generate suggestions
    const { suggestions } = await this.suggestionsService.generate(userId, {
      personId,
      occasionType: event.occasionType,
      budgetMinCents: rule.budgetMinCents,
      budgetMaxCents: rule.budgetMaxCents,
    });

    if (!suggestions || suggestions.length === 0) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'skipped_no_suggestions',
        },
      });
      return;
    }

    const topSuggestion = suggestions[0];

    // Check confidence threshold
    if (topSuggestion.confidenceScore < CONFIDENCE_THRESHOLD) {
      await this.notifications.create(userId, {
        type: 'autopilot_needs_approval',
        title: 'Autopilot needs your approval',
        body: `We found a gift idea for ${rule.person.name} but want your confirmation before ordering.`,
      });

      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'skipped_confidence',
        },
      });
      return;
    }

    // Preview the order
    let preview: any;
    try {
      preview = await this.ordersService.preview(userId, {
        productUrl: topSuggestion.retailerHint ?? '',
        budgetCents: rule.budgetMaxCents,
      });
    } catch (err) {
      this.logger.error(`Autopilot preview failed: ${(err as Error).message}`);
      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'failed_preview',
        },
      });
      return;
    }

    if (!preview?.product) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'skipped_no_product',
        },
      });
      return;
    }

    // Check budget bounds
    const priceCents = preview.product.priceCents ?? preview.product.estimatedPriceMaxCents ?? 0;
    if (priceCents < rule.budgetMinCents || priceCents > rule.budgetMaxCents) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'skipped_budget_mismatch',
        },
      });
      return;
    }

    // Place the order
    let order: any;
    try {
      order = await this.ordersService.place(userId, {
        personId,
        productUrl: topSuggestion.retailerHint ?? '',
        productTitle: preview.product?.title ?? topSuggestion.title ?? '',
        priceCents,
        shippingAddress1: rule.person.shippingAddress1 ?? '',
        shippingCity: rule.person.shippingCity ?? '',
        shippingState: rule.person.shippingState ?? '',
        shippingZip: rule.person.shippingZip ?? '',
      });
    } catch (err) {
      this.logger.error(`Autopilot place failed: ${(err as Error).message}`);
      await this.prisma.autopilotRun.create({
        data: {
          ruleId,
          eventId: event.id,
          userId,
          personId,
          status: 'failed_place',
        },
      });
      return;
    }

    await this.prisma.autopilotRun.create({
      data: {
        ruleId,
        eventId: event.id,
        userId,
        personId,
        status: 'placed',
        orderId: order?.id ?? null,
      },
    });

    await this.notifications.create(userId, {
      type: 'autopilot_order_placed',
      title: 'Autopilot placed an order',
      body: `We ordered a gift for ${rule.person.name} for their upcoming ${event.occasionType}.`,
    });
  }
}