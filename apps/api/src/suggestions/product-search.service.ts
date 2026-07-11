import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const LIVENESS_TIMEOUT_MS = 4000;
const PRICE_REGEX = /\$(\d{1,5}(?:\.\d{2})?)/;
const LOGO_PATTERNS = [/logo/i, /meta_tag/i, /favicon/i, /static\/img/i, /\/nav\//i];
const MAX_BUY_OPTIONS = 4;
// A "found" price under 20% of the suggestion's own low estimate is more
// likely a mis-extraction (a shipping fee, an unrelated promo figure, a
// regex artifact) than the real product price — better to show no price
// than a misleading one.
const MIN_PRICE_PLAUSIBILITY_RATIO = 0.2;

// Soft-404 indicators — many retailers return a normal 200 status for a
// removed/expired listing (e.g. Nike's "THE PRODUCT YOU ARE LOOKING FOR IS
// NO LONGER AVAILABLE"), so a status-code check alone can't catch it.
// Mirrors the same style of list used for out-of-stock detection in
// services/browser-agent/app/agent/browser_order_agent.py.
const GONE_TEXT_INDICATORS = [
  "no longer available",
  "is no longer available",
  "out of stock",
  "sold out",
  "page not found",
  "product not found",
  "item is unavailable",
  "currently unavailable",
];

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
  // that can be days old by the time anyone clicks it. Runs without the
  // retailer-hint bias so results span multiple retailers, then checks each
  // candidate isn't a dead/soft-404 page before returning it.
  async findBuyOptions(
    title: string,
    retailerHint?: string | null,
    estimatedPriceMinCents?: number | null,
  ): Promise<BuyOption[]> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return [];

    const query = `${title} buy price`;
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
          // A bigger budget than the single-search enrichment above — this
          // runs once per click rather than once per suggestion, and a
          // short snippet frequently doesn't reach the price at all.
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

    void retailerHint; // reserved — not used for the broad multi-option search

    // Price comes only from Exa's own extracted text, never from a raw
    // fetch of the page ourselves — most modern storefronts (Nike, Adidas,
    // etc.) render price client-side via JS, so a plain server-side fetch
    // sees an app shell, not the rendered price. A naive regex against that
    // raw HTML/JS matches garbage (e.g. "$1" from a `.replace(re, "$1$2")`
    // call in a minified bundle) far more often than it finds a real price.
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

    // Liveness is advisory, not required — only exclude a candidate on an
    // explicit "this is dead" signal (a definitive not-found status, or
    // soft-404 text on an otherwise-200 page). A fetch that times out or
    // gets blocked (bot protection, slow storefront) says nothing about
    // whether a real visitor could load the page, so it doesn't count
    // against the candidate.
    const liveness = await Promise.all(candidates.map((c) => this.checkLiveness(c.url)));

    const seenRetailers = new Set<string>();
    const options: BuyOption[] = [];
    candidates.forEach((c, i) => {
      if (liveness[i] === "gone") return;
      if (seenRetailers.has(c.retailer)) return;
      seenRetailers.add(c.retailer);
      options.push(c);
    });

    if (options.length === 0) {
      this.logger.warn(
        `Buy-options search for "${query}" found ${candidates.length} priced candidate(s), all flagged as gone`,
      );
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

  private async checkLiveness(url: string): Promise<"gone" | "live" | "unknown"> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 404 || res.status === 410) return "gone";
      if (!res.ok) return "unknown"; // e.g. 403 bot-block, 5xx — ambiguous, don't penalize
      const text = (await res.text()).toLowerCase();
      return GONE_TEXT_INDICATORS.some((indicator) => text.includes(indicator)) ? "gone" : "live";
    } catch {
      return "unknown"; // network error / timeout — ambiguous, don't penalize
    } finally {
      clearTimeout(timeout);
    }
  }
}
