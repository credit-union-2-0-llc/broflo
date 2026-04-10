import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { CreateGiftRecordDto, RecordFeedbackDto } from "./dto/gifts.dto";

const LEVEL_THRESHOLDS = [
  { min: 0, max: 49, key: "rookieBro", name: "Rookie Bro" },
  { min: 50, max: 149, key: "solidDude", name: "Solid Dude" },
  { min: 150, max: 349, key: "giftWhisperer", name: "Gift Whisperer" },
  { min: 350, max: 699, key: "theLegend", name: "The Legend" },
  { min: 700, max: Infinity, key: "brofloElite", name: "Broflo Elite" },
];

function getLevel(score: number) {
  return LEVEL_THRESHOLDS.find((l) => score >= l.min && score <= l.max)!;
}

@Injectable()
export class GiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // --- GET /persons/:personId/gifts ---
  async listGifts(
    userId: string,
    personId: string,
    params: { page?: number; limit?: number; year?: number },
    tier: string,
  ) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");

    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Year filter is Pro/Elite only
    const yearFilter =
      params.year && (tier === "pro" || tier === "elite")
        ? params.year
        : undefined;

    const where: Record<string, unknown> = { personId, userId };
    if (yearFilter) {
      where.givenAt = {
        gte: new Date(`${yearFilter}-01-01`),
        lt: new Date(`${yearFilter + 1}-01-01`),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.giftRecord.findMany({
        where,
        orderBy: { givenAt: "desc" },
        skip,
        take: limit,
        include: { event: { select: { name: true, occasionType: true } } },
      }),
      this.prisma.giftRecord.count({ where }),
    ]);

    // Compute aggregates for Pro/Elite
    let totalSpendCents: number | undefined;
    let averageRating: number | undefined;
    if (tier === "pro" || tier === "elite") {
      const agg = await this.prisma.giftRecord.aggregate({
        where,
        _sum: { priceCents: true },
        _avg: { rating: true },
      });
      totalSpendCents = agg._sum.priceCents ?? undefined;
      averageRating = agg._avg.rating
        ? Math.round(agg._avg.rating * 10) / 10
        : undefined;
    }

    return {
      data,
      meta: {
        page,
        limit,
        total,
        ...(yearFilter ? { year: yearFilter } : {}),
        ...(totalSpendCents !== undefined ? { totalSpendCents } : {}),
        ...(averageRating !== undefined ? { averageRating } : {}),
      },
    };
  }

  // --- POST /persons/:personId/gifts ---
  async createGift(userId: string, personId: string, dto: CreateGiftRecordDto) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, userId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");

    // Validate eventId belongs to person if provided
    if (dto.eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: dto.eventId, personId, userId },
      });
      if (!event)
        throw new BadRequestException("Event not found for this person");
    }

    const giftRecord = await this.prisma.giftRecord.create({
      data: {
        personId,
        eventId: dto.eventId || null,
        userId,
        title: dto.title,
        description: dto.description || null,
        priceCents: dto.priceCents ?? null,
        givenAt: new Date(dto.givenAt),
        source: "manual",
      },
    });

    // +10 Broflo Score
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { brofloScore: { increment: 10 } },
    });

    // Invalidate suggestion cache for this person
    await this.redis.invalidateByPattern(`suggest:${personId}:*`);

    return {
      giftRecord,
      scoreChange: 10,
      newScore: user.brofloScore,
      newLevel: getLevel(user.brofloScore).name,
    };
  }

  // --- PATCH /gifts/:giftId/feedback ---
  async recordFeedback(userId: string, giftId: string, dto: RecordFeedbackDto) {
    const gift = await this.prisma.giftRecord.findFirst({
      where: { id: giftId, userId },
    });
    if (!gift) throw new NotFoundException("Gift record not found");

    let scoreChange = 0;
    const isFirstFeedback = !gift.feedbackScored;
    const isFirstFiveStar = dto.rating === 5 && gift.rating !== 5;

    if (isFirstFeedback) scoreChange += 5;
    if (isFirstFiveStar) scoreChange += 20;

    const updated = await this.prisma.giftRecord.update({
      where: { id: giftId },
      data: {
        rating: dto.rating,
        feedbackNote: dto.note || null,
        feedbackScored: true,
      },
    });

    let newScore = 0;
    if (scoreChange > 0) {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { brofloScore: { increment: scoreChange } },
      });
      newScore = user.brofloScore;
    } else {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      newScore = user.brofloScore;
    }

    // Invalidate suggestion cache
    await this.redis.invalidateByPattern(`suggest:${gift.personId}:*`);

    return {
      giftRecord: updated,
      scoreChange,
      newScore,
      newLevel: getLevel(newScore).name,
      promptNeverAgain: dto.rating === 1,
    };
  }

  // --- GET /gifts/recent ---
  async getRecentGifts(userId: string) {
    const gifts = await this.prisma.giftRecord.findMany({
      where: {
        userId,
        person: { deletedAt: null },
      },
      orderBy: { givenAt: "desc" },
      take: 5,
      include: {
        person: { select: { name: true } },
        event: { select: { name: true } },
      },
    });

    return {
      gifts: gifts.map((g) => ({
        ...g,
        personName: g.person.name,
        eventName: g.event?.name ?? null,
        person: undefined,
        event: undefined,
      })),
    };
  }
}
