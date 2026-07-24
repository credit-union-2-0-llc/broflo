import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventsService } from "./events.service";

@Injectable()
export class EventsScheduler {
  private readonly logger = new Logger(EventsScheduler.name);
  private readonly enabled: boolean;

  constructor(private readonly events: EventsService) {
    // DB-only, no external cost — on by default (opt out with =false).
    this.enabled = process.env.EVENTS_REFRESH_ENABLED !== "false";
  }

  // Just after midnight UTC, before the 6am reminder run, so upcoming() and
  // reminders both see freshly-rolled next_occurrence values.
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleDailyNextOccurrenceRefresh() {
    if (!this.enabled) return;
    try {
      const refreshed = await this.events.refreshStaleRecurring();
      if (refreshed > 0) {
        this.logger.log(`Refreshed next_occurrence for ${refreshed} recurring event(s)`);
      }
    } catch (error) {
      this.logger.error("Failed to refresh recurring event occurrences", error);
    }
  }
}
