import { Test, TestingModule } from "@nestjs/testing";
import { ProductSearchService } from "../product-search.service";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("ProductSearchService", () => {
  let service: ProductSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductSearchService],
    }).compile();

    service = module.get(ProductSearchService);
    mockFetch.mockReset();
  });

  it("returns nulls when EXA_API_KEY is not set", async () => {
    delete process.env.EXA_API_KEY;
    const result = await service.searchProduct("Wireless headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns product data from Exa response", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://amazon.com/headphones",
            title: "Wireless Headphones",
            image: "https://example.com/headphones.jpg",
            text: "Premium wireless headphones. $79.99. Free shipping.",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Wireless headphones", "Amazon");
    expect(result).toEqual({
      imageUrl: "https://example.com/headphones.jpg",
      productUrl: "https://amazon.com/headphones",
      priceCents: 7999,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.exa.ai/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns nulls when Exa returns no results", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });

    const result = await service.searchProduct("Very obscure gift");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("returns nulls when fetch fails (graceful degradation)", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await service.searchProduct("Headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("returns nulls when Exa returns non-200", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const result = await service.searchProduct("Headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("extracts price from page text", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://etsy.com/listing/123",
            image: "https://etsy.com/img.jpg",
            text: "Handmade leather journal. Price: $34.50. Ships in 2-3 days.",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Leather journal");
    expect(result.priceCents).toBe(3450);
  });

  it("returns null price when no price in text", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://example.com/product",
            image: "https://example.com/img.jpg",
            text: "A wonderful gift idea for any occasion.",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Gift idea");
    expect(result.priceCents).toBeNull();
    expect(result.imageUrl).toBe("https://example.com/img.jpg");
  });

  it("rejects an implausible price far below the suggestion's own estimate", async () => {
    // Real bug report: a $70-95 estimated jersey showed "Found for $11" —
    // almost certainly a mis-extraction (shipping cost, unrelated promo
    // figure) rather than the actual product price.
    process.env.EXA_API_KEY = "test-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://realmadrid.com/jersey",
            image: "https://realmadrid.com/img.jpg",
            text: "Free shipping on orders over $11. Real Madrid Home Jersey.",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Real Madrid Jersey", "Adidas", 7000);
    expect(result.priceCents).toBeNull();
    expect(result.imageUrl).toBe("https://realmadrid.com/img.jpg");
  });

  it("accepts a price reasonably close to the suggestion's estimate", async () => {
    process.env.EXA_API_KEY = "test-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ url: "https://realmadrid.com/jersey", image: "https://realmadrid.com/img.jpg", text: "$79.99" }],
      }),
    });

    const result = await service.searchProduct("Real Madrid Jersey", "Adidas", 7000);
    expect(result.priceCents).toBe(7999);
  });

  it("searches multiple products in parallel", async () => {
    process.env.EXA_API_KEY = "test-key";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ url: "https://link1.com", image: "https://img1.jpg", text: "$25.00" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

    const results = await service.searchProducts([
      { title: "Gift A", retailerHint: "Amazon" },
      { title: "Gift B" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].imageUrl).toBe("https://img1.jpg");
    expect(results[0].priceCents).toBe(2500);
    expect(results[1].imageUrl).toBeNull();
  });

  describe("findBuyOptions", () => {
    function mockExaResults(results: Array<{ url: string; text: string }>) {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results }) });
    }

    it("returns an empty array when EXA_API_KEY is not set", async () => {
      delete process.env.EXA_API_KEY;
      const result = await service.findBuyOptions("Cozy blanket");
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("makes a single Exa call and returns quickly — no per-candidate liveness fetches", async () => {
      // Regression guard for the production hang: an earlier version fired
      // an additional fetch per candidate to verify it wasn't a dead link,
      // which could stall the whole request past a minute if one retailer's
      // response didn't respect its own abort signal. This asserts the
      // total call count stays at exactly one (the Exa search) regardless
      // of how many results come back.
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://a.com/1", text: "$30.00" },
        { url: "https://b.com/1", text: "$40.00" },
        { url: "https://c.com/1", text: "$50.00" },
      ]);

      const result = await service.findBuyOptions("Desk lamp");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(3);
    });

    it("uses the same retailer-hint-biased query as the proven single-search enrichment", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([{ url: "https://nike.com/1", text: "$45.00" }]);

      await service.findBuyOptions("Fleece hoodie", "Nike");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe("Fleece hoodie Nike product");
    });

    it("dedupes results from the same hostname, keeping only the first", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://amazon.com/product-a", text: "$30.00" },
        { url: "https://amazon.com/product-b", text: "$25.00" },
        { url: "https://target.com/product-c", text: "$28.00" },
      ]);

      const result = await service.findBuyOptions("Desk lamp");

      // amazon.com's first occurrence ($30) is kept over its duplicate ($25);
      // sorted ascending afterward puts target.com's $28 first.
      expect(result.map((o) => o.retailer)).toEqual(["target.com", "amazon.com"]);
      expect(result.find((o) => o.retailer === "amazon.com")?.priceCents).toBe(3000);
    });

    it("sorts options by price ascending and caps at 4", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://a.com/1", text: "$50.00" },
        { url: "https://b.com/1", text: "$20.00" },
        { url: "https://c.com/1", text: "$35.00" },
        { url: "https://d.com/1", text: "$10.00" },
        { url: "https://e.com/1", text: "$15.00" },
      ]);

      const result = await service.findBuyOptions("Candle set");

      expect(result.map((o) => o.priceCents)).toEqual([1000, 1500, 2000, 3500]);
    });

    it("skips a candidate with no extractable price in Exa's snippet", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://a.com/1", text: "No price listed here." },
        { url: "https://b.com/1", text: "$22.00" },
      ]);

      const result = await service.findBuyOptions("Scarf");

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://b.com/1");
    });

    it("rejects a candidate whose price is implausibly far below the estimate", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://a.com/1", text: "$11.00" }, // implausible for a $70+ estimate
        { url: "https://b.com/1", text: "$79.99" },
      ]);

      const result = await service.findBuyOptions("Fleece hoodie", null, 7000);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://b.com/1");
    });
  });

  afterAll(() => {
    delete process.env.EXA_API_KEY;
  });
});
