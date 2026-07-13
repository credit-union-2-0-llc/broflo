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

  it("picks the match closest to the estimate when text has multiple dollar figures", async () => {
    // "Free shipping over $50" comes first in the text, but $89.99 is the
    // one that actually matches a $70-95 estimated jersey.
    process.env.EXA_API_KEY = "test-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://realmadrid.com/jersey",
            image: "https://realmadrid.com/img.jpg",
            text: "Free shipping over $50. Real Madrid Home Jersey — $89.99. Save $10 with membership.",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Real Madrid Jersey", "Adidas", 7000, 9500);
    expect(result.priceCents).toBe(8999);
  });

  it("rejects a result whose own title doesn't match the requested product", async () => {
    // Real bug report: buy links pointed at the wrong object. Exa is
    // semantic search, not exact lookup — it can return a real,
    // well-formed, correctly-priced page for a similar-but-different
    // product on the same domain.
    process.env.EXA_API_KEY = "test-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://us.shop.realmadrid.com/products/away-jersey-25-26",
            title: "FC Barcelona Away Jersey 25/26",
            image: "https://example.com/img.jpg",
            text: "$89.99",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Real Madrid Home Jersey", "Adidas", 7000, 9500);
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("accepts a result whose title matches the requested product even with a differently-cased word order", async () => {
    process.env.EXA_API_KEY = "test-key";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            url: "https://us.shop.realmadrid.com/products/home-jersey-25-26",
            title: "Real Madrid Home Jersey 25/26 — Official Store",
            image: "https://example.com/img.jpg",
            text: "$89.99",
          },
        ],
      }),
    });

    const result = await service.searchProduct("Real Madrid Home Jersey", "Adidas", 7000, 9500);
    expect(result.productUrl).toBe("https://us.shop.realmadrid.com/products/home-jersey-25-26");
  });

  it("skips a dead (404) candidate and falls through to the next relevant one", async () => {
    // Real bug report: the price/link shown directly on a suggestion card
    // (this cached single-search path) can go stale — vet the link before
    // handing it to a person instead of trusting whatever Exa found.
    process.env.EXA_API_KEY = "test-key";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { url: "https://a.com/dead-listing", image: "https://a.com/img.jpg", text: "$80.00" },
            { url: "https://b.com/live-listing", image: "https://b.com/img.jpg", text: "$85.00" },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 }) // liveness check for a.com
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "In stock and ready to ship." }); // liveness check for b.com

    const result = await service.searchProduct("Gift widget");
    expect(result.productUrl).toBe("https://b.com/live-listing");
  });

  it("treats a 200 page with soft-404 text as dead", async () => {
    process.env.EXA_API_KEY = "test-key";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ url: "https://a.com/gone", image: "https://a.com/img.jpg", text: "$80.00" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "Sorry, this item is no longer available.",
      });

    const result = await service.searchProduct("Gift widget");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("returns nulls when the only relevant candidate is confirmed dead", async () => {
    process.env.EXA_API_KEY = "test-key";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ url: "https://a.com/dead", image: "https://a.com/img.jpg", text: "$80.00" }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 410 });

    const result = await service.searchProduct("Gift widget");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("does not penalize a candidate when its liveness check is ambiguous (network error, bot-block, etc.)", async () => {
    process.env.EXA_API_KEY = "test-key";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ url: "https://a.com/product", image: "https://a.com/img.jpg", text: "$80.00" }],
        }),
      })
      .mockRejectedValueOnce(new Error("network error"));

    const result = await service.searchProduct("Gift widget");
    expect(result.productUrl).toBe("https://a.com/product");
  });

  it("does not hang forever when a candidate's liveness check never resolves — an independent hard deadline still bounds it", async () => {
    // Regression guard for the exact production failure that got the
    // original liveness check pulled from findBuyOptions (PR #61): a
    // slow/bot-blocked retailer's connection stalled well past its own
    // AbortController timeout. This proves the new hard deadline bounds
    // wall-clock time even when abort() doesn't cleanly cancel anything.
    jest.useFakeTimers();
    process.env.EXA_API_KEY = "test-key";
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ url: "https://slow-loris.example/1", image: "https://img.jpg", text: "$50.00" }],
        }),
      })
      .mockReturnValueOnce(new Promise(() => {})); // never settles, ignores its abort signal

    const resultPromise = service.searchProduct("Widget");
    await jest.advanceTimersByTimeAsync(5000); // matches LIVENESS_HARD_DEADLINE_MS
    const result = await resultPromise;

    expect(result.productUrl).toBe("https://slow-loris.example/1"); // "unknown" liveness doesn't exclude it
    jest.useRealTimers();
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

    it("rejects a category/collection listing page even if it has a plausible price", async () => {
      // Real bug report: Exa returned a Real Madrid store collection page
      // (/collections/jerseys-kits-25-26) with a plausible-looking price in
      // its snippet, but the collection itself showed "0 products" — a
      // browsable listing page isn't the same as a specific item's page.
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://us.shop.realmadrid.com/collections/jerseys-kits-25-26", text: "$290.00" },
        { url: "https://us.shop.realmadrid.com/products/home-jersey-25-26", text: "$95.00" },
      ]);

      const result = await service.findBuyOptions("Real Madrid Jersey", null, 7000);

      expect(result).toHaveLength(1);
      expect(result[0].url).toContain("/products/");
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

    it("picks the price closest to the estimate when a candidate's snippet has multiple dollar figures", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        {
          url: "https://a.com/1",
          text: "Free shipping over $50. Fleece Hoodie — $89.99. Save $10 with membership.",
        },
      ]);

      const result = await service.findBuyOptions("Fleece hoodie", null, 7000, 9500);

      expect(result[0].priceCents).toBe(8999);
    });

    it("fires a bounded fallback query when the primary retailer-biased query yields fewer than 2 retailers", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([{ url: "https://nike.com/1", text: "$45.00" }]);
      mockExaResults([
        { url: "https://nike.com/1", text: "$45.00" },
        { url: "https://footlocker.com/1", text: "$48.00" },
      ]);

      const result = await service.findBuyOptions("Running shoes", "Nike");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondBody.query).toBe("Running shoes product listing");
      expect(result.map((o) => o.retailer).sort()).toEqual(["footlocker.com", "nike.com"]);
    });

    it("does not fire the fallback query when the primary query already yields 2+ retailers", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://nike.com/1", text: "$45.00" },
        { url: "https://footlocker.com/1", text: "$48.00" },
      ]);

      await service.findBuyOptions("Running shoes", "Nike");

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("filters out a candidate whose title clearly doesn't match the requested product", async () => {
      // Same real bug report as the searchProduct relevance test above,
      // but on the live click-time buy-options path.
      process.env.EXA_API_KEY = "test-key";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              url: "https://us.shop.realmadrid.com/products/away-jersey-25-26",
              title: "FC Barcelona Away Jersey 25/26",
              text: "$89.99",
            },
            {
              url: "https://fanatics.com/products/rm-home-jersey",
              title: "Real Madrid Home Jersey 25/26",
              text: "$92.00",
            },
          ],
        }),
      });

      const result = await service.findBuyOptions("Real Madrid Home Jersey", null, 7000, 9500);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://fanatics.com/products/rm-home-jersey");
    });

    it("lets a candidate through when Exa's response has no title to check (incomplete data, not a real mismatch)", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([{ url: "https://a.com/1", text: "$45.00" }]);

      const result = await service.findBuyOptions("Real Madrid Home Jersey");

      expect(result).toHaveLength(1);
    });

    it("sorts a known-reliable retailer above an unknown one even at a higher price", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://obscure-retailer.io/1", text: "$40.00" },
        { url: "https://amazon.com/1", text: "$55.00" },
      ]);

      const result = await service.findBuyOptions("Desk lamp");

      expect(result.map((o) => o.retailer)).toEqual(["amazon.com", "obscure-retailer.io"]);
    });
  });

  afterAll(() => {
    delete process.env.EXA_API_KEY;
  });
});
