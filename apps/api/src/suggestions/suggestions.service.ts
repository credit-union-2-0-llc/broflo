import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  HttpException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import type {
  GenerateSuggestionsDto,
  SelectSuggestionDto,
  DismissSuggestionDto,
} from "./dto/suggestions.dto";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "dev-ai-service-key";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "30000", 10);

const TIER_MAX_REQUESTS: Record<string, number> = {
  free: 1,
  pro: 3,
  elite: 999999,
};

const TIER_COUNTS: Record<string, number> = { free: 3, pro: 5, elite: 5 };

@Injectable()
export class SuggestionsService {
  private readonly logger = new Logger(SuggestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async generate(userId: string, dto: GenerateSuggestionsDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, subscriptionTier: true },
    });
    const tier = user.subscriptionTier as "free" | "pro" | "elite";

    // Rate limit (F-05)
    const rl = await this.redis.checkRateLimit(userId);
    if (!rl.allowed) {
      throw new HttpException("Rate limit exceeded", 429);
    }

    // Daily spend cap (F-05)
    const spendCheck = await this.redis.checkSpendCap();
    if (!spendCheck.withinCap) {
      this.logger.warn(`Daily AI spend cap reached: ${spendCheck.currentCents} cents`);
      throw new HttpException("AI service temporarily unavailable. Please try again later.", 503);
    }

    // Validate ownership
    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, userId, deletedAt: null },
      include: { neverAgainItems: true, tags: true, wishlistItems: true },
    });
    if (!person) throw new NotFoundException("Person not found");

    const event = await this.prisma.event.findFirst({
      where: { id: dto.eventId, personId: dto.personId, userId },
    });
    if (!event) throw new NotFoundException("Event not found");

    // Tier gating (F-06)
    const surpriseFactor = tier === "free" ? "safe" : (dto.surpriseFactor || "safe");
    const guidanceText = tier === "free" ? undefined : dto.guidanceText;

    // Determine request index (re-roll count)
    const existingSets = await this.prisma.giftSuggestion.groupBy({
      by: ["requestIndex"],
      where: { eventId: dto.eventId, userId },
    });
    const requestIndex = existingSets.length;
    const maxRequests = TIER_MAX_REQUESTS[tier] || 1;
    if (requestIndex >= maxRequests) {
      throw new ForbiddenException(
        tier === "free"
          ? "Want more options? Upgrade to Pro for up to 3 re-rolls."
          : "Re-roll limit reached for this event.",
      );
    }

    // Check Redis cache
    const cacheKey = `suggest:${dto.personId}:${dto.eventId}:${tier}:${requestIndex}:${surpriseFactor}`;
    const cached = await this.redis.getCachedSuggestions(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Filter out dismissed suggestions
      const dismissed = await this.prisma.giftSuggestion.findMany({
        where: { eventId: dto.eventId, userId, isDismissed: true },
        select: { id: true },
      });
      const dismissedIds = new Set(dismissed.map((d) => d.id));
      parsed.suggestions = parsed.suggestions.filter(
        (s: { id: string }) => !dismissedIds.has(s.id),
      );
      parsed.meta.cached = true;
      return parsed;
    }

    // Build context for FastAPI
    const budgetMin = event.budgetMinCents ?? person.budgetMinCents ?? 2500;
    const budgetMax = event.budgetMaxCents ?? person.budgetMaxCents ?? 10000;
    const budgetSource = event.budgetMinCents != null ? "event" : person.budgetMinCents != null ? "person" : "default";

    // Compute next occurrence + days until
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.date);
    let nextOcc = new Date(eventDate);
    if (event.isRecurring) {
      nextOcc.setFullYear(today.getFullYear());
      if (nextOcc < today) nextOcc.setFullYear(today.getFullYear() + 1);
    }
    const daysUntil = Math.ceil((nextOcc.getTime() - today.getTime()) / 86400000);

    // Birthday/anniversary month-day extraction
    const birthdayMd = person.birthday
      ? `${(person.birthday.getMonth() + 1).toString().padStart(2, "0")}/${person.birthday.getDate().toString().padStart(2, "0")}`
      : null;
    const anniversaryMd = person.anniversary
      ? `${(person.anniversary.getMonth() + 1).toString().padStart(2, "0")}/${person.anniversary.getDate().toString().padStart(2, "0")}`
      : null;

    // Gift history for Pro/Elite
    let giftHistory: { title: string; given_at: string; rating: number | null }[] = [];
    if (tier !== "free") {
      const gifts = await this.prisma.giftRecord.findMany({
        where: { personId: dto.personId, userId },
        orderBy: { givenAt: "desc" },
        take: 20,
        select: { title: true, givenAt: true, rating: true },
      });
      giftHistory = gifts.map((g) => ({
        title: g.title,
        given_at: g.givenAt.toISOString().slice(0, 10),
        rating: g.rating,
      }));
    }

    // Dismissed suggestions for this event (for re-roll context)
    const dismissedSuggestions = await this.prisma.giftSuggestion.findMany({
      where: { eventId: dto.eventId, userId, isDismissed: true },
      select: { title: true, dismissalReason: true },
    });

    const count = TIER_COUNTS[tier] || 3;

    // Call FastAPI
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    let aiResponse: {
      suggestions: Array<Record<string, unknown>>;
      model: string;
      input_tokens: number;
      output_tokens: number;
      latency_ms: number;
      prompt_cache_hit: boolean;
      retry_count: number;
      suggestions_filtered: number;
    };

    try {
      const res = await fetch(`${AI_SERVICE_URL}/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": AI_SERVICE_KEY,
        },
        body: JSON.stringify({
          person: {
            name: person.name.split(" ")[0], // First name only
            relationship: person.relationship,
            birthday_month_day: birthdayMd,
            anniversary_month_day: anniversaryMd,
            hobbies: person.hobbies,
            music_taste: person.musicTaste,
            favorite_brands: person.favoriteBrands,
            food_preferences: person.foodPreferences,
            clothing_size_top: person.clothingSizeTop,
            clothing_size_bottom: person.clothingSizeBottom,
            shoe_size: person.shoeSize,
            notes: person.notes,
            // S-11: enrichment fields
            pronouns: person.pronouns,
            allergens: person.allergens || [],
            dietary_restrictions: person.dietaryRestrictions || [],
            tags: (person as any).tags?.map((t: any) => t.tag) || [],
            wishlist_items: (person as any).wishlistItems?.map((w: any) => w.productName).filter(Boolean) || [],
          },
          event_type: event.occasionType,
          event_date: nextOcc.toISOString().slice(0, 10),
          days_until: daysUntil,
          budget_min_cents: budgetMin,
          budget_max_cents: budgetMax,
          budget_source: budgetSource,
          never_again: person.neverAgainItems.map((na) => ({
            description: na.description,
          })),
          gift_history: giftHistory,
          dismissed: dismissedSuggestions.map((d) => ({
            title: d.title,
            reason: d.dismissalReason,
          })),
          tier,
          surprise_factor: surpriseFactor,
          guidance_text: guidanceText,
          count,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const status = res.status;
        if (status === 504) throw new HttpException("The gift oracle is temporarily offline. Even we have bad days.", 504);
        if (status === 429) throw new HttpException("AI service rate limited", 429);
        throw new HttpException("AI service error", 502);
      }

      aiResponse = await res.json();
    } catch (err) {
      if (err instanceof HttpException) throw err;
      if ((err as Error).name === "AbortError") {
        throw new HttpException("The gift oracle is temporarily offline. Even we have bad days.", 504);
      }
      this.logger.error("AI service call failed", err);
      throw new HttpException("Something went wrong with our gift engine. Try again.", 500);
    } finally {
      clearTimeout(timeout);
    }

    // Persist suggestions
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await Promise.all(
      aiResponse.suggestions.map((s: Record<string, unknown>) =>
        this.prisma.giftSuggestion.create({
          data: {
            personId: dto.personId,
            eventId: dto.eventId,
            userId,
            title: s.title as string,
            description: s.description as string,
            estimatedPriceMinCents: s.estimated_price_min_cents as number,
            estimatedPriceMaxCents: s.estimated_price_max_cents as number,
            reasoning: s.reasoning as string,
            confidenceScore: s.confidence_score as number,
            delightScore: s.delight_score as number,
            noveltyScore: s.novelty_score as number,
            retailerHint: (s.retailer_hint as string) || null,
            suggestedMessage: (s.suggested_message as string) || null,
            modelVersion: aiResponse.model,
            promptTokens: aiResponse.input_tokens,
            completionTokens: aiResponse.output_tokens,
            latencyMs: aiResponse.latency_ms,
            requestIndex,
            surpriseFactor: surpriseFactor as "safe" | "bold",
            guidanceText: guidanceText || null,
            expiresAt,
          },
        }),
      ),
    );

    // Write audit log
    await this.prisma.aiAuditLog.create({
      data: {
        userId,
        personId: dto.personId,
        eventId: dto.eventId,
        model: aiResponse.model,
        tier,
        inputTokens: aiResponse.input_tokens,
        outputTokens: aiResponse.output_tokens,
        latencyMs: aiResponse.latency_ms,
        cacheHit: false,
        promptCacheHit: aiResponse.prompt_cache_hit,
        suggestionsReturned: created.length,
        suggestionsFiltered: aiResponse.suggestions_filtered,
        retryCount: aiResponse.retry_count,
        status: "success",
      },
    });

    // Estimate cost and track spend (F-05)
    const costPerMTokOut = tier === "free" ? 5 : 15; // Haiku vs Sonnet
    const estimatedCostCents = Math.ceil(
      (aiResponse.output_tokens / 1_000_000) * costPerMTokOut * 100,
    );
    await this.redis.trackSpend(estimatedCostCents);

    // Build response
    const response = {
      suggestions: created.map((s) => ({
        id: s.id,
        personId: s.personId,
        eventId: s.eventId,
        title: s.title,
        description: s.description,
        estimatedPriceMinCents: s.estimatedPriceMinCents,
        estimatedPriceMaxCents: s.estimatedPriceMaxCents,
        reasoning: s.reasoning,
        confidenceScore: s.confidenceScore,
        delightScore: s.delightScore,
        noveltyScore: s.noveltyScore,
        retailerHint: s.retailerHint,
        suggestedMessage: s.suggestedMessage,
        requestIndex: s.requestIndex,
        surpriseFactor: s.surpriseFactor,
        isSelected: s.isSelected,
        isDismissed: s.isDismissed,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      meta: {
        cached: false,
        tier,
        model: aiResponse.model,
        requestIndex,
        budgetApplied: { minCents: budgetMin, maxCents: budgetMax, source: budgetSource },
      },
    };

    // Cache response
    await this.redis.setCachedSuggestions(cacheKey, JSON.stringify(response));

    return response;
  }

  async getEventSuggestions(userId: string, eventId: string, requestIndex?: number) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
    });
    if (!event) throw new NotFoundException("Event not found");

    const where: Record<string, unknown> = {
      eventId,
      userId,
      isDismissed: false,
    };
    if (requestIndex !== undefined) {
      where.requestIndex = requestIndex;
    } else {
      // Get latest request index
      const latest = await this.prisma.giftSuggestion.findFirst({
        where: { eventId, userId },
        orderBy: { requestIndex: "desc" },
        select: { requestIndex: true },
      });
      if (!latest) {
        return { suggestions: [], meta: { requestIndex: 0, total: 0, dismissed: 0 } };
      }
      where.requestIndex = latest.requestIndex;
    }

    const suggestions = await this.prisma.giftSuggestion.findMany({
      where,
      orderBy: { confidenceScore: "desc" },
    });

    const total = await this.prisma.giftSuggestion.count({
      where: { eventId, userId, requestIndex: where.requestIndex as number },
    });
    const dismissed = total - suggestions.length;

    return {
      suggestions: suggestions.map((s) => ({
        id: s.id,
        personId: s.personId,
        eventId: s.eventId,
        title: s.title,
        description: s.description,
        estimatedPriceMinCents: s.estimatedPriceMinCents,
        estimatedPriceMaxCents: s.estimatedPriceMaxCents,
        reasoning: s.reasoning,
        confidenceScore: s.confidenceScore,
        delightScore: s.delightScore,
        noveltyScore: s.noveltyScore,
        retailerHint: s.retailerHint,
        suggestedMessage: s.suggestedMessage,
        requestIndex: s.requestIndex,
        surpriseFactor: s.surpriseFactor,
        isSelected: s.isSelected,
        isDismissed: s.isDismissed,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
      meta: { requestIndex: where.requestIndex as number, total, dismissed },
    };
  }

  async getSuggestionMeta(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
    });
    if (!event) throw new NotFoundException("Event not found");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionTier: true },
    });
    const tier = user.subscriptionTier;
    const maxRequests = TIER_MAX_REQUESTS[tier] || 1;

    const sets = await this.prisma.giftSuggestion.groupBy({
      by: ["requestIndex", "surpriseFactor"],
      where: { eventId, userId },
      _count: { id: true },
      _min: { createdAt: true },
    });

    return {
      eventId,
      requestCount: sets.length,
      maxRequests,
      canReroll: sets.length < maxRequests,
      sets: sets.map((s) => ({
        requestIndex: s.requestIndex,
        suggestionCount: s._count.id,
        surpriseFactor: s.surpriseFactor,
        createdAt: s._min.createdAt?.toISOString(),
      })),
    };
  }

  async selectSuggestion(userId: string, eventId: string, dto: SelectSuggestionDto) {
    const suggestion = await this.prisma.giftSuggestion.findFirst({
      where: { id: dto.suggestionId, eventId, userId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");
    if (suggestion.isDismissed) throw new BadRequestException("Cannot select a dismissed suggestion");

    // Deselect any previously selected suggestion for this event
    await this.prisma.giftSuggestion.updateMany({
      where: { eventId, userId, isSelected: true },
      data: { isSelected: false },
    });

    // Select this one
    const updated = await this.prisma.giftSuggestion.update({
      where: { id: dto.suggestionId },
      data: { isSelected: true },
    });

    // Create or update GiftRecord
    const event = await this.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    const eventDate = new Date(event.date);
    if (event.isRecurring) {
      const now = new Date();
      eventDate.setFullYear(now.getFullYear());
      if (eventDate < now) eventDate.setFullYear(now.getFullYear() + 1);
    }

    const existingRecord = await this.prisma.giftRecord.findFirst({
      where: { eventId, userId, source: "suggestion" },
    });

    let giftRecord;
    let scoreChange = 0;

    const snapshot = {
      title: suggestion.title,
      estimatedPriceMinCents: suggestion.estimatedPriceMinCents,
      estimatedPriceMaxCents: suggestion.estimatedPriceMaxCents,
      reasoning: suggestion.reasoning,
      confidenceScore: suggestion.confidenceScore,
    };

    if (existingRecord) {
      giftRecord = await this.prisma.giftRecord.update({
        where: { id: existingRecord.id },
        data: {
          suggestionId: dto.suggestionId,
          title: suggestion.title,
          description: suggestion.description,
          priceCents: Math.round(
            (suggestion.estimatedPriceMinCents + suggestion.estimatedPriceMaxCents) / 2,
          ),
          suggestionSnapshot: snapshot,
        },
      });
    } else {
      giftRecord = await this.prisma.giftRecord.create({
        data: {
          personId: suggestion.personId,
          eventId,
          userId,
          suggestionId: dto.suggestionId,
          title: suggestion.title,
          description: suggestion.description,
          priceCents: Math.round(
            (suggestion.estimatedPriceMinCents + suggestion.estimatedPriceMaxCents) / 2,
          ),
          givenAt: eventDate,
          source: "suggestion",
          suggestionSnapshot: snapshot,
        },
      });

      // +10 Broflo Score for first gift record on this event
      await this.prisma.user.update({
        where: { id: userId },
        data: { brofloScore: { increment: 10 } },
      });
      scoreChange = 10;
    }

    // Invalidate cache for this person (new gift affects future history context)
    await this.redis.invalidateByPattern(`suggest:${suggestion.personId}:*`);

    return { suggestion: updated, giftRecord, scoreChange };
  }

  async dismissSuggestion(userId: string, suggestionId: string, dto: DismissSuggestionDto) {
    const suggestion = await this.prisma.giftSuggestion.findFirst({
      where: { id: suggestionId, userId },
    });
    if (!suggestion) throw new NotFoundException("Suggestion not found");

    const updated = await this.prisma.giftSuggestion.update({
      where: { id: suggestionId },
      data: {
        isDismissed: true,
        dismissalReason: dto.reason || null,
      },
    });

    // If it was selected, deselect and remove the gift record (if no feedback yet)
    if (suggestion.isSelected) {
      await this.prisma.giftSuggestion.update({
        where: { id: suggestionId },
        data: { isSelected: false },
      });
      await this.prisma.giftRecord.deleteMany({
        where: { suggestionId, feedbackScored: false },
      });
    }

    return { id: updated.id, isDismissed: true, dismissalReason: updated.dismissalReason };
  }

  // --- Cache invalidation hooks ---

  async invalidateSuggestionsForPerson(personId: string): Promise<void> {
    await this.redis.invalidateByPattern(`suggest:${personId}:*`);
  }

  async invalidateSuggestionsForEvent(personId: string, eventId: string): Promise<void> {
    await this.redis.invalidateByPattern(`suggest:${personId}:${eventId}:*`);
  }
}
