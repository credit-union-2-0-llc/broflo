import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AutopilotService } from './autopilot.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const CONFIDENCE_AUTO_ORDER = 0.80;
const MAX_RUNS_PER_CYCLE = 50;

@Injectable()
export class AutopilotScheduler {
  private readonly log = new Logger(AutopilotScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly autopilotService: AutopilotService,
    private readonly notifications: NotificationsService,
    private readonly suggestionsService: SuggestionsService,
    private readonly entitlements: EntitlementsService,
  ) {
    this.enabled = process.env.AUTOPILOT_ENABLED === 'true';
    if (!this.enabled) this.log.warn('Autopilot scheduler disabled (AUTOPILOT_ENABLED != true)');
  }

  @Cron('0 7 * * *')
  async runAutopilot() {
    if (!this.enabled) return;
    this.log.log('Autopilot cron started');

    // UTC, not local — Event.date is a @db.Date column (UTC midnight, no
    // real time component); comparing it against local-midnight bounds
    // shifts the window by a day in any timezone behind UTC.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find active rules for users whose tier has autopilot enabled
    const autopilotTierKeys = await this.entitlements.getEnabledTierKeys('autopilotEnabled');
    const rules = await this.prisma.autopilotRule.findMany({
      where: {
        isActive: true,
        user: { subscriptionTier: { in: autopilotTierKeys } },
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
    // Find upcoming events within lead days window (UTC, matching `today`)
    const leadDate = new Date(today);
    leadDate.setUTCDate(leadDate.getUTCDate() + rule.leadDays);

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

      // Auto-select this suggestion as the pick and hand the user a one-tap
      // link to buy it, instead of placing a real order automatically.
      // There's no working purchase-execution path today: the "API
      // adapter" below only has a mock retailer implementation, and the
      // browser-agent path called out to a separate AI microservice
      // (BROWSER_AGENT_URL) that was speced but never actually built or
      // deployed (see CLAUDE.md's scheduler flags table). Rather than leave
      // that dead code silently failing in production once enabled,
      // autopilot now does everything up to the final purchase: the
      // suggestion was already relevance- and liveness-vetted during
      // generate() above, so the buy link the user lands on is real.
      try {
        await this.suggestionsService.selectSuggestion(rule.userId, event.id, {
          suggestionId: suggestion.id,
        });

        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            suggestionId: suggestion.id,
            status: 'ready_for_review',
            confidenceScore: suggestion.confidenceScore,
            amountCents: suggestion.estimatedPriceMaxCents,
          },
        });

        await this.notifications.create(rule.userId, {
          type: 'autopilot_ready',
          title: 'Autopilot Found a Gift',
          body: `We found and vetted a gift for ${rule.person.name}: "${suggestion.title}". Tap to review and buy.`,
          linkUrl: `/events/${event.id}`,
        });

        this.log.log(`Autopilot pick ready for review: rule=${rule.id}, suggestion=${suggestion.id}`);
      } catch (err) {
        await this.prisma.autopilotRun.create({
          data: {
            ruleId: rule.id,
            eventId: event.id,
            suggestionId: suggestion.id,
            status: 'failed',
            reason: `Auto-select failed: ${err}`,
          },
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
