import { Test, TestingModule } from "@nestjs/testing";
import { PriceWatchScheduler } from "../price-watch.scheduler";
import { PrismaService } from "../../prisma/prisma.service";
import { ProductSearchService } from "../../suggestions/product-search.service";
import { NotificationsService } from "../../notifications/notifications.service";

const makeSuggestion = (overrides = {}) => ({
  id: "sug-1",
  userId: "user-1",
  eventId: "event-1",
  title: "Nice Watch",
  retailerHint: "amazon.com",
  estimatedPriceMinCents: 3000,
  estimatedPriceMaxCents: 5000,
  productUrl: "https://amazon.com/watch",
  productSourcePriceCents: 4500,
  imageUrl: "https://amazon.com/watch.jpg",
  person: { name: "Jane" },
  giftRecord: null,
  ...overrides,
});

describe("PriceWatchScheduler", () => {
  let scheduler: PriceWatchScheduler;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let productSearch: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;

  beforeEach(async () => {
    process.env.PRICE_WATCH_ENABLED = "true";

    prisma = {
      giftSuggestion: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    productSearch = {
      checkPriceAndLiveness: jest.fn(),
      searchProduct: jest.fn(),
    };
    notifications = {
      create: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceWatchScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductSearchService, useValue: productSearch },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    scheduler = module.get(PriceWatchScheduler);
  });

  afterEach(() => {
    delete process.env.PRICE_WATCH_ENABLED;
  });

  it("does nothing when disabled", async () => {
    delete process.env.PRICE_WATCH_ENABLED;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceWatchScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductSearchService, useValue: productSearch },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    const disabledScheduler = module.get(PriceWatchScheduler);

    await disabledScheduler.runPriceWatch();

    expect(prisma.giftSuggestion.findMany).not.toHaveBeenCalled();
  });

  it("skips suggestions whose gift has already been ordered", async () => {
    prisma.giftSuggestion.findMany.mockResolvedValue([
      makeSuggestion({ giftRecord: { id: "gr-1", order: { id: "order-1" } } }),
    ]);

    await scheduler.runPriceWatch();

    expect(productSearch.checkPriceAndLiveness).not.toHaveBeenCalled();
    expect(productSearch.searchProduct).not.toHaveBeenCalled();
  });

  it("queries only suggestions for events that haven't passed yet", async () => {
    await scheduler.runPriceWatch();

    expect(prisma.giftSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isSelected: true,
          isDismissed: false,
          event: { date: { gte: expect.any(Date) } },
        }),
      }),
    );
  });

  describe("price drop", () => {
    it("notifies and updates the cached price on a meaningful drop", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([makeSuggestion({ productSourcePriceCents: 5000 })]);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "live", priceCents: 4000 });

      await scheduler.runPriceWatch();

      expect(prisma.giftSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: { productSourcePriceCents: 4000 },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "price_watch_drop", linkUrl: "/events/event-1" }),
      );
    });

    it("does not notify when the price drop isn't meaningful", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([makeSuggestion({ productSourcePriceCents: 5000 })]);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "live", priceCents: 4800 });

      await scheduler.runPriceWatch();

      expect(prisma.giftSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: { productSourcePriceCents: 4800 },
      });
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("does not notify or update when liveness is ambiguous", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([makeSuggestion()]);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "unknown", priceCents: null });

      await scheduler.runPriceWatch();

      expect(prisma.giftSuggestion.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
      expect(productSearch.searchProduct).not.toHaveBeenCalled();
    });
  });

  describe("restock", () => {
    it("notifies when a previously-dead link is found live via broader search", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([
        makeSuggestion({ productUrl: null, productSourcePriceCents: null }),
      ]);
      productSearch.searchProduct.mockResolvedValue({
        productUrl: "https://target.com/watch",
        priceCents: 4200,
        imageUrl: "https://target.com/watch.jpg",
      });

      await scheduler.runPriceWatch();

      expect(productSearch.checkPriceAndLiveness).not.toHaveBeenCalled();
      expect(prisma.giftSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: {
          productUrl: "https://target.com/watch",
          productSourcePriceCents: 4200,
          imageUrl: "https://target.com/watch.jpg",
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "price_watch_restock" }),
      );
    });

    it("does nothing when still nothing live is found for a suggestion with no known link", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([
        makeSuggestion({ productUrl: null, productSourcePriceCents: null }),
      ]);
      productSearch.searchProduct.mockResolvedValue({ productUrl: null, priceCents: null, imageUrl: null });

      await scheduler.runPriceWatch();

      expect(prisma.giftSuggestion.update).not.toHaveBeenCalled();
      expect(notifications.create).not.toHaveBeenCalled();
    });

    it("falls back to a broader search when the known link is confirmed gone, and notifies if found elsewhere", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([makeSuggestion()]);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "gone", priceCents: null });
      productSearch.searchProduct.mockResolvedValue({
        productUrl: "https://walmart.com/watch",
        priceCents: 4100,
        imageUrl: null,
      });

      await scheduler.runPriceWatch();

      expect(productSearch.searchProduct).toHaveBeenCalledWith("Nice Watch", "amazon.com", 3000, 5000);
      expect(prisma.giftSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: {
          productUrl: "https://walmart.com/watch",
          productSourcePriceCents: 4100,
          imageUrl: "https://amazon.com/watch.jpg", // falls back to the existing cached image
        },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ type: "price_watch_restock" }),
      );
    });

    it("clears the cached link when a confirmed-gone product still can't be found anywhere", async () => {
      prisma.giftSuggestion.findMany.mockResolvedValue([makeSuggestion()]);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "gone", priceCents: null });
      productSearch.searchProduct.mockResolvedValue({ productUrl: null, priceCents: null, imageUrl: null });

      await scheduler.runPriceWatch();

      expect(prisma.giftSuggestion.update).toHaveBeenCalledWith({
        where: { id: "sug-1" },
        data: { productUrl: null, productSourcePriceCents: null },
      });
      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe("MAX_WATCHED_PER_CYCLE", () => {
    it("stops checking after 50 suggestions", async () => {
      const suggestions = Array.from({ length: 55 }, (_, i) => makeSuggestion({ id: `sug-${i}` }));
      prisma.giftSuggestion.findMany.mockResolvedValue(suggestions);
      productSearch.checkPriceAndLiveness.mockResolvedValue({ status: "live", priceCents: 4500 });

      await scheduler.runPriceWatch();

      expect(productSearch.checkPriceAndLiveness).toHaveBeenCalledTimes(50);
    });
  });
});
