import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { AgentOrdersService } from "../orders/agent/agent-orders.service";
import { AutopilotService } from "./autopilot.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SuggestionsService } from "../suggestions/suggestions.service";

@Injectable()
export class AutopilotScheduler {
  private readonly logger = new Logger(AutopilotScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly agentOrdersService: AgentOrdersService,
    private readonly autopilotService: AutopilotService,
    private readonly notificationsService: NotificationsService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runAutopilot(): Promise<void> {
    if (process.env.AUTOPILOT_ENABLED !== "true") {
      return;
    }

    this.logger.log("Running autopilot scheduler");

    const rules = await this.prisma.autopilotRule.findMany({
      where: { isActive: true },
      include: {
        user: true,
        person: true,
      },
    });

    for (const rule of rules) {
      try {
        await this.processRule(rule);
      } catch (err) {
        this.logger.error(`Error processing rule ${rule.id}`, err);
      }
    }
  }

  private async processRule(rule: any): Promise<void> {
    const today = new Date();

    const events = await this.prisma.event.findMany({
      where: {
        personId: rule.personId,
        userId: rule.userId,
        occasionType: { in: rule.occasionTypes },
        date: {
          gte: today,
          lte: new Date(
            today.getTime() + rule.leadDays * 24 * 60 * 60 * 1000,
          ),
        },
      },
    });

    if (events.length === 0) {
      return;
    }

    const spendCheck = await this.autopilotService.checkSpendingCap(
      rule.userId,
      rule.id,
    );

    if (!spendCheck.allowed) {
      const pct = spendCheck.monthlySpentCents / spendCheck.monthlyCap;
      if (pct >= 0.8) {
        await this.notificationsService.create(rule.userId, {
          type: "autopilot_budget_warning",
          title: "Autopilot budget warning",
          body: `You've used ${Math.round(pct * 100)}% of your monthly autopilot budget.`,
        });
      }

      await this.prisma.autopilotRun.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          eventId: events[0].id,
          status: "skipped_budget",
          amountCents: 0,
        },
      });
      return;
    }

    const { suggestions } = await this.suggestionsService.generate(
      rule.userId,
      {
        personId: rule.personId,
        occasionType: events[0].occasionType,
        budgetMinCents: rule.budgetMinCents,
        budgetMaxCents: rule.budgetMaxCents,
        count: 1,
      },
    );

    if (!suggestions || suggestions.length === 0) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          eventId: events[0].id,
          status: "skipped_no_suggestions",
          amountCents: 0,
        },
      });
      return;
    }

    const suggestion = suggestions[0];

    if (suggestion.confidenceScore < 0.8) {
      await this.notificationsService.create(rule.userId, {
        type: "autopilot_needs_approval",
        title: "Autopilot needs your approval",
        body: `We found a gift for ${rule.person.name} but need your approval to proceed.`,
      });

      await this.prisma.autopilotRun.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          eventId: events[0].id,
          status: "skipped_confidence",
          amountCents: 0,
        },
      });
      return;
    }

    const alreadyRan = await this.prisma.autopilotRun.findFirst({
      where: {
        ruleId: rule.id,
        eventId: events[0].id,
        status: { in: ["placed", "agent_placed"] },
      },
    });

    if (alreadyRan) {
      return;
    }

    if (suggestion.retailerHint?.includes("amazon")) {
      await this.runAgentOrder(rule, events[0], suggestion);
    } else {
      await this.runDirectOrder(rule, events[0], suggestion);
    }
  }

  private async runDirectOrder(
    rule: any,
    event: any,
    suggestion: any,
  ): Promise<void> {
    const preview = await this.ordersService.preview(rule.userId, {
      userId: rule.userId,
      personId: rule.personId,
      retailerSlug: "mock",
      keyword: suggestion.title,
      minBudgetCents: rule.budgetMinCents,
      maxBudgetCents: rule.budgetMaxCents,
    });

    if (!preview?.products?.[0]) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          eventId: event.id,
          status: "skipped_no_product",
          amountCents: 0,
        },
      });
      return;
    }

    const order = await this.ordersService.place(rule.userId, {
      userId: rule.userId,
      personId: rule.personId,
      retailerSlug: "mock",
      retailerProductId: preview.products[0].id,
      amountCents: preview.products[0].priceCents,
      shippingAddress1: rule.person.shippingAddress1,
      shippingCity: rule.person.shippingCity,
      shippingState: rule.person.shippingState,
      shippingZip: rule.person.shippingZip,
    });

    await this.prisma.autopilotRun.create({
      data: {
        ruleId: rule.id,
        userId: rule.userId,
        eventId: event.id,
        status: "placed",
        orderId: order.id,
        amountCents: preview.products[0].priceCents,
      },
    });

    await this.notificationsService.create(rule.userId, {
      type: "autopilot_order_placed",
      title: "Autopilot placed an order!",
      body: `We ordered "${preview.products[0].title}" for ${rule.person.name}. You have 2 hours to cancel.`,
    });
  }

  private async runAgentOrder(
    rule: any,
    event: any,
    suggestion: any,
  ): Promise<void> {
    const preview = await this.agentOrdersService.preview(rule.userId, {
      userId: rule.userId,
      personId: rule.personId,
      retailerUrl: `https://${suggestion.retailerHint}`,
      keyword: suggestion.title,
      budgetCents: suggestion.estimatedPriceMaxCents,
    });

    if (!preview?.products?.[0]) {
      await this.prisma.autopilotRun.create({
        data: {
          ruleId: rule.id,
          userId: rule.userId,
          eventId: event.id,
          status: "skipped_no_product",
          amountCents: 0,
        },
      });
      return;
    }

    const order = await this.agentOrdersService.place(rule.userId, {
      userId: rule.userId,
      personId: rule.personId,
      retailerUrl: `https://${suggestion.retailerHint}`,
      retailerProductId: preview.products[0].id,
      amountCents: preview.products[0].priceCents,
      shippingAddress1: rule.person.shippingAddress1,
      shippingCity: rule.person.shippingCity,
      shippingState: rule.person.shippingState,
      shippingZip: rule.person.shippingZip,
    });

    await this.prisma.autopilotRun.create({
      data: {
        ruleId: rule.id,
        userId: rule.userId,
        eventId: event.id,
        status: "agent_placed",
        orderId: order.id,
        amountCents: preview.products[0].priceCents,
      },
    });

    await this.notificationsService.create(rule.userId, {
      type: "autopilot_order_placed",
      title: "Autopilot placed an order!",
      body: `We ordered "${preview.products[0].title}" for ${rule.person.name}. You have 2 hours to cancel.`,
    });
  }
}