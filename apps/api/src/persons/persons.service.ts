import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decryptRecord } from '../crypto/pii.middleware';
import { ApplicableFrameworks } from '../compliance/applicable-frameworks.decorator';
import { CreatePersonDto, UpdatePersonDto } from './dto/persons.dto';
import fetch from 'node-fetch';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  async create(userId: string, dto: CreatePersonDto) {
    const person = await this.prisma.person.create({
      data: {
        ...dto,
        userId,
      },
    });
    return person;
  }

  async list(userId: string) {
    const persons = await this.prisma.person.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return persons;
  }

  async get(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  @ApplicableFrameworks(['GDPR', 'CCPA', 'GLBA'])
  async update(userId: string, personId: string, dto: UpdatePersonDto) {
    const existing = await this.prisma.person.findFirst({
      where: { id: personId, userId },
    });
    if (!existing) throw new NotFoundException('Person not found');

    const person = await this.prisma.person.update({
      where: { id: personId },
      data: dto,
    });
    return person;
  }

  async delete(userId: string, personId: string) {
    const existing = await this.prisma.person.findFirst({
      where: { id: personId, userId },
    });
    if (!existing) throw new NotFoundException('Person not found');

    await this.prisma.person.delete({ where: { id: personId } });
    return { success: true };
  }

  async getDecrypted(userId: string, personId: string) {
    const person = await this.get(userId, personId);
    return decryptRecord(person);
  }

  async enrich(userId: string, personId: string) {
    const person = await this.get(userId, personId);

    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8001';

    let responseData: unknown;
    try {
      const res = await fetch(`${aiServiceUrl}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person }),
      });

      if (!res.ok) {
        throw new BadRequestException(`Enrichment service returned ${res.status}`);
      }

      responseData = await res.json();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Enrichment service unavailable');
    }

    const data = responseData as Record<string, unknown>;

    const updated = await this.prisma.person.update({
      where: { id: personId },
      data: {
        enrichedAt: new Date(),
        ...(data.insights !== undefined && { insights: data.insights as string }),
        ...(data.tags !== undefined && { tags: data.tags as string[] }),
      },
    });

    return updated;
  }

  async getWithEvents(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId },
      include: {
        events: {
          orderBy: { date: 'asc' },
        },
      },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async getCompleteness(userId: string, personId: string) {
    const person = await this.get(userId, personId);

    const fields = [
      'name',
      'email',
      'phone',
      'shippingAddress1',
      'shippingCity',
      'shippingState',
      'shippingZip',
      'birthdate',
      'relationship',
    ] as const;

    const filled = fields.filter((f) => {
      const val = (person as Record<string, unknown>)[f];
      return val !== null && val !== undefined && val !== '';
    });

    return {
      score: Math.round((filled.length / fields.length) * 100),
      filledFields: filled,
      totalFields: fields.length,
    };
  }
}