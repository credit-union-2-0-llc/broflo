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

    return this.prisma.event.create({
      data: {
        userId,
        personId,
        name: dto.name,
        occasionType,
        date: new Date(dto.date),
        isRecurring,
        recurrenceRule,
        budgetMinCents: dto.budgetMinCents ?? null,
        budgetMaxCents: dto.budgetMaxCents ?? null,
        notes: dto.notes ?? null,
        isAutoCreated: false,
      },
    });
  }

  async upcoming(
    userId: string,
    page: number,
    limit: number,
    days: number,
  ) {
    const events = await this.prisma.event.findMany({
      where: { userId },
      include: { person: { select: { name: true, deletedAt: true } } },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = events
      .filter((e) => !e.person.deletedAt)
      .map((e) => {
        const nextOccurrence = this.computeNextOccurrence(e.date, e.isRecurring, today);
        const daysUntil = this.computeDaysUntil(nextOccurrence, today);
        return {
          ...e,
          personName: e.person.name,
          nextOccurrence: nextOccurrence.toISOString().split("T")[0],
          daysUntil,
          person: undefined,
        };
      })
      .filter((e) => e.daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const total = enriched.length;
    const start = (page - 1) * limit;
    const data = enriched.slice(start, start + limit);

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

    if (existing) {
      // Only update if user hasn't manually modified the event
      if (!existing.userModified) {
        await this.prisma.event.update({
          where: { id: existing.id },
          data: { date: newDate },
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
          isAutoCreated: true,
        },
      });
    }
  }

  // --- Helpers ---

  computeNextOccurrence(eventDate: Date, isRecurring: boolean, today: Date): Date {
    const d = new Date(eventDate);
    if (!isRecurring) return d;

    const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (thisYear >= today) return thisYear;

    return new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
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
