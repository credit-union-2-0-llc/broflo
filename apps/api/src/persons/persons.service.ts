import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreatePersonDto,
  UpdatePersonDto,
  CreateNeverAgainDto,
} from "./dto/persons.dto";

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.person.findMany({
      where: { userId, deletedAt: null },
      include: { neverAgainItems: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(userId: string, id: string) {
    const person = await this.prisma.person.findFirst({
      where: { id, userId, deletedAt: null },
      include: { neverAgainItems: true },
    });
    if (!person) throw new NotFoundException("Person not found");
    return person;
  }

  async create(userId: string, dto: CreatePersonDto) {
    return this.prisma.person.create({
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
      },
      include: { neverAgainItems: true },
    });
  }

  async update(userId: string, id: string, dto: UpdatePersonDto) {
    const person = await this.ensureOwnership(userId, id);

    return this.prisma.person.update({
      where: { id: person.id },
      data: {
        name: dto.name,
        relationship: dto.relationship,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        anniversary: dto.anniversary ? new Date(dto.anniversary) : undefined,
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
      },
      include: { neverAgainItems: true },
    });
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
