import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;

export interface ProductSearchResult {
  imageUrl: string | null;
  productUrl: string | null;
  priceCents: number | null;
}

@Injectable()
export class ProductSearchService {
  private readonly logger = new Logger(ProductSearchService.name);

  async searchProduct(
    title: string,
    retailerHint?: string | null,
  ): Promise<ProductSearchResult> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    const query = retailerHint ? `${title} ${retailerHint}` : title;
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      api_key: apiKey,
      num: "1",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const res = await fetch(
        `https://serpapi.com/search.json?${params}`,
        { signal: controller.signal },
      );

      if (!res.ok) {
        this.logger.warn(`SerpAPI returned ${res.status} for "${query}"`);
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      const data = await res.json();
      const result = data.shopping_results?.[0];
      if (!result) {
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      const priceCents = result.extracted_price
        ? Math.round(result.extracted_price * 100)
        : null;

      return {
        imageUrl: result.thumbnail || null,
        productUrl: result.link || null,
        priceCents,
      };
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.logger.warn(`Product search timed out for "${query}"`);
      } else {
        this.logger.warn(`Product search failed for "${query}": ${(err as Error).message}`);
      }
      return { imageUrl: null, productUrl: null, priceCents: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  async searchProducts(
    suggestions: Array<{ title: string; retailerHint?: string | null }>,
  ): Promise<ProductSearchResult[]> {
    return Promise.all(
      suggestions.map((s) => this.searchProduct(s.title, s.retailerHint)),
    );
  }
}
