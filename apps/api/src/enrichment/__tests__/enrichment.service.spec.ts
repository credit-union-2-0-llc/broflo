import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { EnrichmentService } from "../enrichment.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { EntitlementsService } from "../../entitlements/entitlements.service";
import { ProductSearchService } from "../../suggestions/product-search.service";

describe("EnrichmentService.importGiftList", () => {
  let service: EnrichmentService;
  let prisma: {
    person: { findFirst: jest.Mock };
    event: { findFirst: jest.Mock };
    wishlistItem: { create: jest.Mock };
  };
  let productSearch: { searchProducts: jest.Mock };

  const userId = "u1";
  const personId = "p1";
  const eventId = "e1";

  beforeEach(async () => {
    prisma = {
      person: {
        findFirst: jest.fn().mockResolvedValue({ id: personId, userId, deletedAt: null }),
      },
      event: {
        findFirst: jest.fn().mockResolvedValue({ id: eventId, personId, userId }),
      },
      wishlistItem: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `item-${data.productName}`, ...data })),
      },
    };
    productSearch = { searchProducts: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: {} },
        { provide: EntitlementsService, useValue: {} },
        { provide: ProductSearchService, useValue: productSearch },
      ],
    }).compile();

    service = module.get(EnrichmentService);
  });

  it("throws when the event doesn't belong to this person/user", async () => {
    prisma.event.findFirst.mockResolvedValue(null);

    await expect(
      service.importGiftList(userId, personId, eventId, "Wireless earbuds"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(productSearch.searchProducts).not.toHaveBeenCalled();
  });

  it("throws when the person doesn't belong to this user", async () => {
    prisma.person.findFirst.mockResolvedValue({ id: personId, userId: "someone-else", deletedAt: null });

    await expect(
      service.importGiftList(userId, personId, eventId, "Wireless earbuds"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("parses one item per line, dedupes case-insensitively, and persists a wishlist item per line tied to the event", async () => {
    productSearch.searchProducts.mockResolvedValue([
      { imageUrl: "https://img/1.jpg", productUrl: "https://amazon.com/earbuds", priceCents: 4999 },
      { imageUrl: null, productUrl: "https://target.com/blanket", priceCents: 2500 },
    ]);

    const result = await service.importGiftList(
      userId,
      personId,
      eventId,
      "Wireless earbuds\n\n  Cozy blanket  \nwireless earbuds\n",
    );

    expect(productSearch.searchProducts).toHaveBeenCalledWith([
      { title: "Wireless earbuds" },
      { title: "Cozy blanket" },
    ]);
    expect(prisma.wishlistItem.create).toHaveBeenCalledTimes(2);
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        personId,
        eventId,
        sourceUrl: "https://amazon.com/earbuds",
        productName: "Wireless earbuds",
        priceRange: "$49.99",
        imageUrl: "https://img/1.jpg",
      },
    });
    expect(result.items).toHaveLength(2);
    expect(result.totalRequested).toBe(2);
    expect(result.notFoundCount).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("counts items with no resolved product as not-found, without failing the whole import", async () => {
    productSearch.searchProducts.mockResolvedValue([
      { imageUrl: null, productUrl: null, priceCents: null },
    ]);

    const result = await service.importGiftList(userId, personId, eventId, "Some obscure thing");

    expect(result.notFoundCount).toBe(1);
    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: {
        personId,
        eventId,
        sourceUrl: null,
        productName: "Some obscure thing",
        priceRange: null,
        imageUrl: null,
      },
    });
  });

  it("caps the list at MAX_GIFT_LIST_ITEMS (20) and reports truncated", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Item ${i}`);
    productSearch.searchProducts.mockResolvedValue(
      Array.from({ length: 20 }, () => ({ imageUrl: null, productUrl: null, priceCents: null })),
    );

    const result = await service.importGiftList(userId, personId, eventId, lines.join("\n"));

    expect(productSearch.searchProducts).toHaveBeenCalledWith(
      expect.arrayContaining([{ title: "Item 0" }]),
    );
    expect((productSearch.searchProducts.mock.calls[0][0] as unknown[]).length).toBe(20);
    expect(result.totalRequested).toBe(20);
    expect(result.truncated).toBe(true);
  });
});
