import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";
import { EntitlementsService } from "../entitlements/entitlements.service";
import type {
  CreatePersonDto,
  UpdatePersonDto,
  CreateNeverAgainDto,
} from "./dto/persons.dto";
import { computeCompleteness } from "../utils/completeness";

@Injectable()
export class PersonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(userId: string) {
    return this.prisma.person.findMany({
      where: { userId, deletedAt: null },
      include: { neverAgainItems: true, tags: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(userId: string, id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, userId, deletedAt: null },
      include: { neverAgainItems: true, tags: true, wishlistItems: true },
    });
    if (!person) throw new NotFoundException("Person not found");
    return person;
  }

  async create(userId: string, dto: CreatePersonDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    // Fails closed: if entitlements data is missing (e.g. DB not seeded yet),
    // default to the Free cap rather than silently becoming unlimited.
    const maxPeople = await this.entitlements.getIntLimit(user.subscriptionTier, "maxPeople", 3);

    const limitError = () =>
      new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `You've hit the Free limit. Three people is a lot... for a free tier. Upgrade and we'll remember everyone.`,
          upgradeUrl: "/upgrade",
          currentTier: user.subscriptionTier,
          requiredTier: "pro",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );

    // The count-check and the create used to be two separate queries — two
    // concurrent requests could both read count=2 against maxPeople=3, both
    // pass, and both insert, landing at 4. Serializable isolation makes
    // Postgres detect that read/write conflict and abort one of the two
    // transactions instead of silently letting both through.
    let person;
    try {
      person = await this.prisma.$transaction(
        async (tx) => {
          if (maxPeople !== null) {
            const count = await tx.person.count({
              where: { userId, deletedAt: null },
            });
            if (count >= maxPeople) throw limitError();
          }

          return tx.person.create({
            data: {
              userId,
              name: dto.name,
              relationship: dto.relationship,
              birthday: dto.birthday ? new Date(dto.birthday) : null,
              anniversary: dto.anniversary ? new Date(dto.anniversary) : null,
              budgetMinCents: dto.budgetMinCents ?? null,
              budgetMaxCents: dto.budgetMaxCents ?? null,
              clothingSizeTop: dto.clothingSizeTop ?? null,
              clothingSizeBottom: dto.clothingSizeBottom ?? null,
              shoeSize: dto.shoeSize ?? null,
              musicTaste: dto.musicTaste ?? null,
              favoriteBrands: dto.favoriteBrands ?? null,
              hobbies: dto.hobbies ?? null,
              foodPreferences: dto.foodPreferences ?? null,
              wishlistUrls: dto.wishlistUrls ?? null,
              notes: dto.notes ?? null,
              pronouns: dto.pronouns ?? null,
              allergens: dto.allergens ?? [],
              dietaryRestrictions: dto.dietaryRestrictions ?? [],
              shippingAddress1: dto.shippingAddress1 ?? null,
              shippingAddress2: dto.shippingAddress2 ?? null,
              shippingCity: dto.shippingCity ?? null,
              shippingState: dto.shippingState ?? null,
              shippingZip: dto.shippingZip ?? null,
              completenessScore: computeCompleteness(dto),
            },
            include: { neverAgainItems: true, tags: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      // A genuine concurrent race lost at the database level — by
      // definition another request just filled the last slot, so this is
      // honestly the same "limit hit" outcome, not a generic server error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        throw limitError();
      }
      throw err;
    }

    await this.eventsService.autoSyncEvents(
      userId,
      person.id,
      person.birthday,
      person.anniversary,
    );

    return person;
  }

  async update(userId: string, id: string, dto: UpdatePersonDto) {
    const person = await this.ensureOwnership(userId, id);

    const oldBirthday = person.birthday;
    const oldAnniversary = person.anniversary;

    const updated = await this.prisma.person.update({
      where: { id: person.id },
      data: {
        name: dto.name,
        relationship: dto.relationship,
        birthday: dto.birthday !== undefined
          ? (dto.birthday ? new Date(dto.birthday) : null)
          : undefined,
        anniversary: dto.anniversary !== undefined
          ? (dto.anniversary ? new Date(dto.anniversary) : null)
          : undefined,
        budgetMinCents: dto.budgetMinCents,
        budgetMaxCents: dto.budgetMaxCents,
        clothingSizeTop: dto.clothingSizeTop,
        clothingSizeBottom: dto.clothingSizeBottom,
        shoeSize: dto.shoeSize,
        musicTaste: dto.musicTaste,
        favoriteBrands: dto.favoriteBrands,
        hobbies: dto.hobbies,
        foodPreferences: dto.foodPreferences,
        wishlistUrls: dto.wishlistUrls,
        notes: dto.notes,
        pronouns: dto.pronouns,
        allergens: dto.allergens,
        dietaryRestrictions: dto.dietaryRestrictions,
        shippingAddress1: dto.shippingAddress1,
        shippingAddress2: dto.shippingAddress2,
        shippingCity: dto.shippingCity,
        shippingState: dto.shippingState,
        shippingZip: dto.shippingZip,
      },
      include: { neverAgainItems: true, tags: true },
    });

    // Recompute completeness score after update (include photo count from S-12)
    const photoCount = await this.prisma.personPhoto.count({
      where: { personId: person.id },
    });
    const mergedForScore = { ...person, ...dto };
    const newScore = computeCompleteness(mergedForScore, photoCount);
    if (newScore !== person.completenessScore) {
      await this.prisma.person.update({
        where: { id: person.id },
        data: { completenessScore: newScore },
      });
      updated.completenessScore = newScore;
    }

    if (dto.birthday !== undefined || dto.anniversary !== undefined) {
      await this.eventsService.autoSyncEvents(
        userId,
        person.id,
        updated.birthday,
        updated.anniversary,
        oldBirthday,
        oldAnniversary,
      );
    }

    return updated;
  }

  async softDelete(userId: string, id: string) {
    const person = await this.ensureOwnership(userId, id);

    await this.prisma.person.update({
      where: { id: person.id },
      data: { deletedAt: new Date() },
    });
  }

  async addNeverAgain(userId: string, personId: string, dto: CreateNeverAgainDto) {
    await this.ensureOwnership(userId, personId);

    return this.prisma.neverAgainItem.create({
      data: {
        personId,
        description: dto.description,
      },
    });
  }

  async removeNeverAgain(userId: string, personId: string, itemId: string) {
    await this.ensureOwnership(userId, personId);

    const item = await this.prisma.neverAgainItem.findFirst({
      where: { id: itemId, personId },
    });
    if (!item) throw new NotFoundException("Never-again item not found");

    await this.prisma.neverAgainItem.delete({ where: { id: itemId } });
  }

  private async ensureOwnership(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");
    if (person.userId !== userId) throw new ForbiddenException();
    return person;
  }
}
