import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";

const LEAD_DAYS = [30, 7, 1] as const;

@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async listActive(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.reminder.findMany({
      where: {
        userId,
        dismissedAt: null,
        scheduledFor: { lte: today },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            occasionType: true,
            date: true,
            personId: true,
            person: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    });
  }

  async dismiss(userId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId },
    });
    if (!reminder) throw new NotFoundException("Reminder not found");
    if (reminder.userId !== userId) throw new ForbiddenException();

    return this.prisma.reminder.update({
      where: { id: reminderId },
      data: { dismissedAt: new Date() },
    });
  }

  async generateReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 30);

    // Fetch all events for all users, including person for deletedAt check
    const events = await this.prisma.event.findMany({
      include: { person: { select: { deletedAt: true } } },
    });

    for (const event of events) {
      // Skip events for soft-deleted persons
      if (event.person.deletedAt) continue;

      const nextOcc = this.eventsService.computeNextOccurrence(
        event.date,
        event.isRecurring,
        today,
      );

      for (const lead of LEAD_DAYS) {
        const scheduledFor = new Date(nextOcc);
        scheduledFor.setDate(scheduledFor.getDate() - lead);

        // Only create reminders that are within the 30-day window from today
        if (scheduledFor < today || scheduledFor > horizon) continue;

        // Upsert to avoid duplicates (unique constraint handles race conditions)
        try {
          await this.prisma.reminder.upsert({
            where: {
              eventId_leadDays_scheduledFor: {
                eventId: event.id,
                leadDays: lead,
                scheduledFor,
              },
            },
            update: {},
            create: {
              eventId: event.id,
              userId: event.userId,
              leadDays: lead,
              scheduledFor,
            },
          });
        } catch {
          // Unique constraint violation on concurrent runs -- safe to ignore
        }
      }
    }
  }
}
