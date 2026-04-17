import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const PRICE_REGEX = /\$(\d{1,5}(?:\.\d{2})?)/;

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
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    const query = retailerHint
      ? `buy ${title} ${retailerHint}`
      : `buy ${title} gift`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          type: "auto",
          numResults: 1,
          contents: { text: { maxCharacters: 500 } },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Exa returned ${res.status} for "${query}"`);
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      const data = await res.json();
      const result = data.results?.[0];
      if (!result) {
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      let priceCents: number | null = null;
      const priceMatch = result.text?.match(PRICE_REGEX);
      if (priceMatch) {
        priceCents = Math.round(parseFloat(priceMatch[1]) * 100);
      }

      return {
        imageUrl: result.image || null,
        productUrl: result.url || null,
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
