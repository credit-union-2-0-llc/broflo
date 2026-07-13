"use client";

import { Button } from "@/components/ui/button";
import { X, Check, ShoppingBag, ExternalLink } from "lucide-react";
import { VOICE } from "@broflo/shared";
import type { GiftSuggestion } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useCancelCountdown } from "@/hooks/use-cancel-countdown";
import { PrismStatRing } from "./prism-stat-ring";

const CYAN = "#22d3ee";
const CORAL = "#ff8fa3";
const AMBER = "#ffc24b";

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

interface SuggestionCardProps {
  suggestion: GiftSuggestion;
  isTopPick: boolean;
  onSelect: (id: string) => void;
  onDismiss: (id: string) => void;
  selecting?: boolean;
  onOrderThis?: (suggestionId: string) => void;
  orderStatus?: string | null;
  orderPlacedAt?: string | null;
  onBuyNow?: (suggestionId: string) => void;
}

function BuyNowButton({
  suggestionId,
  retailerHint,
  onBuyNow,
}: {
  suggestionId: string;
  retailerHint: string | null;
  onBuyNow: (suggestionId: string) => void;
}) {
  return (
    <button
      onClick={() => onBuyNow(suggestionId)}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-transparent px-4 py-2 text-[12.5px] text-[#c7c8d1] hover:border-white/20 hover:text-[#eef2fa] transition-colors"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {retailerHint ? `Buy on ${retailerHint}` : VOICE.buyNowCta}
    </button>
  );
}

function OrderActions({
  suggestionId,
  orderStatus,
  orderPlacedAt,
  onOrderThis,
}: {
  suggestionId: string;
  orderStatus?: string | null;
  orderPlacedAt?: string | null;
  onOrderThis?: (suggestionId: string) => void;
}) {
  const { formatted } = useCancelCountdown(
    orderStatus === "ordered" ? (orderPlacedAt ?? null) : null
  );

  if (orderStatus) {
    return (
      <OrderStatusBadge
        status={orderStatus}
        cancelCountdown={orderStatus === "ordered" && orderPlacedAt ? formatted : undefined}
      />
    );
  }

  if (onOrderThis) {
    return (
      <button
        onClick={() => onOrderThis(suggestionId)}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#04222a] hover:opacity-90 transition-opacity"
        style={{ background: CYAN }}
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        Order This
      </button>
    );
  }

  return null;
}

export function SuggestionCard({
  suggestion,
  isTopPick,
  onSelect,
  onDismiss,
  selecting,
  onOrderThis,
  orderStatus,
  orderPlacedAt,
  onBuyNow,
}: SuggestionCardProps) {
  const s = suggestion;
  const priceRange = `${dollars(s.estimatedPriceMinCents)} – ${dollars(s.estimatedPriceMaxCents)}`;
  const showTopPickRibbon = isTopPick && s.confidenceScore >= 0.8;

  return (
    <div
      role="listitem"
      aria-label={`Gift suggestion: ${s.title}, ${priceRange}, ${Math.round(s.confidenceScore * 100)} percent confidence`}
      className={`relative rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6 pb-5 transition-colors ${
        s.isSelected ? "ring-1 ring-[#22d3ee]/50" : ""
      } ${showTopPickRibbon ? "shadow-[0_30px_60px_-30px_rgba(255,194,75,0.35)]" : ""}`}
    >
      {showTopPickRibbon && (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: AMBER }}>
          &#10022; {VOICE.suggestions.topPick}
        </p>
      )}

      <div className="flex items-start justify-between gap-3.5">
        <h3 className="text-[19px] font-medium text-[#eef2fa] text-balance">{s.title}</h3>
        <span className="whitespace-nowrap text-[13px] tabular-nums text-[#7c85a0]">{priceRange}</span>
      </div>

      <div className="mt-4 mb-4 flex flex-wrap gap-5">
        <PrismStatRing value={s.confidenceScore} color={CYAN} label="Confidence" />
        <PrismStatRing value={s.delightScore} color={CORAL} label="Delight" />
        <PrismStatRing value={s.noveltyScore} color={AMBER} label="Novelty" />
      </div>

      <div className="flex gap-4.5">
        {s.imageUrl && (
          <a
            href={s.productUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <img
              src={s.imageUrl}
              alt={s.title}
              className="h-[88px] w-[88px] rounded-[20px] border border-white/10 bg-[#0e1220] object-cover"
              loading="lazy"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-[#b9c0d4]">{s.description}</p>
          {s.productSourcePriceCents && (
            <p className="mt-2 text-[12.5px] font-semibold" style={{ color: CYAN }}>
              Found for {dollars(s.productSourcePriceCents)} &middot; link verified
            </p>
          )}
          {s.productUrl && (
            <a
              href={s.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-[#7c85a0] hover:text-[#eef2fa] transition-colors"
            >
              View listing <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <blockquote className="mt-4.5 border-l border-[#22d3ee] pl-4 text-sm leading-relaxed text-[#b9c0d4]">
        {s.reasoning}
      </blockquote>

      {s.retailerHint && (
        <p className="mt-3.5 text-[11.5px] text-[#7c85a0]">Available at: {s.retailerHint}</p>
      )}

      <div className="mt-4.5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
        <button
          onClick={() => onDismiss(s.id)}
          disabled={s.isSelected}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#7c85a0] hover:text-[#b9c0d4] disabled:opacity-40 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Not this one
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {s.isSelected && onBuyNow && (
            <BuyNowButton
              suggestionId={s.id}
              retailerHint={s.retailerHint}
              onBuyNow={onBuyNow}
            />
          )}
          {s.isSelected && (
            <OrderActions
              suggestionId={s.id}
              orderStatus={orderStatus}
              orderPlacedAt={orderPlacedAt}
              onOrderThis={!orderStatus ? onOrderThis : undefined}
            />
          )}
          {!orderStatus && (
            <Button
              size="sm"
              disabled={s.isSelected || selecting}
              onClick={() => onSelect(s.id)}
              className="rounded-full border-0 bg-[#eef2fa] px-4 text-[12.5px] font-semibold text-[#0b0e14] hover:bg-white disabled:opacity-50"
            >
              {s.isSelected ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Selected
                </>
              ) : (
                "Select This Gift"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
