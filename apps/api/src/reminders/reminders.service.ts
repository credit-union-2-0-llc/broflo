import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const LEAD_DAYS = [30, 7, 1] as const;

@Injectable()
export class RemindersService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(userId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

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
    // UTC, not local — see EventsService.computeNextOccurrence's comment.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + 30);

    // Reuses the same materialized next_occurrence column + index that
    // EventsService.upcoming() queries on, instead of loading every event in
    // the system and recomputing occurrences in JS. Safe: EventsScheduler's
    // 1am refreshStaleRecurring() always runs before this 6am job, so
    // next_occurrence is already rolled forward for every recurring event by
    // the time this reads it.
    const events = await this.prisma.event.findMany({
      where: {
        nextOccurrence: { lte: horizon },
        person: { deletedAt: null },
      },
      select: { id: true, userId: true, date: true, nextOccurrence: true },
    });

    const rows: {
      eventId: string;
      userId: string;
      leadDays: number;
      scheduledFor: Date;
    }[] = [];

    for (const event of events) {
      const nextOcc = event.nextOccurrence ?? event.date;

      for (const lead of LEAD_DAYS) {
        const scheduledFor = new Date(nextOcc);
        scheduledFor.setUTCDate(scheduledFor.getUTCDate() - lead);

        // Only create reminders that are within the 30-day window from today
        if (scheduledFor < today || scheduledFor > horizon) continue;

        rows.push({ eventId: event.id, userId: event.userId, leadDays: lead, scheduledFor });
      }
    }

    if (rows.length === 0) return;

    // skipDuplicates does the same job the old upsert's no-op `update: {}`
    // body did (create-if-missing, ignore if the unique constraint already
    // has this row) — one batched insert instead of up to events.length * 3
    // sequential round trips.
    await this.prisma.reminder.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }
}
