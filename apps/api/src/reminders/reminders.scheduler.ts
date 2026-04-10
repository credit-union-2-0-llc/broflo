import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RemindersService } from "./reminders.service";

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);

  constructor(private readonly reminders: RemindersService) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyReminderGeneration() {
    this.logger.log("Running daily reminder generation");
    try {
      await this.reminders.generateReminders();
      this.logger.log("Daily reminder generation complete");
    } catch (error) {
      this.logger.error("Failed to generate reminders", error);
    }
  }
}
