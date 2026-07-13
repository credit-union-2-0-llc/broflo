import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SuggestionsService } from "../suggestions.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { ProductSearchService } from "../product-search.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import { EventsService } from "../../events/events.service";
import type { GenerateSuggestionsDto } from "../dto/suggestions.dto";

const dto: GenerateSuggestionsDto = { personId: "p1", eventId: "e1" } as GenerateSuggestionsDto;

function aiFetchResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      suggestions: [
        {
          title: "Nice Mug",
          description: "A mug",
          estimated_price_min_cents: 1000,
          estimated_price_max_cents: 2000,
          reasoning: "reasons",
          confidence_score: 0.9,
          delight_score: 0.8,
          novelty_score: 0.5,
        },
      ],
      model: "claude-haiku",
      input_tokens: 100,
      output_tokens: 50,
      latency_ms: 500,
      prompt_cache_hit: false,
      retry_count: 0,
      suggestions_filtered: 0,
    }),
  };
}

describe("SuggestionsService.generate — re-roll claim race condition", () => {
  let service: SuggestionsService;
  let prisma: {
    user: { findUniqueOrThrow: jest.Mock };
    person: { findFirst: jest.Mock };
    event: { findFirst: jest.Mock };
    giftSuggestion: { findMany: jest.Mock; create: jest.Mock };
    giftRecord: { findMany: jest.Mock };
    aiAuditLog: { create: jest.Mock };
    suggestionRequestClaim: { count: jest.Mock; create: jest.Mock; delete: jest.Mock };
  };
  let redis: {
    checkRateLimit: jest.Mock;
    checkSpendCap: jest.Mock;
    getCachedSuggestions: jest.Mock;
    setCachedSuggestions: jest.Mock;
    trackSpend: jest.Mock;
  };
  let productSearch: { searchProducts: jest.Mock };
  let entitlements: { getIntLimit: jest.Mock; getStringLimit: jest.Mock; isFeatureEnabled: jest.Mock };
  let events: { computeNextOccurrence: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "u1", subscriptionTier: "free" }) },
      person: {
        findFirst: jest.fn().mockResolvedValue({
          id: "p1",
          name: "Dad",
          birthday: null,
          anniversary: null,
          budgetMinCents: null,
          budgetMaxCents: null,
          neverAgainItems: [],
          tags: [],
          wishlistItems: [],
        }),
      },
      event: {
        findFirst: jest.fn().mockResolvedValue({
          id: "e1",
          occasionType: "birthday",
          date: new Date("2026-08-01"),
          isRecurring: true,
          budgetMinCents: null,
          budgetMaxCents: null,
        }),
      },
      giftSuggestion: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, id: "sug-1", createdAt: new Date(), isSelected: false, isDismissed: false })),
      },
      giftRecord: { findMany: jest.fn().mockResolvedValue([]) },
      aiAuditLog: { create: jest.fn().mockResolvedValue({}) },
      suggestionRequestClaim: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "claim-1" }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    redis = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
      checkSpendCap: jest.fn().mockResolvedValue({ withinCap: true, currentCents: 0 }),
      getCachedSuggestions: jest.fn().mockResolvedValue(null),
      setCachedSuggestions: jest.fn().mockResolvedValue(undefined),
      trackSpend: jest.fn().mockResolvedValue(undefined),
    };
    productSearch = {
      searchProducts: jest.fn().mockResolvedValue([{ imageUrl: null, productUrl: null, priceCents: null }]),
    };
    entitlements = {
      getIntLimit: jest.fn().mockImplementation((_tier: string, key: string) => {
        if (key === "maxRerollRequests") return Promise.resolve(1);
        if (key === "suggestionsPerRequest") return Promise.resolve(3);
        return Promise.resolve(null);
      }),
      getStringLimit: jest.fn().mockResolvedValue("haiku"),
      isFeatureEnabled: jest.fn().mockResolvedValue(false),
    };
    events = {
      computeNextOccurrence: jest.fn().mockReturnValue(new Date("2026-08-01")),
    };

    fetchMock = jest.fn().mockResolvedValue(aiFetchResponse());
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ProductSearchService, useValue: productSearch },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: EventsService, useValue: events },
      ],
    }).compile();

    service = module.get(SuggestionsService);
  });

  it("computes requestIndex from the claims table, not GiftSuggestion rows", async () => {
    prisma.suggestionRequestClaim.count.mockResolvedValue(0);

    await service.generate("u1", dto);

    expect(prisma.suggestionRequestClaim.create).toHaveBeenCalledWith({
      data: { eventId: "e1", userId: "u1", requestIndex: 0 },
    });
  });

  it("rejects when already at the free-tier re-roll cap, without ever calling the AI service", async () => {
    prisma.suggestionRequestClaim.count.mockResolvedValue(1); // maxRerollRequests = 1

    await expect(service.generate("u1", dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.suggestionRequestClaim.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("regression: two concurrent re-rolls both reading requestIndex=0 — the second's claim insert loses the unique-constraint race and is rejected, not double-charged", async () => {
    prisma.suggestionRequestClaim.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(service.generate("u1", dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("releases the claim if the AI service call fails, so the user doesn't lose their re-roll", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    await expect(service.generate("u1", dto)).rejects.toThrow();
    expect(prisma.suggestionRequestClaim.delete).toHaveBeenCalledWith({ where: { id: "claim-1" } });
  });

  it("keeps the claim in place on a successful generation", async () => {
    await service.generate("u1", dto);

    expect(prisma.suggestionRequestClaim.delete).not.toHaveBeenCalled();
  });

  it("does not consume a claim on a cache hit — a pure replay isn't a new re-roll", async () => {
    redis.getCachedSuggestions.mockResolvedValue(
      JSON.stringify({ suggestions: [], meta: { cached: false } }),
    );

    await service.generate("u1", dto);

    expect(prisma.suggestionRequestClaim.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
