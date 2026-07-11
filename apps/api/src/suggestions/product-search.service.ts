import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const PRICE_REGEX = /\$(\d{1,5}(?:\.\d{2})?)/;
const LOGO_PATTERNS = [/logo/i, /meta_tag/i, /favicon/i, /static\/img/i, /\/nav\//i];
const MAX_BUY_OPTIONS = 4;
// A "found" price under 20% of the suggestion's own low estimate is more
// likely a mis-extraction (a shipping fee, an unrelated promo figure, a
// regex artifact) than the real product price — better to show no price
// than a misleading one.
const MIN_PRICE_PLAUSIBILITY_RATIO = 0.2;

function isProductImage(url: string | undefined): boolean {
  if (!url) return false;
  if (LOGO_PATTERNS.some((p) => p.test(url))) return false;
  return true;
}

export interface ProductSearchResult {
  imageUrl: string | null;
  productUrl: string | null;
  priceCents: number | null;
}

export interface BuyOption {
  retailer: string;
  url: string;
  priceCents: number;
}

@Injectable()
export class ProductSearchService {
  private readonly logger = new Logger(ProductSearchService.name);

  async searchProduct(
    title: string,
    retailerHint?: string | null,
    estimatedPriceMinCents?: number | null,
  ): Promise<ProductSearchResult> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    const query = retailerHint
      ? `${title} ${retailerHint} product`
      : `${title} product listing`;

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
          numResults: 3,
          contents: { text: { maxCharacters: 500 } },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Exa returned ${res.status} for "${query}"`);
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      const data = await res.json();
      const results = data.results || [];

      const best = results.find(
        (r: Record<string, unknown>) => isProductImage(r.image as string),
      ) || results[0];

      if (!best) {
        return { imageUrl: null, productUrl: null, priceCents: null };
      }

      let priceCents: number | null = null;
      const priceMatch = (best.text as string)?.match(PRICE_REGEX);
      if (priceMatch) {
        const extracted = Math.round(parseFloat(priceMatch[1]) * 100);
        priceCents = this.isPlausiblePrice(extracted, estimatedPriceMinCents) ? extracted : null;
      }

      const imageUrl = isProductImage(best.image as string)
        ? (best.image as string)
        : null;

      return {
        imageUrl,
        productUrl: (best.url as string) || null,
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
    suggestions: Array<{ title: string; retailerHint?: string | null; estimatedPriceMinCents?: number | null }>,
  ): Promise<ProductSearchResult[]> {
    return Promise.all(
      suggestions.map((s) => this.searchProduct(s.title, s.retailerHint, s.estimatedPriceMinCents)),
    );
  }

  // Live search fired at the moment a user clicks "Buy Now" — deliberately
  // not reusing the cached productUrl from suggestion-generation time, since
  // that can be days old by the time anyone clicks it.
  //
  // Does NOT do its own liveness check against candidate URLs. An earlier
  // version fetched each page itself to confirm it wasn't a dead link before
  // returning it — that added a real hang risk in production (a single slow
  // or bot-blocked retailer response could stall the whole request past a
  // minute, since nothing bounded the wall-clock time if the underlying
  // fetch didn't respect its own abort signal) for a benefit that's
  // unproven: the always-worked single-search enrichment below
  // (`searchProduct`, what powers the existing "View product" link) has
  // never done any liveness verification either. Trusting Exa the same way
  // that path already does is simpler and matches its track record.
  async findBuyOptions(
    title: string,
    retailerHint?: string | null,
    estimatedPriceMinCents?: number | null,
  ): Promise<BuyOption[]> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return [];

    // Same query shape as searchProduct (retailer-hint-biased when
    // available) rather than the broader "buy price" query this used
    // before — that broader query returned meaningfully worse results.
    const query = retailerHint
      ? `${title} ${retailerHint} product`
      : `${title} product listing`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    let rawResults: Array<Record<string, unknown>> = [];
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
          numResults: 6,
          contents: { text: { maxCharacters: 2000 } },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Exa returned ${res.status} for "${query}"`);
        return [];
      }

      const data = await res.json();
      rawResults = data.results || [];
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.logger.warn(`Buy-options search timed out for "${query}"`);
      } else {
        this.logger.warn(`Buy-options search failed for "${query}": ${(err as Error).message}`);
      }
      return [];
    } finally {
      clearTimeout(timeout);
    }

    const candidates = rawResults
      .map((r) => {
        const url = r.url as string | undefined;
        const priceMatch = (r.text as string)?.match(PRICE_REGEX);
        if (!url || !priceMatch) return null;
        const priceCents = Math.round(parseFloat(priceMatch[1]) * 100);
        if (!this.isPlausiblePrice(priceCents, estimatedPriceMinCents)) return null;
        return { url, priceCents, retailer: this.hostnameOf(url) };
      })
      .filter((c): c is { url: string; priceCents: number; retailer: string } => c !== null);

    if (candidates.length === 0) {
      this.logger.warn(`Buy-options search for "${query}" found ${rawResults.length} result(s), 0 with a plausible price`);
      return [];
    }

    const seenRetailers = new Set<string>();
    const options: BuyOption[] = [];
    for (const c of candidates) {
      if (seenRetailers.has(c.retailer)) continue;
      seenRetailers.add(c.retailer);
      options.push(c);
    }

    return options
      .sort((a, b) => a.priceCents - b.priceCents)
      .slice(0, MAX_BUY_OPTIONS);
  }

  private hostnameOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  private isPlausiblePrice(priceCents: number, estimatedPriceMinCents?: number | null): boolean {
    if (!estimatedPriceMinCents) return true; // nothing to compare against
    return priceCents >= estimatedPriceMinCents * MIN_PRICE_PLAUSIBILITY_RATIO;
  }
}
