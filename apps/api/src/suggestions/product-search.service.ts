import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const PRICE_REGEX = /\$(\d{1,5}(?:\.\d{2})?)/;
const LOGO_PATTERNS = [/logo/i, /meta_tag/i, /favicon/i, /static\/img/i, /\/nav\//i];
const MAX_BUY_OPTIONS = 4;
const MIN_DISTINCT_RETAILERS = 2;
// A found price outside [20%, 300%] of the suggestion's own estimate range
// is more likely a mis-extraction (a shipping fee, an unrelated promo
// figure, a regex artifact) than the real product price.
const MIN_PRICE_PLAUSIBILITY_RATIO = 0.2;
const MAX_PRICE_PLAUSIBILITY_RATIO = 3;
// Category/collection listing pages (browsable, filterable, and prone to
// showing "0 products" for a specific slug once inventory rotates) rather
// than a specific product's own page — common e-commerce URL conventions
// across Shopify and similar platforms.
const COLLECTION_URL_PATTERNS = [
  /\/collections?\//i,
  /\/categor(y|ies)\//i,
  /\/search\b/i,
  /\/browse\//i,
  /\/shop\/all\b/i,
];
// Well-established retailers to prefer when multiple options exist — not a
// strict allowlist (a suggestion's own official/niche brand store is still
// shown if that's what's found), just a sort-order boost so a known,
// trustworthy name surfaces above an unfamiliar one when both are options.
const KNOWN_RELIABLE_RETAILERS = new Set([
  "amazon.com",
  "target.com",
  "walmart.com",
  "bestbuy.com",
  "etsy.com",
  "ebay.com",
  "nordstrom.com",
  "macys.com",
  "kohls.com",
  "wayfair.com",
  "homedepot.com",
  "lowes.com",
  "costco.com",
  "nike.com",
  "adidas.com",
  "sephora.com",
  "ulta.com",
  "gamestop.com",
  "barnesandnoble.com",
  "rei.com",
  "dickssportinggoods.com",
]);

interface Candidate {
  url: string;
  priceCents: number;
  retailer: string;
}

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
    estimatedPriceMaxCents?: number | null,
  ): Promise<ProductSearchResult> {
    const query = retailerHint
      ? `${title} ${retailerHint} product`
      : `${title} product listing`;

    const results = await this.queryExa(query, 3, 500);
    if (results === null) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    const best = results.find(
      (r: Record<string, unknown>) => isProductImage(r.image as string),
    ) || results[0];

    if (!best) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    const priceCents = this.pickBestPrice(
      (best.text as string) || "",
      estimatedPriceMinCents,
      estimatedPriceMaxCents,
    );

    const imageUrl = isProductImage(best.image as string)
      ? (best.image as string)
      : null;

    return {
      imageUrl,
      productUrl: (best.url as string) || null,
      priceCents,
    };
  }

  async searchProducts(
    suggestions: Array<{
      title: string;
      retailerHint?: string | null;
      estimatedPriceMinCents?: number | null;
      estimatedPriceMaxCents?: number | null;
    }>,
  ): Promise<ProductSearchResult[]> {
    return Promise.all(
      suggestions.map((s) =>
        this.searchProduct(s.title, s.retailerHint, s.estimatedPriceMinCents, s.estimatedPriceMaxCents),
      ),
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
  // unproven: the always-worked single-search enrichment above
  // (`searchProduct`, what powers the existing "View product" link) has
  // never done any liveness verification either. Trusting Exa the same way
  // that path already does is simpler and matches its track record.
  async findBuyOptions(
    title: string,
    retailerHint?: string | null,
    estimatedPriceMinCents?: number | null,
    estimatedPriceMaxCents?: number | null,
  ): Promise<BuyOption[]> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return [];

    // Same query shape as searchProduct (retailer-hint-biased when
    // available) rather than a broader "buy price" query — that broader
    // query returned meaningfully worse results in an earlier version.
    const primaryQuery = retailerHint
      ? `${title} ${retailerHint} product`
      : `${title} product listing`;

    const primaryResults = await this.queryExa(primaryQuery, 8, 2000);
    if (primaryResults === null) return [];

    const seenRetailers = new Set<string>();
    let candidates = this.buildCandidates(primaryResults, estimatedPriceMinCents, estimatedPriceMaxCents, seenRetailers);

    // A retailer-hint-biased query can end up mostly returning the same one
    // or two retailers. If that leaves fewer than two distinct options, fire
    // a second, broader query (title only) and merge in anything new —
    // bounded to at most one extra call, only when actually needed.
    if (candidates.length < MIN_DISTINCT_RETAILERS && retailerHint) {
      const fallbackQuery = `${title} product listing`;
      const fallbackResults = await this.queryExa(fallbackQuery, 8, 2000);
      if (fallbackResults) {
        candidates = candidates.concat(
          this.buildCandidates(fallbackResults, estimatedPriceMinCents, estimatedPriceMaxCents, seenRetailers),
        );
      }
    }

    if (candidates.length === 0) {
      this.logger.warn(`Buy-options search for "${title}" found 0 usable candidates (product-specific + priced)`);
      return [];
    }

    return candidates
      .sort((a, b) => {
        const aReliable = KNOWN_RELIABLE_RETAILERS.has(a.retailer) ? 0 : 1;
        const bReliable = KNOWN_RELIABLE_RETAILERS.has(b.retailer) ? 0 : 1;
        if (aReliable !== bReliable) return aReliable - bReliable;
        return a.priceCents - b.priceCents;
      })
      .slice(0, MAX_BUY_OPTIONS);
  }

  // Builds deduped candidates from one Exa response, mutating seenRetailers
  // so a second (fallback) query call can be merged in without duplicating
  // a retailer already found by the first.
  private buildCandidates(
    results: Array<Record<string, unknown>>,
    estimatedPriceMinCents: number | null | undefined,
    estimatedPriceMaxCents: number | null | undefined,
    seenRetailers: Set<string>,
  ): Candidate[] {
    const candidates: Candidate[] = [];
    for (const r of results) {
      const url = r.url as string | undefined;
      if (!url || COLLECTION_URL_PATTERNS.some((p) => p.test(url))) continue;

      const priceCents = this.pickBestPrice((r.text as string) || "", estimatedPriceMinCents, estimatedPriceMaxCents);
      if (priceCents === null) continue;

      const retailer = this.hostnameOf(url);
      if (seenRetailers.has(retailer)) continue;
      seenRetailers.add(retailer);
      candidates.push({ url, priceCents, retailer });
    }
    return candidates;
  }

  private async queryExa(
    query: string,
    numResults: number,
    maxCharacters: number,
  ): Promise<Array<Record<string, unknown>> | null> {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) return null;

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
          numResults,
          contents: { text: { maxCharacters } },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger.warn(`Exa returned ${res.status} for "${query}"`);
        return null;
      }

      const data = await res.json();
      return data.results || [];
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        this.logger.warn(`Exa search timed out for "${query}"`);
      } else {
        this.logger.warn(`Exa search failed for "${query}": ${(err as Error).message}`);
      }
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private hostnameOf(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  private isPlausiblePrice(
    priceCents: number,
    estimatedPriceMinCents?: number | null,
    estimatedPriceMaxCents?: number | null,
  ): boolean {
    if (!estimatedPriceMinCents) return true; // nothing to compare against
    if (priceCents < estimatedPriceMinCents * MIN_PRICE_PLAUSIBILITY_RATIO) return false;
    const ceiling = estimatedPriceMaxCents ?? estimatedPriceMinCents;
    if (priceCents > ceiling * MAX_PRICE_PLAUSIBILITY_RATIO) return false;
    return true;
  }

  // Extracted text often contains more than one dollar figure (shipping
  // thresholds, "was $X now $Y", unrelated upsells). Rather than trusting
  // whichever comes first, this picks whichever plausible match is closest
  // to the suggestion's own estimated price — a much stronger signal than
  // position-in-text once we already have a ballpark from the AI estimate.
  private pickBestPrice(
    text: string,
    estimatedPriceMinCents?: number | null,
    estimatedPriceMaxCents?: number | null,
  ): number | null {
    const matches = [...text.matchAll(new RegExp(PRICE_REGEX, "g"))].map((m) =>
      Math.round(parseFloat(m[1]) * 100),
    );
    if (matches.length === 0) return null;

    if (!estimatedPriceMinCents) {
      return matches[0]; // no estimate to compare against — best effort
    }

    const plausible = matches.filter((p) =>
      this.isPlausiblePrice(p, estimatedPriceMinCents, estimatedPriceMaxCents),
    );
    if (plausible.length === 0) return null;

    const midpoint = estimatedPriceMaxCents
      ? (estimatedPriceMinCents + estimatedPriceMaxCents) / 2
      : estimatedPriceMinCents;

    return plausible.reduce((closest, p) =>
      Math.abs(p - midpoint) < Math.abs(closest - midpoint) ? p : closest,
    );
  }
}
