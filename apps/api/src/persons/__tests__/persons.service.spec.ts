import { Test, TestingModule } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PersonsService } from "../persons.service";
import { PrismaService } from "../../prisma/prisma.service";
import { EventsService } from "../../events/events.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import type { CreatePersonDto } from "../dto/persons.dto";

describe("PersonsService", () => {
  let service: PersonsService;
  let prisma: {
    user: { findUniqueOrThrow: jest.Mock };
    person: { count: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let eventsService: { autoSyncEvents: jest.Mock };
  let entitlements: { getIntLimit: jest.Mock };

  const dto: CreatePersonDto = { name: "Jane", relationship: "friend" } as CreatePersonDto;

  beforeEach(async () => {
    prisma = {
      user: { findUniqueOrThrow: jest.fn() },
      person: {
        count: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "person-1", birthday: null, anniversary: null }),
      },
      // Interactive-transaction mock: runs the callback against the same
      // mocked client, matching real Prisma's tx shape closely enough for
      // these tests (they only touch tx.person).
      $transaction: jest.fn().mockImplementation((callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    eventsService = { autoSyncEvents: jest.fn().mockResolvedValue(undefined) };
    entitlements = { getIntLimit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();

    service = module.get(PersonsService);
  });

  describe("create — maxPeople gate", () => {
    it("allows creation under the free-tier limit", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "free" });
      entitlements.getIntLimit.mockResolvedValue(3);
      prisma.person.count.mockResolvedValue(2);

      await expect(service.create("u1", dto)).resolves.toBeDefined();
      expect(entitlements.getIntLimit).toHaveBeenCalledWith("free", "maxPeople", 3);
    });

    it("throws 402 when at the free-tier limit", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "free" });
      entitlements.getIntLimit.mockResolvedValue(3);
      prisma.person.count.mockResolvedValue(3);

      await expect(service.create("u1", dto)).rejects.toBeInstanceOf(HttpException);
      expect(prisma.person.create).not.toHaveBeenCalled();
    });

    it("allows unlimited people when the plan has no cap (pro/elite)", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "pro" });
      entitlements.getIntLimit.mockResolvedValue(null);
      prisma.person.count.mockResolvedValue(500);

      await expect(service.create("u1", dto)).resolves.toBeDefined();
      expect(prisma.person.count).not.toHaveBeenCalled();
    });

    it("fails closed to the free cap (3) if entitlements data is missing", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "some-corrupted-value" });
      entitlements.getIntLimit.mockResolvedValue(3); // this is what the fallback arg guarantees
      prisma.person.count.mockResolvedValue(3);

      await expect(service.create("u1", dto)).rejects.toBeInstanceOf(HttpException);
      expect(entitlements.getIntLimit).toHaveBeenCalledWith("some-corrupted-value", "maxPeople", 3);
    });

    it("uses a serializable transaction, so the count-check and the create can't race across two concurrent requests", async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "free" });
      entitlements.getIntLimit.mockResolvedValue(3);
      prisma.person.count.mockResolvedValue(2);

      await service.create("u1", dto);

      expect(prisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });

    it("regression: translates a Postgres serialization failure (a real concurrent race) into the same limit-hit error, not a 500", async () => {
      // This is the actual race: two concurrent requests both read count=2
      // against maxPeople=3 and would both have passed under the old
      // separate count-then-create queries. Serializable isolation makes
      // Postgres abort one of the two transactions instead — that shows up
      // to the app as a P2034 error, which should read as "you hit the
      // limit" (honest, and matches what actually happened), not a
      // generic unhandled server error.
      prisma.user.findUniqueOrThrow.mockResolvedValue({ id: "u1", subscriptionTier: "free" });
      entitlements.getIntLimit.mockResolvedValue(3);
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict", {
          code: "P2034",
          clientVersion: "test",
        }),
      );

      await expect(service.create("u1", dto)).rejects.toBeInstanceOf(HttpException);
    });
  });
});
