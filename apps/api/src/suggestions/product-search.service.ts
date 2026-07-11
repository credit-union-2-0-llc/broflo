import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const LIVENESS_TIMEOUT_MS = 4000;
const PRICE_REGEX = /\$(\d{1,5}(?:\.\d{2})?)/;
const LOGO_PATTERNS = [/logo/i, /meta_tag/i, /favicon/i, /static\/img/i, /\/nav\//i];
const MAX_BUY_OPTIONS = 4;

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
        priceCents = Math.round(parseFloat(priceMatch[1]) * 100);
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
    suggestions: Array<{ title: string; retailerHint?: string | null }>,
  ): Promise<ProductSearchResult[]> {
    return Promise.all(
      suggestions.map((s) => this.searchProduct(s.title, s.retailerHint)),
    );
  }

  // Live search fired at the moment a user clicks "Buy Now" — deliberately
  // not reusing the cached productUrl from suggestion-generation time, since
  // that can be days old by the time anyone clicks it. Runs without the
  // retailer-hint bias so results span multiple retailers, then verifies
  // each candidate is actually still live before returning it.
  async findBuyOptions(title: string, retailerHint?: string | null): Promise<BuyOption[]> {
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
          contents: { text: { maxCharacters: 500 } },
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

    const rawUrls = rawResults
      .map((r) => ({ url: r.url as string | undefined, snippetText: r.text as string | undefined }))
      .filter((r): r is { url: string; snippetText: string | undefined } => !!r.url);

    if (rawUrls.length === 0) {
      this.logger.warn(`Exa returned no usable URLs for "${query}"`);
      return [];
    }

    void retailerHint; // reserved — not used for the broad multi-option search

    // Liveness + price extraction happen together against the same fetch:
    // Exa's snippet is truncated to 500 characters and frequently doesn't
    // reach a price, so a candidate is no longer rejected just because the
    // snippet came up short — the full page (already being fetched to check
    // it's still live) is a much more reliable source.
    const checked = await Promise.all(
      rawUrls.map((r) => this.checkAvailabilityAndPrice(r.url, r.snippetText)),
    );

    const seenRetailers = new Set<string>();
    const options: BuyOption[] = [];
    let liveCount = 0;
    checked.forEach((result, i) => {
      if (!result) return;
      liveCount++;
      const retailer = this.hostnameOf(rawUrls[i].url);
      if (seenRetailers.has(retailer)) return;
      seenRetailers.add(retailer);
      options.push({ url: rawUrls[i].url, priceCents: result.priceCents, retailer });
    });

    if (options.length === 0) {
      this.logger.warn(
        `Buy-options search for "${query}" found ${rawUrls.length} candidate(s), ${liveCount} live, 0 with an extractable price`,
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

  private async checkAvailabilityAndPrice(
    url: string,
    snippetText: string | undefined,
  ): Promise<{ priceCents: number } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;

      const pageText = await res.text();
      const lowerPageText = pageText.toLowerCase();
      if (GONE_TEXT_INDICATORS.some((indicator) => lowerPageText.includes(indicator))) return null;

      // Prefer Exa's snippet for the price (a curated, product-focused
      // extract) — fall back to the raw page (truncated, since matching
      // against the entire page risks picking up an unrelated price from
      // navigation/upsells) only if the snippet didn't have one.
      const priceMatch =
        snippetText?.match(PRICE_REGEX) ?? pageText.slice(0, 5000).match(PRICE_REGEX);
      if (!priceMatch) return null;

      return { priceCents: Math.round(parseFloat(priceMatch[1]) * 100) };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
