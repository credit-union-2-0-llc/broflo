"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS: Record<number, string> = {
  1: "Missed the mark",
  2: "Meh",
  3: "Fine",
  4: "They liked it",
  5: "Loved it",
};

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  readonly?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  if (readonly) {
    return (
      <div
        className="flex items-center gap-0.5"
        aria-label={
          value ? `Rated ${value} out of 5 stars` : "Not yet rated"
        }
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              iconSize,
              star <= (value || 0)
                ? "text-amber fill-broflo-gold"
                : "text-muted-foreground",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Gift rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""} - ${LABELS[star]}`}
            className="p-1 rounded-md transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-amber"
            onClick={() => onChange?.(star)}
          >
            <Star
              className={cn(
                iconSize,
                star <= (value || 0)
                  ? "text-amber fill-broflo-gold"
                  : "text-muted-foreground hover:text-amber/60",
              )}
            />
          </button>
        ))}
      </div>
      {value && (
        <p className="text-xs text-muted-foreground mt-1">{LABELS[value]}</p>
      )}
    </div>
  );
}
