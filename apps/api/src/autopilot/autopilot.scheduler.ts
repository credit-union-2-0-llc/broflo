import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { AgentOrdersService } from '../orders/agent/agent-orders.service';
import { AutopilotService } from './autopilot.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuggestionsService } from '../suggestions/suggestions.service';

const CONFIDENCE_AUTO_ORDER = 0.80;
const MAX_RUNS_PER_CYCLE = 50;

@Injectable()
export class AutopilotScheduler {
  private readonly log = new Logger(AutopilotScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly agentOrders: AgentOrdersService,
    private readonly autopilotService: AutopilotService,
    private readonly notifications: NotificationsService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @Cron('0 7 * * *') // Daily at 7 AM UTC
  async runAutopilot() {
    this.log.log('Autopilot cron started');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active rules for Pro/Elite users
    const rules = await this.prisma.autopilotRule.findMany({
      where: {
        isActive: true,
        user: { subscriptionTier: { in: ['pro', 'elite'] } },
      },
      include: {
        user: { select: { id: true, subscriptionTier: true, stripeCustomerId: true, stripePaymentMethodId: true } },
        person: {
          select: {
            id: true,
            name: true,
            shippingAddress1: true,
            shippingCity: true,
            shippingState: true,
            shippingZip: true,
          },
        },
      },
    });

    let processed = 0;

    for (const rule of rules) {
      if (processed >= MAX_RUNS_PER_CYCLE) {
        this.log.warn(`Max runs per cycle (${MAX_RUNS_PER_CYCLE}) reached, deferring remaining`);
        break;
      }

      try {
        await this.processRule(rule, today);
        processed++;
      } catch (err) {
        this.log.error(`Autopilot failed for rule ${rule.id}: ${err}`);
      }
    }

    this.log.log(`Autopilot cron completed: ${processed} rules processed`);
  }

  private async processRule(
    rule: Awaited<ReturnType<typeof this.findRuleWithRelations>>,
    today: Date,
  ) {
    // Find upcoming events within lead days window
    const leadDate = new Date(today);
    leadDate.setDate(leadDate.getDate() + rule.leadDays);

    const events = await this.prisma.event.findMany({
      where: {
        personId: rule.personId,
        userId: rule.userId,
        occasionType: { in: rule.occasionTypes as never[] },
        date: { gte: today, lte: leadDate },
      },
    });

    for (const event of events) {
      // Check if we already ran for this event
      const existingRun = await this.prisma.autopilotRun.findFirst({
        where: { ruleId: rule.id, eventId: event.id },
      });
      if (existingRun) continue;

      // Check spending cap
      const spendCheck = await this.autopilotService.checkSpendingCap(
        rule.userId,
        rule.id,
        rule.budgetMaxCents,
      );

      if (!spendCheck.allowed) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            status: 'skipped_budget',
            reason: `Monthly spend ${spendCheck.monthlySpentCents}c would exceed cap ${spendCheck.monthlyCap}c`,
          },
        });

        // Notify at 80% cap
        if (spendCheck.monthlySpentCents >= spendCheck.monthlyCap * 0.8) {
          await this.notifications.create(rule.userId, {
            type: 'autopilot_budget_warning',
            title: 'Autopilot Budget Alert',
            body: `You've used ${Math.round((spendCheck.monthlySpentCents / spendCheck.monthlyCap) * 100)}% of your monthly Autopilot budget for ${rule.person.name}.`,
            linkUrl: '/autopilot',
          });
        }
        continue;
      }

      // Check shipping address
      if (!rule.person.shippingAddress1 || !rule.person.shippingCity) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            status: 'failed',
            reason: 'Missing shipping address',
          },
        });
        await this.notifications.create(rule.userId, {
          type: 'autopilot_failed',
          title: 'Autopilot Needs Your Help',
          body: `We couldn't auto-order for ${rule.person.name} — no shipping address on file.`,
          linkUrl: `/people/${rule.personId}`,
        });
        continue;
      }

      // Generate AI suggestion
      let suggestion;
      try {
        const result = await this.suggestionsService.generate(rule.userId, {
          personId: rule.personId,
          eventId: event.id,
          surpriseFactor: 'safe',
        });
        suggestion = result.suggestions?.[0];
      } catch (err) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            status: 'failed',
            reason: `AI suggestion failed: ${err}`,
          },
        });
        continue;
      }

      if (!suggestion) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            status: 'skipped_no_suggestion',
            reason: 'No suggestions returned',
          },
        });
        continue;
      }

      // Check confidence threshold
      if (suggestion.confidenceScore < CONFIDENCE_AUTO_ORDER) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            suggestionId: suggestion.id,
            status: 'skipped_confidence',
            confidenceScore: suggestion.confidenceScore,
            reason: `Confidence ${suggestion.confidenceScore} below ${CONFIDENCE_AUTO_ORDER} threshold`,
          },
        });
        await this.notifications.create(rule.userId, {
          type: 'autopilot_needs_approval',
          title: 'Autopilot Suggestion Needs Review',
          body: `We found a gift for ${rule.person.name} but want your approval first: "${suggestion.title}"`,
          linkUrl: `/events/${event.id}`,
        });
        continue;
      }

      // Check budget
      if (suggestion.estimatedPriceMaxCents > rule.budgetMaxCents) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            suggestionId: suggestion.id,
            status: 'skipped_budget',
            amountCents: suggestion.estimatedPriceMaxCents,
            reason: `Price ${suggestion.estimatedPriceMaxCents}c exceeds budget ${rule.budgetMaxCents}c`,
          },
        });
        continue;
      }

      // Preview order to get product — try API first, fall back to browser agent
      let preview;
      let useAgent = false;
      try {
        preview = await this.ordersService.preview(
          { id: rule.userId } as never,
          {
            suggestionId: suggestion.id,
            personId: rule.personId,
            eventId: event.id,
            budgetMaxCents: rule.budgetMaxCents,
          },
        );
      } catch {
        // No API adapter for this retailer — try browser agent
        useAgent = true;
        this.log.log(`API preview failed for rule ${rule.id}, falling back to browser agent`);
      }

      if (useAgent) {
        // Route to browser agent
        try {
          const user = await this.prisma.user.findUniqueOrThrow({ where: { id: rule.userId } });
          const agentJob = await this.agentOrders.preview(user, {
            suggestionId: suggestion.id,
            personId: rule.personId,
            eventId: event.id,
            retailerUrl: suggestion.retailerHint || undefined,
          });

          if (agentJob.status === 'previewing') {
            const result = await this.agentOrders.place(user, { jobId: agentJob.id });
            if (result.job.status === 'completed' && result.order) {
              await this.prisma.autopilotRun.create({
                data: {
                  ruleId: rule.id,
                  eventId: event.id,
                  orderId: result.order.id,
                  suggestionId: suggestion.id,
                  status: 'order_placed',
                  confidenceScore: suggestion.confidenceScore,
                  amountCents: result.order.priceCents,
                  reason: 'Placed via browser agent (no API adapter)',
                },
              });
              await this.notifications.create(rule.userId, {
                type: 'autopilot_ordered',
                title: 'Autopilot Gift Ordered',
                body: `We ordered "${result.order.productTitle}" for ${rule.person.name} via Broflo Agent. You have 2 hours to cancel.`,
                linkUrl: `/orders/${result.order.id}`,
              });
              this.log.log(`Autopilot agent order placed: rule=${rule.id}, order=${result.order.id}`);
            } else {
              await this.prisma.autopilotRun.create({
                data: {
                  ruleId: rule.id,
                  eventId: event.id,
                  suggestionId: suggestion.id,
                  status: 'failed',
                  reason: `Browser agent failed: ${result.job.failureReason || 'unknown'}`,
                },
              });
            }
          } else {
            await this.prisma.autopilotRun.create({
              data: {
                ruleId: rule.id,
                eventId: event.id,
                suggestionId: suggestion.id,
                status: 'failed',
                reason: `Browser agent preview failed: ${agentJob.failureReason || agentJob.status}`,
              },
            });
          }
        } catch (err) {
          await this.prisma.autopilotRun.create({
            data: {
              ruleId: rule.id,
              eventId: event.id,
              suggestionId: suggestion.id,
              status: 'failed',
              reason: `Browser agent error: ${err}`,
            },
          });
          await this.notifications.create(rule.userId, {
            type: 'autopilot_failed',
            title: 'Autopilot Order Failed',
            body: `We tried to order a gift for ${rule.person.name} but something went wrong. No charge.`,
            linkUrl: '/autopilot',
          });
        }
        continue;
      }

      // Place order via API adapter
      try {
        const order = await this.ordersService.place(
          { id: rule.userId, stripeCustomerId: rule.user.stripeCustomerId, stripePaymentMethodId: rule.user.stripePaymentMethodId } as never,
          {
            suggestionId: suggestion.id,
            personId: rule.personId,
            eventId: event.id,
            retailerProductId: preview!.product.id,
            shippingName: rule.person.name,
            shippingAddress1: rule.person.shippingAddress1!,
            shippingCity: rule.person.shippingCity!,
            shippingState: rule.person.shippingState!,
            shippingZip: rule.person.shippingZip!,
          },
        );

        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            orderId: order.id,
            suggestionId: suggestion.id,
            status: 'order_placed',
            confidenceScore: suggestion.confidenceScore,
            amountCents: preview!.product.priceCents,
          },
        });

        await this.notifications.create(rule.userId, {
          type: 'autopilot_ordered',
          title: 'Autopilot Gift Ordered',
          body: `We ordered "${preview!.product.title}" for ${rule.person.name}. You have 2 hours to cancel.`,
          linkUrl: `/orders/${order.id}`,
        });

        this.log.log(`Autopilot order placed: rule=${rule.id}, order=${order.id}`);
      } catch (err) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            suggestionId: suggestion.id,
            status: 'failed',
            reason: `Order placement failed: ${err}`,
          },
        });
        await this.notifications.create(rule.userId, {
          type: 'autopilot_failed',
          title: 'Autopilot Order Failed',
          body: `We tried to order a gift for ${rule.person.name} but something went wrong. No charge.`,
          linkUrl: '/autopilot',
        });
      }
    }
  }

  // Helper type — Prisma doesn't export a clean type for the include
  private async findRuleWithRelations() {
    return this.prisma.autopilotRule.findFirstOrThrow({
      include: {
        user: { select: { id: true, subscriptionTier: true, stripeCustomerId: true, stripePaymentMethodId: true } },
        person: { select: { id: true, name: true, shippingAddress1: true, shippingCity: true, shippingState: true, shippingZip: true } },
      },
    });
  }
}
