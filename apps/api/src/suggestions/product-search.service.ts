import { Injectable, Logger } from "@nestjs/common";

const SEARCH_TIMEOUT_MS = 5000;
const LIVENESS_TIMEOUT_MS = 4000;
// An independent backstop, deliberately longer than LIVENESS_TIMEOUT_MS.
// AbortController alone wasn't a reliable bound in production — a slow or
// bot-blocked retailer's connection could stall well past its own abort
// timeout (see the >1min hang that got the original liveness check pulled
// from findBuyOptions, PR #61). This guarantees checkLiveness always
// settles by this deadline regardless of whether abort() actually cancels
// the underlying fetch.
const LIVENESS_HARD_DEADLINE_MS = 5000;
// Many retailers return a normal 200 for a removed/expired listing (e.g.
// "THE PRODUCT YOU ARE LOOKING FOR IS NO LONGER AVAILABLE"), so a status
// code check alone can't catch it.
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
// Words too generic/common to establish relevance on their own — shared
// across totally unrelated products, so they don't count toward a match.
const RELEVANCE_STOPWORDS = new Set([
  "product", "listing", "gift", "item", "size", "color", "official",
  "shop", "store", "buy", "new", "free", "shipping", "sale", "the", "and",
]);
const MIN_SIGNIFICANT_WORD_LENGTH = 4;
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

    // Exa is semantic/fuzzy search, not exact lookup — it can return a
    // real, well-formed, correctly-priced page for a similar-but-wrong
    // product (a different team's jersey, a different color/model on the
    // same domain). Discard anything whose own title doesn't share a
    // meaningful word with what was actually requested before picking a
    // "best" result from what's left.
    const relevantResults = results.filter((r: Record<string, unknown>) =>
      this.isRelevantCandidate(title, r.title as string | undefined),
    );
    if (relevantResults.length === 0) {
      return { imageUrl: null, productUrl: null, priceCents: null };
    }

    // Prefer candidates with a product image, but fall through to the rest
    // if every one of those turns out to be a dead link.
    const ordered = [
      ...relevantResults.filter((r: Record<string, unknown>) => isProductImage(r.image as string)),
      ...relevantResults.filter((r: Record<string, unknown>) => !isProductImage(r.image as string)),
    ];

    // Liveness is advisory, not required — only exclude a candidate on an
    // explicit "this is dead" signal (a definitive not-found status, or
    // soft-404 text on an otherwise-200 page). A check that times out or
    // gets blocked (bot protection, slow storefront) says nothing about
    // whether a real visitor could load the page, so it doesn't count
    // against the candidate. Run concurrently so total added latency is
    // one check's worth, not one per candidate.
    const liveness = await Promise.all(
      ordered.map((r: Record<string, unknown>) => this.checkLiveness(r.url as string)),
    );
    const best = ordered.find((_, i) => liveness[i] !== "gone");

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
    let candidates = this.buildCandidates(primaryResults, estimatedPriceMinCents, estimatedPriceMaxCents, seenRetailers, title);

    // A retailer-hint-biased query can end up mostly returning the same one
    // or two retailers. If that leaves fewer than two distinct options, fire
    // a second, broader query (title only) and merge in anything new —
    // bounded to at most one extra call, only when actually needed.
    if (candidates.length < MIN_DISTINCT_RETAILERS && retailerHint) {
      const fallbackQuery = `${title} product listing`;
      const fallbackResults = await this.queryExa(fallbackQuery, 8, 2000);
      if (fallbackResults) {
        candidates = candidates.concat(
          this.buildCandidates(fallbackResults, estimatedPriceMinCents, estimatedPriceMaxCents, seenRetailers, title),
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
    suggestionTitle: string,
  ): Candidate[] {
    const candidates: Candidate[] = [];
    for (const r of results) {
      const url = r.url as string | undefined;
      if (!url || COLLECTION_URL_PATTERNS.some((p) => p.test(url))) continue;

      if (!this.isRelevantCandidate(suggestionTitle, r.title as string | undefined)) continue;

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

  // Exa's own title for a result is a much stronger relevance signal than
  // its (often-truncated) text snippet — real API responses always include
  // one. A candidate with no title at all (only possible with an
  // incomplete/mocked response) is let through rather than blocked, since
  // there's nothing to check it against.
  private isRelevantCandidate(suggestionTitle: string, candidateTitle: string | undefined): boolean {
    if (!candidateTitle) return true;

    const significantWords = suggestionTitle
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= MIN_SIGNIFICANT_WORD_LENGTH && !RELEVANCE_STOPWORDS.has(w));
    if (significantWords.length === 0) return true;

    // A single shared word (e.g. both titles are some team's "jersey") isn't
    // enough — that's exactly how a wrong-but-similar product slips through.
    // Require a majority of the suggestion's significant words to appear.
    const candidateLower = candidateTitle.toLowerCase();
    const matches = significantWords.filter((w) => candidateLower.includes(w)).length;
    return matches >= Math.ceil(significantWords.length / 2);
  }

  private async checkLiveness(url: string): Promise<"gone" | "live" | "unknown"> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIVENESS_TIMEOUT_MS);

    const fetchAndCheck = (async (): Promise<"gone" | "live" | "unknown"> => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.status === 404 || res.status === 410) return "gone";
        if (!res.ok) return "unknown"; // e.g. 403 bot-block, 5xx — ambiguous, don't penalize
        const text = (await res.text()).toLowerCase();
        return GONE_TEXT_INDICATORS.some((indicator) => text.includes(indicator)) ? "gone" : "live";
      } catch {
        return "unknown"; // network error / abort — ambiguous, don't penalize
      }
    })();

    // Independent hard deadline — see LIVENESS_HARD_DEADLINE_MS above for
    // why this can't just rely on the AbortController timeout alone.
    let hardDeadlineTimer: ReturnType<typeof setTimeout>;
    const hardDeadline = new Promise<"unknown">((resolve) => {
      hardDeadlineTimer = setTimeout(() => resolve("unknown"), LIVENESS_HARD_DEADLINE_MS);
    });

    try {
      return await Promise.race([fetchAndCheck, hardDeadline]);
    } finally {
      clearTimeout(timeout);
      clearTimeout(hardDeadlineTimer!);
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
