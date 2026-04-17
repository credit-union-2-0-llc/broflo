"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Star, ThumbsUp } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { GiftRecord, BrofloEvent, FeedbackResponse } from "@/lib/api";
import { StarRating } from "./star-rating";
import { FeedbackDialog } from "./feedback-dialog";
import { AddGiftDialog } from "./add-gift-dialog";
import { NeverAgainDialog } from "./never-again-dialog";
import { toast } from "sonner";

interface GiftHistorySectionProps {
  personId: string;
  personName: string;
  events: BrofloEvent[];
  token: string;
  tier: string;
}

export function GiftHistorySection({
  personId,
  personName,
  events,
  token,
  tier,
}: GiftHistorySectionProps) {
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [feedbackGift, setFeedbackGift] = useState<GiftRecord | null>(null);
  const [neverAgainGift, setNeverAgainGift] = useState<GiftRecord | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadGifts = useCallback(async () => {
    setLoading(true);
    try {
      const year =
        yearFilter !== "all" ? parseInt(yearFilter, 10) : undefined;
      const res = await api.getPersonGifts(token, personId, { year, limit: 100 });
      setGifts(res.data);
    } catch {
      // silent — empty state handles it
    } finally {
      setLoading(false);
    }
  }, [token, personId, yearFilter]);

  useEffect(() => {
    loadGifts();
  }, [loadGifts]);

  // Collect available years for filter
  const years = [
    ...new Set(gifts.map((g) => new Date(g.givenAt).getFullYear())),
  ].sort((a, b) => b - a);

  // Group gifts by year
  const grouped = gifts.reduce<Record<number, GiftRecord[]>>((acc, g) => {
    const y = new Date(g.givenAt).getFullYear();
    (acc[y] = acc[y] || []).push(g);
    return acc;
  }, {});
  const sortedYears = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => b - a);

  async function handleNailedIt(gift: GiftRecord) {
    try {
      const result = await api.recordFeedback(token, gift.id, {
        rating: 5,
        note: "Nailed it",
      });
      toast.success(VOICE.gifts.nailedIt);
      setGifts((prev) =>
        prev.map((g) => (g.id === gift.id ? result.giftRecord : g)),
      );
    } catch {
      toast.error("Failed to save. Try again.");
    }
  }

  function handleFeedbackSaved(result: FeedbackResponse) {
    setGifts((prev) =>
      prev.map((g) => (g.id === result.giftRecord.id ? result.giftRecord : g)),
    );
    // Check if 1-star → trigger never-again prompt
    if (result.promptNeverAgain) {
      const gift = gifts.find((g) => g.id === result.giftRecord.id);
      if (gift) {
        setNeverAgainGift(result.giftRecord);
      }
    }
  }

  const isPro = tier === "pro" || tier === "elite";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Gift History
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Gift
          </Button>
          {years.length > 1 && (
            <Select
              value={yearFilter}
              onValueChange={(val) => {
                if (!isPro && val !== "all") {
                  toast(VOICE.upsell.yearView);
                  return;
                }
                setYearFilter(val ?? "all");
              }}
            >
              <SelectTrigger
                className="w-full sm:w-[100px] h-8 text-xs"
                aria-label="Filter gift history by year"
              >
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : gifts.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {VOICE.emptyStates.giftHistory}
        </p>
      ) : (
        <div className="space-y-4">
          {sortedYears.map((year) => (
            <div key={year}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">
                {year}
              </h4>
              <div className="space-y-1">
                {grouped[year].map((gift) => (
                  <GiftRow
                    key={gift.id}
                    gift={gift}
                    expanded={expandedId === gift.id}
                    onToggle={() =>
                      setExpandedId(expandedId === gift.id ? null : gift.id)
                    }
                    onRate={() => setFeedbackGift(gift)}
                    onNailedIt={() => handleNailedIt(gift)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddGiftDialog
        personId={personId}
        personName={personName}
        events={events}
        token={token}
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => loadGifts()}
      />

      {feedbackGift && (
        <FeedbackDialog
          gift={feedbackGift}
          personName={personName}
          token={token}
          open={!!feedbackGift}
          onOpenChange={(open) => !open && setFeedbackGift(null)}
          onSaved={handleFeedbackSaved}
        />
      )}

      {neverAgainGift && (
        <NeverAgainDialog
          giftTitle={neverAgainGift.title}
          personId={personId}
          personName={personName}
          token={token}
          open={!!neverAgainGift}
          onOpenChange={(open) => !open && setNeverAgainGift(null)}
          onConfirmed={() => setNeverAgainGift(null)}
        />
      )}
    </div>
  );
}

// --- Gift Row Sub-component ---

function GiftRow({
  gift,
  expanded,
  onToggle,
  onRate,
  onNailedIt,
}: {
  gift: GiftRecord;
  expanded: boolean;
  onToggle: () => void;
  onRate: () => void;
  onNailedIt: () => void;
}) {
  const date = new Date(gift.givenAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const price = gift.priceCents
    ? `$${(gift.priceCents / 100).toFixed(0)}`
    : null;

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        type="button"
        className="flex items-start gap-3 py-3 w-full text-left hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <StarRating value={gift.rating} size="sm" readonly />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{gift.title}</p>
          <p className="text-xs text-muted-foreground">
            {date}
            {price && ` \u00b7 ${price}`}
            {gift.source === "suggestion" && " \u00b7 Broflo suggestion"}
            {gift.source === "manual" && " \u00b7 Added manually"}
          </p>
        </div>
        {!gift.rating && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onNailedIt();
              }}
              aria-label="Rate this gift 5 stars - nailed it"
            >
              <ThumbsUp className="mr-1 h-3 w-3" />
              Nailed It
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onRate();
              }}
            >
              <Star className="mr-1 h-3 w-3" />
              Rate
            </Button>
          </div>
        )}
      </button>

      {expanded && (
        <div className="pl-10 pb-3 space-y-2 text-sm">
          {gift.description && (
            <p className="text-muted-foreground">{gift.description}</p>
          )}
          {gift.feedbackNote && (
            <p className="text-muted-foreground italic">
              &ldquo;{gift.feedbackNote}&rdquo;
            </p>
          )}
          {gift.suggestionSnapshot && (
            <blockquote className="text-xs italic text-muted-foreground border-l-2 border-amber-3 pl-3">
              {(gift.suggestionSnapshot as { reasoning: string }).reasoning}
            </blockquote>
          )}
          {!gift.rating && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRate}
            >
              Rate this gift
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
