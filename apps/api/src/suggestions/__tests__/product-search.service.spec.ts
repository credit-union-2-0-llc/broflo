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

  it("returns nulls when SERPAPI_KEY is not set", async () => {
    delete process.env.SERPAPI_KEY;
    const result = await service.searchProduct("Wireless headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns product data from SerpAPI response", async () => {
    process.env.SERPAPI_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        shopping_results: [
          {
            thumbnail: "https://example.com/headphones.jpg",
            link: "https://amazon.com/headphones",
            extracted_price: 79.99,
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
  });

  it("returns nulls when SerpAPI returns no results", async () => {
    process.env.SERPAPI_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ shopping_results: [] }),
    });

    const result = await service.searchProduct("Very obscure gift");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("returns nulls when fetch fails (graceful degradation)", async () => {
    process.env.SERPAPI_KEY = "test-key";

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await service.searchProduct("Headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("returns nulls when SerpAPI returns non-200", async () => {
    process.env.SERPAPI_KEY = "test-key";

    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const result = await service.searchProduct("Headphones");
    expect(result).toEqual({ imageUrl: null, productUrl: null, priceCents: null });
  });

  it("searches multiple products in parallel", async () => {
    process.env.SERPAPI_KEY = "test-key";

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          shopping_results: [{ thumbnail: "https://img1.jpg", link: "https://link1.com", extracted_price: 25.0 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ shopping_results: [] }),
      });

    const results = await service.searchProducts([
      { title: "Gift A", retailerHint: "Amazon" },
      { title: "Gift B" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].imageUrl).toBe("https://img1.jpg");
    expect(results[1].imageUrl).toBeNull();
  });

  afterAll(() => {
    delete process.env.SERPAPI_KEY;
  });
});
