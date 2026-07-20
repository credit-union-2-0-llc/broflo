import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ProductSearchService } from "../suggestions/product-search.service";
import { NotificationsService } from "../notifications/notifications.service";

const MAX_WATCHED_PER_CYCLE = 50;
// A price has to drop by at least this fraction of the last known price to
// be worth pinging the user about — small day-to-day fluctuations (rounding,
// a temporary coupon banner Exa happened to catch) aren't a "deal", they're
// noise.
const MEANINGFUL_DROP_RATIO = 0.9; // new price <= 90% of the last known price

type WatchedSuggestion = {
  id: string;
  userId: string;
  eventId: string;
  title: string;
  retailerHint: string | null;
  estimatedPriceMinCents: number;
  estimatedPriceMaxCents: number;
  productUrl: string | null;
  productSourcePriceCents: number | null;
  imageUrl: string | null;
  person: { name: string };
  giftRecord: { id: string; order: { id: string } | null } | null;
};

@Injectable()
export class PriceWatchScheduler {
  private readonly log = new Logger(PriceWatchScheduler.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly productSearch: ProductSearchService,
    private readonly notifications: NotificationsService,
  ) {
    this.enabled = process.env.PRICE_WATCH_ENABLED === "true";
    if (!this.enabled) this.log.warn("Price watch scheduler disabled (PRICE_WATCH_ENABLED != true)");
  }

  // An hour after the Autopilot cron (0 7 * * *) so today's newly-selected
  // picks are already in the watch list by the time this runs.
  @Cron("0 8 * * *")
  async runPriceWatch() {
    if (!this.enabled) return;
    this.log.log("Price watch cron started");

    // UTC, not local — Event.date is a @db.Date column (see
    // AutopilotScheduler's comment for why mixing UTC-parsed dates with
    // local-timezone math silently shifts this by a day).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Only suggestions that are: the currently-selected pick, not dismissed,
    // for an event that hasn't passed yet. Once any of those flips (a new
    // pick replaces this one, the user dismisses it, or the event date is
    // behind us) there's nothing left worth watching — this is re-derived
    // from live state every run rather than a persisted "still watching"
    // flag, so nothing needs an explicit stop step.
    const candidates: WatchedSuggestion[] = await this.prisma.giftSuggestion.findMany({
      where: {
        isSelected: true,
        isDismissed: false,
        event: { date: { gte: today } },
      },
      select: {
        id: true,
        userId: true,
        eventId: true,
        title: true,
        retailerHint: true,
        estimatedPriceMinCents: true,
        estimatedPriceMaxCents: true,
        productUrl: true,
        productSourcePriceCents: true,
        imageUrl: true,
        person: { select: { name: true } },
        giftRecord: { select: { id: true, order: { select: { id: true } } } },
      },
    });

    // Also stop once the gift has actually been marked ordered/purchased
    // (a GiftRecord with a linked Order) — no point re-checking the price
    // of something the person already bought.
    const watchable = candidates.filter((s) => !s.giftRecord?.order);

    let checked = 0;
    for (const suggestion of watchable) {
      if (checked >= MAX_WATCHED_PER_CYCLE) {
        this.log.warn(`Max watched per cycle (${MAX_WATCHED_PER_CYCLE}) reached, deferring remaining`);
        break;
      }
      try {
        await this.checkOne(suggestion);
      } catch (err) {
        this.log.error(`Price watch failed for suggestion ${suggestion.id}: ${err}`);
      }
      checked++;
    }

    this.log.log(`Price watch cron completed: ${checked} suggestion(s) checked`);
  }

  private async checkOne(suggestion: WatchedSuggestion) {
    const hadKnownUrl = !!suggestion.productUrl;

    if (hadKnownUrl) {
      // Re-check the SAME url the user was shown, rather than a fresh
      // broad search — an apples-to-apples price comparison against the
      // exact listing, reusing ProductSearchService's own liveness check
      // and price extraction instead of reimplementing either.
      const result = await this.productSearch.checkPriceAndLiveness(
        suggestion.productUrl!,
        suggestion.estimatedPriceMinCents,
        suggestion.estimatedPriceMaxCents,
      );

      if (result.status === "unknown") return; // ambiguous (bot-block/timeout) — don't act on it

      if (result.status === "live") {
        if (result.priceCents !== null) {
          await this.prisma.giftSuggestion.update({
            where: { id: suggestion.id },
            data: { productSourcePriceCents: result.priceCents },
          });

          const oldPriceCents = suggestion.productSourcePriceCents;
          const meaningfulDrop =
            oldPriceCents != null &&
            oldPriceCents > 0 &&
            result.priceCents <= oldPriceCents * MEANINGFUL_DROP_RATIO;

          if (meaningfulDrop) {
            await this.notifications.create(suggestion.userId, {
              type: "price_watch_drop",
              title: "Price Drop",
              body: `Good timing — the gift we picked for ${suggestion.person.name} ("${suggestion.title}") dropped from $${(oldPriceCents! / 100).toFixed(2)} to $${(result.priceCents / 100).toFixed(2)}.`,
              linkUrl: `/events/${suggestion.eventId}`,
            });
          }
        }
        return;
      }

      // result.status === "gone" — the known link is confirmed dead.
      // Fall through to the broader search below to see if it's back
      // (possibly at a different retailer) before giving up on it.
    }

    const fresh = await this.productSearch.searchProduct(
      suggestion.title,
      suggestion.retailerHint,
      suggestion.estimatedPriceMinCents,
      suggestion.estimatedPriceMaxCents,
    );

    if (!fresh.productUrl) {
      if (hadKnownUrl) {
        // Was live before, now confirmed gone everywhere findable — clear
        // the cached link so tomorrow's run goes straight to this same
        // broader search again instead of re-checking a link we've already
        // confirmed is dead.
        await this.prisma.giftSuggestion.update({
          where: { id: suggestion.id },
          data: { productUrl: null, productSourcePriceCents: null },
        });
      }
      return; // still nothing live found — nothing to report
    }

    // Found a live listing where there wasn't one a moment ago — a restock,
    // whether this suggestion had no link at all or just lost its old one.
    await this.prisma.giftSuggestion.update({
      where: { id: suggestion.id },
      data: {
        productUrl: fresh.productUrl,
        productSourcePriceCents: fresh.priceCents,
        imageUrl: fresh.imageUrl ?? suggestion.imageUrl,
      },
    });

    await this.notifications.create(suggestion.userId, {
      type: "price_watch_restock",
      title: "Back in Stock",
      body: `The gift we picked for ${suggestion.person.name} ("${suggestion.title}") is available again.`,
      linkUrl: `/events/${suggestion.eventId}`,
    });
  }
}
