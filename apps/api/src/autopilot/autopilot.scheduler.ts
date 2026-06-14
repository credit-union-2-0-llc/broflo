import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { AgentOrdersService } from '../orders/agent/agent-orders.service';
import { AutopilotService } from './autopilot.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuggestionsService } from '../suggestions/suggestions.service';

@Injectable()
export class AutopilotScheduler {
  private readonly logger = new Logger(AutopilotScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly agentOrders: AgentOrdersService,
    private readonly autopilotService: AutopilotService,
    private readonly notifications: NotificationsService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAutopilot(): Promise<void> {
    if (process.env.AUTOPILOT_ENABLED !== 'true') {
      return;
    }

    this.logger.log('Running autopilot scheduler...');

    const rules = await this.prisma.autopilotRule.findMany({
      where: { isActive: true },
      include: {
        user: true,
        person: true,
      },
    });

    for (const rule of rules) {
      await this.processRule(rule);
    }
  }

  private async processRule(rule: any): Promise<void> {
    try {
      const events = await this.prisma.event.findMany({
        where: {
          personId: rule.personId,
          userId: rule.userId,
          occasionType: { in: rule.occasionTypes },
          date: {
            gte: new Date(),
            lte: new Date(Date.now() + rule.leadDays * 24 * 60 * 60 * 1000),
          },
        },
      });

      if (events.length === 0) {
        return;
      }

      const event = events[0];

      // Check for existing run
      const existingRun = await this.prisma.autopilotRun.findFirst({
        where: {
          autopilotRuleId: rule.id,
          eventId: event.id,
        },
      });

      if (existingRun) {
        return;
      }

      // Check spending cap
      const capCheck = await this.autopilotService.checkSpendingCap(
        rule.userId,
        rule.id,
        rule.budgetMaxCents,
        rule.monthlyCapCents,
      );

      if (!capCheck.allowed) {
        const usageRatio = capCheck.monthlySpentCents / capCheck.monthlyCap;

        if (usageRatio >= 0.8) {
          await this.notifications.create(rule.userId, {
            type: 'autopilot_budget_warning',
            title: 'Autopilot budget warning',
            body: `You've used ${Math.round(usageRatio * 100)}% of your monthly autopilot budget.`,
          });
        }

        await this.prisma.autopilotRun.create({
          data: {
            autopilotRuleId: rule.id,
            eventId: event.id,
            userId: rule.userId,
            status: 'skipped_budget',
            amountCents: 0,
          },
        });
        return;
      }

      // Generate suggestions
      const { suggestions } = await this.suggestionsService.generate(
        rule.userId,
        {
          personId: rule.personId,
          occasionType: event.occasionType,
          budgetMinCents: rule.budgetMinCents,
          budgetMaxCents: rule.budgetMaxCents,
        },
      );

      if (!suggestions || suggestions.length === 0) {
        await this.prisma.autopilotRun.create({
          data: {
            autopilotRuleId: rule.id,
            eventId: event.id,
            userId: rule.userId,
            status: 'skipped_confidence',
            amountCents: 0,
          },
        });
        return;
      }

      const topSuggestion = suggestions[0];

      if (topSuggestion.confidenceScore < 0.8) {
        await this.notifications.create(rule.userId, {
          type: 'autopilot_needs_approval',
          title: 'Autopilot needs your approval',
          body: `We found a gift for ${rule.person.name} but need your approval before ordering.`,
          meta: { suggestionId: topSuggestion.id, eventId: event.id },
        });

        await this.prisma.autopilotRun.create({
          data: {
            autopilotRuleId: rule.id,
            eventId: event.id,
            userId: rule.userId,
            status: 'skipped_confidence',
            amountCents: 0,
          },
        });
        return;
      }

      // Preview the order
      const previewResult = await this.ordersService.preview(rule.userId, {
        productUrl: topSuggestion.retailerHint ?? '',
        productTitle: topSuggestion.title,
        productPriceCents: topSuggestion.estimatedPriceMaxCents,
      });

      if (!previewResult?.product) {
        await this.prisma.autopilotRun.create({
          data: {
            autopilotRuleId: rule.id,
            eventId: event.id,
            userId: rule.userId,
            status: 'failed',
            amountCents: 0,
          },
        });
        return;
      }

      // Place the order
      const order = await this.ordersService.place(rule.userId, {
        productUrl: topSuggestion.retailerHint ?? '',
        productTitle: topSuggestion.title,
        productPriceCents: previewResult.product.priceCents,
        shippingAddress1: rule.person.shippingAddress1,
        shippingCity: rule.person.shippingCity,
        shippingState: rule.person.shippingState,
        shippingZip: rule.person.shippingZip,
      });

      await this.prisma.autopilotRun.create({
        data: {
          autopilotRuleId: rule.id,
          eventId: event.id,
          userId: rule.userId,
          status: 'ordered',
          orderId: order.id,
          amountCents: previewResult.product.priceCents,
        },
      });

      await this.notifications.create(rule.userId, {
        type: 'autopilot_ordered',
        title: 'Autopilot placed an order!',
        body: `We ordered "${topSuggestion.title}" for ${rule.person.name}.`,
        meta: { orderId: order.id },
      });
    } catch (error) {
      this.logger.error(`Autopilot failed for rule ${rule.id}:`, error);

      await this.prisma.autopilotRun.create({
        data: {
          autopilotRuleId: rule.id,
          eventId: null,
          userId: rule.userId,
          status: 'failed',
          amountCents: 0,
        },
      });
    }
  }
}