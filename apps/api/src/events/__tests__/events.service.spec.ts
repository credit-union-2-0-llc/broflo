import { Test, TestingModule } from "@nestjs/testing";
import { EventsService } from "../events.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateEventDto, UpdateEventDto } from "../dto/events.dto";

describe("EventsService — next_occurrence materialization", () => {
  let service: EventsService;
  let prisma: {
    event: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    person: { findFirst: jest.Mock };
    reminder: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const userId = "user-1";
  const personId = "person-1";

  beforeEach(async () => {
    prisma = {
      event: {
        create: jest.fn().mockResolvedValue({ id: "e1" }),
        update: jest.fn().mockResolvedValue({ id: "e1" }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      person: {
        findFirst: jest.fn().mockResolvedValue({ id: personId, userId, deletedAt: null }),
      },
      reminder: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(EventsService);
  });

  describe("computeNextOccurrence", () => {
    const today = new Date(Date.UTC(2026, 5, 1)); // 2026-06-01

    it("returns the same date for a one-time event", () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      expect(service.computeNextOccurrence(d, false, today).toISOString().slice(0, 10)).toBe(
        "2026-01-15",
      );
    });

    it("projects a recurring event later this year", () => {
      const d = new Date(Date.UTC(1990, 11, 25)); // Dec 25
      expect(service.computeNextOccurrence(d, true, today).toISOString().slice(0, 10)).toBe(
        "2026-12-25",
      );
    });

    it("rolls a recurring event to next year once this year's date has passed", () => {
      const d = new Date(Date.UTC(1990, 0, 10)); // Jan 10, already past on Jun 1
      expect(service.computeNextOccurrence(d, true, today).toISOString().slice(0, 10)).toBe(
        "2027-01-10",
      );
    });
  });

  describe("create", () => {
    it("persists next_occurrence equal to the date for a one-time event", async () => {
      const dto = {
        name: "Housewarming",
        date: "2026-09-01",
        occasionType: "custom",
        isRecurring: false,
      } as unknown as CreateEventDto;

      await service.create(userId, personId, dto);

      const arg = prisma.event.create.mock.calls[0][0].data;
      expect(arg.nextOccurrence.toISOString().slice(0, 10)).toBe("2026-09-01");
    });
  });

  describe("upcoming", () => {
    it("queries by the materialized column with a horizon window, ordered ascending, paginated", async () => {
      await service.upcoming(userId, 2, 10, 30);

      const findArgs = prisma.event.findMany.mock.calls[0][0];
      expect(findArgs.where.userId).toBe(userId);
      expect(findArgs.where.person).toEqual({ deletedAt: null });
      expect(findArgs.where.nextOccurrence.lte).toBeInstanceOf(Date);
      expect(findArgs.orderBy).toEqual({ nextOccurrence: "asc" });
      expect(findArgs.skip).toBe(10); // (page 2 - 1) * limit 10
      expect(findArgs.take).toBe(10);
      // count uses the same where
      expect(prisma.event.count.mock.calls[0][0].where.nextOccurrence.lte).toBeInstanceOf(Date);
    });

    it("maps rows to personName + daysUntil and drops the person relation", async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const inTen = new Date(today);
      inTen.setUTCDate(inTen.getUTCDate() + 10);
      prisma.event.count.mockResolvedValue(1);
      prisma.event.findMany.mockResolvedValue([
        { id: "e1", date: inTen, nextOccurrence: inTen, person: { name: "Sam" } },
      ]);

      const res = await service.upcoming(userId, 1, 10, 30);

      expect(res.meta).toEqual({ page: 1, limit: 10, total: 1 });
      expect(res.data[0].personName).toBe("Sam");
      expect(res.data[0].daysUntil).toBe(10);
      expect(res.data[0].person).toBeUndefined();
    });
  });

  describe("update", () => {
    beforeEach(() => {
      prisma.event.findFirst.mockResolvedValue({
        id: "e1",
        userId,
        personId,
        date: new Date(Date.UTC(1990, 0, 10)),
        isRecurring: true,
        isAutoCreated: false,
      });
    });

    it("recomputes next_occurrence when the date changes", async () => {
      await service.update(userId, personId, "e1", { date: "2026-12-25" } as UpdateEventDto);
      const data = prisma.event.update.mock.calls[0][0].data;
      expect(data.nextOccurrence.toISOString().slice(0, 10)).toBe("2026-12-25");
    });

    it("does not touch next_occurrence when only unrelated fields change", async () => {
      await service.update(userId, personId, "e1", { notes: "gift ideas" } as UpdateEventDto);
      const data = prisma.event.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty("nextOccurrence");
    });
  });

  describe("refreshStaleRecurring", () => {
    it("rolls stale recurring events forward and returns the count", async () => {
      prisma.event.findMany.mockResolvedValue([
        { id: "e1", date: new Date(Date.UTC(1990, 0, 10)) },
        { id: "e2", date: new Date(Date.UTC(1985, 5, 20)) },
      ]);

      const n = await service.refreshStaleRecurring();

      expect(n).toBe(2);
      expect(prisma.event.update).toHaveBeenCalledTimes(2);
      const firstData = prisma.event.update.mock.calls[0][0].data;
      expect(firstData.nextOccurrence).toBeInstanceOf(Date);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("no-ops when nothing is stale", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      const n = await service.refreshStaleRecurring();
      expect(n).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });
});
