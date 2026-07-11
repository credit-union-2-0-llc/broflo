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
      mockFetch.mockImplementation(async (url: string) => {
        if (url === "https://api.exa.ai/search") {
          return { ok: true, json: async () => ({ results }) };
        }
        // Liveness check — default to a healthy page unless overridden below.
        return { ok: true, text: async () => "In stock and ready to ship." };
      });
    }

    it("returns an empty array when EXA_API_KEY is not set", async () => {
      delete process.env.EXA_API_KEY;
      const result = await service.findBuyOptions("Cozy blanket");
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("filters out a result whose liveness check reports the page is gone", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockFetch.mockImplementation(async (url: string) => {
        if (url === "https://api.exa.ai/search") {
          return {
            ok: true,
            json: async () => ({
              results: [
                { url: "https://nike.com/dead-product", text: "$45.00" },
                { url: "https://target.com/live-product", text: "$40.00" },
              ],
            }),
          };
        }
        if (url === "https://nike.com/dead-product") {
          return { ok: true, text: async () => "THE PRODUCT YOU ARE LOOKING FOR IS NO LONGER AVAILABLE" };
        }
        return { ok: true, text: async () => "Add to cart" };
      });

      const result = await service.findBuyOptions("Fleece hoodie");

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://target.com/live-product");
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

    it("skips a candidate with no extractable price", async () => {
      process.env.EXA_API_KEY = "test-key";
      mockExaResults([
        { url: "https://a.com/1", text: "No price listed here." },
        { url: "https://b.com/1", text: "$22.00" },
      ]);

      const result = await service.findBuyOptions("Scarf");

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://b.com/1");
    });
  });

  afterAll(() => {
    delete process.env.EXA_API_KEY;
  });
});
