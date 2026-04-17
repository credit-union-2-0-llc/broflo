"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, ShoppingBag, ExternalLink } from "lucide-react";
import { VOICE } from "@broflo/shared";
import type { GiftSuggestion } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useCancelCountdown } from "@/hooks/use-cancel-countdown";

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function confidenceColor(score: number) {
  if (score >= 0.8) return "bg-green-bright";
  if (score >= 0.5) return "bg-amber-400";
  return "bg-gray-300";
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
      <Button
        variant="default"
        size="sm"
        className="bg-green-bright hover:bg-green-bright/80"
        onClick={() => onOrderThis(suggestionId)}
      >
        <ShoppingBag className="mr-1 h-3.5 w-3.5" />
        Order This
      </Button>
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
}: SuggestionCardProps) {
  const s = suggestion;
  const priceRange = `${dollars(s.estimatedPriceMinCents)} – ${dollars(s.estimatedPriceMaxCents)}`;

  return (
    <Card
      className={`transition-shadow hover:border-border-3 ${
        s.isSelected
          ? "ring-2 ring-amber bg-amber-glow"
          : ""
      }`}
      role="listitem"
      aria-label={`Gift suggestion: ${s.title}, ${priceRange}, ${Math.round(s.confidenceScore * 100)} percent confidence`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${confidenceColor(s.confidenceScore)}`}
              aria-label={s.confidenceScore >= 0.8 ? "Strong match" : s.confidenceScore >= 0.5 ? "Good match" : "Fair match"}
            />
            <CardTitle className="text-base font-semibold">{s.title}</CardTitle>
          </div>
          <span className="font-mono text-sm text-muted-foreground shrink-0">
            {priceRange}
          </span>
        </div>
        {isTopPick && s.confidenceScore >= 0.8 && (
          <Badge className="bg-amber-glow text-amber text-xs w-fit">
            {VOICE.suggestions.topPick}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {s.imageUrl && (
          <div className="flex gap-3">
            <a
              href={s.productUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={s.imageUrl}
                alt={s.title}
                className="h-20 w-20 rounded-md object-cover border border-border"
                loading="lazy"
              />
            </a>
            <div className="space-y-1 min-w-0">
              <p className="text-sm text-foreground">{s.description}</p>
              {s.productSourcePriceCents && (
                <p className="text-xs font-medium text-green-bright">
                  Found for {dollars(s.productSourcePriceCents)}
                </p>
              )}
              {s.productUrl && (
                <a
                  href={s.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View product <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
        {!s.imageUrl && (
          <p className="text-sm text-foreground">{s.description}</p>
        )}

        <blockquote className="text-sm italic text-muted-foreground border-l-2 border-amber-3 pl-3">
          {s.reasoning}
        </blockquote>

        {s.retailerHint && (
          <p className="text-xs text-muted-foreground">
            Available at: {s.retailerHint}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(s.id)}
            disabled={s.isSelected}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Not this one
          </Button>
          <div className="flex items-center gap-2">
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
                variant="default"
                size="sm"
                onClick={() => onSelect(s.id)}
                disabled={s.isSelected || selecting}
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
      </CardContent>
    </Card>
  );
}
