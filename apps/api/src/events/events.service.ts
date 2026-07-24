import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { OccasionType, RecurrenceRule } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateEventDto, UpdateEventDto } from "./dto/events.dto";

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, personId: string, dto: CreateEventDto) {
    const person = await this.ensurePersonOwnership(userId, personId);

    if (person.deletedAt) {
      throw new NotFoundException("Person not found");
    }

    const occasionType = dto.occasionType as unknown as OccasionType;
    const isRecurring = dto.isRecurring ?? this.defaultIsRecurring(occasionType);
    const recurrenceRule =
      dto.recurrenceRule as unknown as RecurrenceRule | undefined ??
      (isRecurring ? RecurrenceRule.annual : RecurrenceRule.one_time);

    this.validateBudget(dto.budgetMinCents, dto.budgetMaxCents);

    const eventDate = new Date(dto.date);
    return this.prisma.event.create({
      data: {
        userId,
        personId,
        name: dto.name,
        occasionType,
        date: eventDate,
        isRecurring,
        recurrenceRule,
        nextOccurrence: this.computeNextOccurrence(eventDate, isRecurring, this.todayStart()),
        budgetMinCents: dto.budgetMinCents ?? null,
        budgetMaxCents: dto.budgetMaxCents ?? null,
        notes: dto.notes ?? null,
        isAutoCreated: false,
        sharedWithFamily: dto.sharedWithFamily ?? false,
      },
    });
  }

  async upcoming(
    userId: string,
    page: number,
    limit: number,
    days: number,
  ) {
    // Bounded, indexed query on the materialized next_occurrence column
    // (idx_events_user_next_occurrence) instead of loading every event and
    // projecting occurrences in JS. `next_occurrence <= today + days`
    // reproduces the old `daysUntil <= days` filter (recurring events always
    // project forward, so only overdue one-time events sit before today), and
    // ordering by it matches the old daysUntil ascending sort.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + days);

    const where = {
      userId,
      person: { deletedAt: null },
      nextOccurrence: { lte: horizon },
    };

    const [total, events] = await Promise.all([
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where,
        include: { person: { select: { name: true } } },
        orderBy: { nextOccurrence: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = events.map((e) => {
      const nextOccurrence = e.nextOccurrence ?? e.date;
      return {
        ...e,
        personName: e.person.name,
        nextOccurrence: nextOccurrence.toISOString().split("T")[0],
        daysUntil: this.computeDaysUntil(nextOccurrence, today),
        person: undefined,
      };
    });

    return {
      data,
      meta: { page, limit, total },
    };
  }

  async update(
    userId: string,
    personId: string,
    eventId: string,
    dto: UpdateEventDto,
  ) {
    const event = await this.ensureEventOwnership(userId, personId, eventId);

    if (dto.budgetMinCents !== undefined || dto.budgetMaxCents !== undefined) {
      const minCents = dto.budgetMinCents ?? event.budgetMinCents;
      const maxCents = dto.budgetMaxCents ?? event.budgetMaxCents;
      this.validateBudget(minCents ?? undefined, maxCents ?? undefined);
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.occasionType !== undefined) data.occasionType = dto.occasionType;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;
    if (dto.budgetMinCents !== undefined) data.budgetMinCents = dto.budgetMinCents;
    if (dto.budgetMaxCents !== undefined) data.budgetMaxCents = dto.budgetMaxCents;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.sharedWithFamily !== undefined) data.sharedWithFamily = dto.sharedWithFamily;

    // Recompute the materialized next occurrence if the date or recurrence
    // changed (either alone changes when the event next lands).
    if (dto.date !== undefined || dto.isRecurring !== undefined) {
      const effDate = dto.date !== undefined ? new Date(dto.date) : event.date;
      const effRecurring =
        dto.isRecurring !== undefined ? dto.isRecurring : event.isRecurring;
      data.nextOccurrence = this.computeNextOccurrence(
        effDate,
        effRecurring,
        this.todayStart(),
      );
    }

    if (event.isAutoCreated) {
      data.userModified = true;
    }

    // Delete stale reminders when the date changes so cron regenerates them
    if (dto.date !== undefined) {
      await this.prisma.reminder.deleteMany({ where: { eventId: event.id } });
    }

    return this.prisma.event.update({
      where: { id: event.id },
      data,
    });
  }

  async remove(userId: string, personId: string, eventId: string) {
    const event = await this.ensureEventOwnership(userId, personId, eventId);

    if (event.isAutoCreated) {
      // Mark as user-deleted so auto-sync won't re-create it
      await this.prisma.event.update({
        where: { id: event.id },
        data: { userDeleted: true },
      });
    }

    await this.prisma.event.delete({ where: { id: event.id } });
  }

  // --- Auto-event sync (called from persons service) ---

  async autoSyncEvents(
    userId: string,
    personId: string,
    birthday: Date | null,
    anniversary: Date | null,
    oldBirthday?: Date | null,
    oldAnniversary?: Date | null,
  ) {
    await this.syncAutoEvent(
      userId,
      personId,
      OccasionType.birthday,
      birthday,
      oldBirthday,
    );
    await this.syncAutoEvent(
      userId,
      personId,
      OccasionType.anniversary,
      anniversary,
      oldAnniversary,
    );
  }

  private async syncAutoEvent(
    userId: string,
    personId: string,
    occasionType: OccasionType,
    newDate: Date | null,
    _oldDate?: Date | null,
  ) {
    const existing = await this.prisma.event.findFirst({
      where: {
        personId,
        occasionType,
        isAutoCreated: true,
      },
    });

    // If a user deleted this auto-event, don't re-create
    if (existing?.userDeleted) return;

    if (newDate === null) {
      // Date cleared: delete auto-event if it exists and user hasn't modified it
      if (existing && !existing.userModified) {
        await this.prisma.event.delete({ where: { id: existing.id } });
      }
      return;
    }

    const label =
      occasionType === OccasionType.birthday ? "Birthday" : "Anniversary";

    const nextOccurrence = this.computeNextOccurrence(newDate, true, this.todayStart());

    if (existing) {
      // Only update if user hasn't manually modified the event
      if (!existing.userModified) {
        await this.prisma.event.update({
          where: { id: existing.id },
          data: { date: newDate, nextOccurrence },
        });
      }
    } else {
      // Create new auto-event
      await this.prisma.event.create({
        data: {
          userId,
          personId,
          name: label,
          occasionType,
          date: newDate,
          isRecurring: true,
          recurrenceRule: RecurrenceRule.annual,
          nextOccurrence,
          isAutoCreated: true,
        },
      });
    }
  }

  /**
   * Roll recurring events whose materialized next_occurrence has slipped into
   * the past (or was never set) forward to their next annual occurrence.
   * Run daily by EventsScheduler so upcoming() stays correct without the old
   * per-read recomputation. Returns the number of events refreshed.
   */
  async refreshStaleRecurring(): Promise<number> {
    const today = this.todayStart();
    const stale = await this.prisma.event.findMany({
      where: {
        isRecurring: true,
        OR: [{ nextOccurrence: { lt: today } }, { nextOccurrence: null }],
      },
      select: { id: true, date: true },
    });
    if (stale.length === 0) return 0;

    await this.prisma.$transaction(
      stale.map((e) =>
        this.prisma.event.update({
          where: { id: e.id },
          data: { nextOccurrence: this.computeNextOccurrence(e.date, true, today) },
        }),
      ),
    );
    return stale.length;
  }

  // --- Helpers ---

  private todayStart(): Date {
    const t = new Date();
    t.setUTCHours(0, 0, 0, 0);
    return t;
  }

  // Everything here runs in UTC, never local time. `eventDate` comes from a
  // @db.Date column (UTC midnight, no real time component) and `today` is
  // expected to be UTC midnight too (see callers) — mixing UTC-parsed dates
  // with local-timezone getters (the previous bug) silently shifts the
  // result by a day in any timezone behind UTC.
  computeNextOccurrence(eventDate: Date, isRecurring: boolean, today: Date): Date {
    const d = new Date(eventDate);
    if (!isRecurring) return d;

    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const todayTime = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

    const thisYear = new Date(Date.UTC(today.getUTCFullYear(), month, day));
    if (thisYear.getTime() >= todayTime) return thisYear;

    return new Date(Date.UTC(today.getUTCFullYear() + 1, month, day));
  }

  private computeDaysUntil(target: Date, today: Date): number {
    const diffMs = target.getTime() - today.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  private defaultIsRecurring(type: OccasionType): boolean {
    return type === OccasionType.birthday || type === OccasionType.anniversary;
  }

  private validateBudget(min?: number, max?: number) {
    if (min !== undefined && max !== undefined && max < min) {
      throw new BadRequestException(
        "Budget maximum must be greater than or equal to budget minimum",
      );
    }
  }

  private async ensurePersonOwnership(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId },
    });
    if (!person || person.deletedAt) throw new NotFoundException("Person not found");
    if (person.userId !== userId) throw new ForbiddenException();
    return person;
  }

  private async ensureEventOwnership(
    userId: string,
    personId: string,
    eventId: string,
  ) {
    await this.ensurePersonOwnership(userId, personId);

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, personId },
    });
    if (!event) throw new NotFoundException("Event not found");
    if (event.userId !== userId) throw new ForbiddenException();
    return event;
  }
}
