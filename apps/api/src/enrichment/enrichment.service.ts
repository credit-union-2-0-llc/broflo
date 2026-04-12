import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "dev-ai-service-key";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "30000", 10);

// Debounce windows
const TAG_DEBOUNCE_S = 300; // 5 minutes
const INSIGHT_DEBOUNCE_S = 600; // 10 minutes

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // --- Ownership helper ---

  private async ensureOwnership(userId: string, personId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, deletedAt: null },
    });
    if (!person) throw new NotFoundException("Person not found");
    if (person.userId !== userId) throw new ForbiddenException();
    return person;
  }

  private async callAiService(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": AI_SERVICE_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        this.logger.error(
          `AI service ${endpoint} returned ${res.status}: ${text}`,
        );
        if (res.status === 429) {
          throw new HttpException(
            "AI service is busy. Try again shortly.",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        throw new HttpException(
          "AI enrichment failed",
          HttpStatus.BAD_GATEWAY,
        );
      }

      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // --- Wishlist Parsing (Pro+) ---

  async parseWishlist(userId: string, personId: string, urls: string[]) {
    const person = await this.ensureOwnership(userId, personId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await this.callAiService("/parse-wishlist", {
      urls,
      tier: user.subscriptionTier,
    })) as any;

    // Persist parsed items
    const created = [];
    for (const urlResult of result.results || []) {
      if (urlResult.error) continue;
      for (const product of urlResult.products || []) {
        if (product.confidence < 0.3) continue; // skip low confidence
        const item = await this.prisma.wishlistItem.create({
          data: {
            personId: person.id,
            sourceUrl: urlResult.url,
            productName: product.title?.slice(0, 500) || null,
            category: product.category?.slice(0, 200) || null,
            brand: product.brand?.slice(0, 200) || null,
            priceRange: this.formatPriceRange(product),
          },
        });
        created.push(item);
      }
    }

    return { parsed: result.results, persisted: created };
  }

  private formatPriceRange(product: {
    price_cents?: number | null;
    price_range_min_cents?: number | null;
    price_range_max_cents?: number | null;
  }): string | null {
    if (product.price_cents) {
      return `$${(product.price_cents / 100).toFixed(2)}`;
    }
    if (product.price_range_min_cents && product.price_range_max_cents) {
      return `$${(product.price_range_min_cents / 100).toFixed(2)} - $${(product.price_range_max_cents / 100).toFixed(2)}`;
    }
    return null;
  }

  async getWishlistItems(userId: string, personId: string) {
    await this.ensureOwnership(userId, personId);
    return this.prisma.wishlistItem.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteWishlistItem(
    userId: string,
    personId: string,
    itemId: string,
  ) {
    await this.ensureOwnership(userId, personId);
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId, personId },
    });
    if (!item) throw new NotFoundException("Wishlist item not found");
    await this.prisma.wishlistItem.delete({ where: { id: itemId } });
  }

  // --- Tag Generation (Pro+) ---

  async generateTags(userId: string, personId: string) {
    const person = await this.ensureOwnership(userId, personId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Debounce check
    const debounceKey = `debounce:tags:${personId}`;
    const cached = await this.redis.getCachedSuggestions(debounceKey);
    if (cached) {
      throw new HttpException(
        "Tags were generated recently. Please wait before regenerating.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await this.callAiService("/generate-tags", {
      person_name: person.name,
      relationship: person.relationship,
      hobbies: person.hobbies,
      music_taste: person.musicTaste,
      favorite_brands: person.favoriteBrands,
      food_preferences: person.foodPreferences,
      notes: person.notes,
      tier: user.subscriptionTier,
    })) as any;

    // Clear existing AI tags and replace
    await this.prisma.personTag.deleteMany({
      where: { personId, source: "ai" },
    });

    const tags = [];
    for (const t of result.tags || []) {
      const tag = await this.prisma.personTag.create({
        data: {
          personId,
          tag: t.label.slice(0, 100),
          source: "ai",
        },
      });
      tags.push(tag);
    }

    // Set debounce
    await this.redis.setCachedSuggestions(debounceKey, "1", TAG_DEBOUNCE_S);

    return tags;
  }

  async getTags(userId: string, personId: string) {
    await this.ensureOwnership(userId, personId);
    return this.prisma.personTag.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
    });
  }

  async addManualTag(userId: string, personId: string, tagText: string) {
    await this.ensureOwnership(userId, personId);

    // Normalize
    const normalized = tagText.trim().toLowerCase().slice(0, 100);
    if (normalized.length < 2) {
      throw new HttpException("Tag too short", HttpStatus.BAD_REQUEST);
    }

    // Check duplicate
    const existing = await this.prisma.personTag.findFirst({
      where: { personId, tag: normalized },
    });
    if (existing) {
      throw new HttpException("Tag already exists", HttpStatus.CONFLICT);
    }

    return this.prisma.personTag.create({
      data: {
        personId,
        tag: normalized,
        source: "manual",
      },
    });
  }

  async deleteTag(userId: string, personId: string, tagId: string) {
    await this.ensureOwnership(userId, personId);
    const tag = await this.prisma.personTag.findFirst({
      where: { id: tagId, personId },
    });
    if (!tag) throw new NotFoundException("Tag not found");
    await this.prisma.personTag.delete({ where: { id: tagId } });
  }

  // --- Insight Generation (Elite only) ---

  async generateInsight(userId: string, personId: string) {
    const person = await this.ensureOwnership(userId, personId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.subscriptionTier !== "elite") {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: "Dossier insights are an Elite feature.",
          upgradeUrl: "/upgrade",
          requiredTier: "elite",
          currentTier: user.subscriptionTier,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // Debounce check
    const debounceKey = `debounce:insight:${personId}`;
    const cached = await this.redis.getCachedSuggestions(debounceKey);
    if (cached) {
      throw new HttpException(
        "Insight was generated recently. Please wait before regenerating.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Gather context
    const tags = await this.prisma.personTag.findMany({
      where: { personId },
    });
    const giftHistory = await this.prisma.giftRecord.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const neverAgainItems = await this.prisma.neverAgainItem.findMany({
      where: { personId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await this.callAiService("/generate-insight", {
      person_name: person.name,
      relationship: person.relationship,
      hobbies: person.hobbies,
      music_taste: person.musicTaste,
      favorite_brands: person.favoriteBrands,
      food_preferences: person.foodPreferences,
      clothing_size_top: person.clothingSizeTop,
      clothing_size_bottom: person.clothingSizeBottom,
      shoe_size: person.shoeSize,
      notes: person.notes,
      pronouns: person.pronouns,
      allergens: person.allergens,
      dietary_restrictions: person.dietaryRestrictions,
      tags: tags.map((t) => t.tag),
      gift_history: giftHistory.map((g) => ({
        title: g.title,
        given_at: g.createdAt.toISOString().slice(0, 10),
        rating: g.rating,
      })),
      never_again: neverAgainItems.map((n) => ({
        description: n.description,
      })),
      tier: user.subscriptionTier,
    })) as any;

    // Store insight on person
    const insightText = (result.profile_text || "").slice(0, 2000);
    await this.prisma.person.update({
      where: { id: personId },
      data: { dossierInsight: insightText },
    });

    // Set debounce
    await this.redis.setCachedSuggestions(
      debounceKey,
      "1",
      INSIGHT_DEBOUNCE_S,
    );

    return {
      profile_text: insightText,
      suggested_categories: result.suggested_categories || [],
      data_richness: result.data_richness || "sparse",
    };
  }

  async getInsight(userId: string, personId: string) {
    const person = await this.ensureOwnership(userId, personId);
    return {
      profile_text: person.dossierInsight,
      completeness_score: person.completenessScore,
    };
  }
}
