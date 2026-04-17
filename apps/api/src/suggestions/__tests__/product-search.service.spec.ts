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

  afterAll(() => {
    delete process.env.EXA_API_KEY;
  });
});
