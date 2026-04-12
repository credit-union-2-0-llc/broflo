"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ThumbsUp } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { GiftRecord } from "@/lib/api";
import { StarRating } from "./star-rating";
import { FeedbackDialog } from "./feedback-dialog";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { useCancelCountdown } from "@/hooks/use-cancel-countdown";
import { toast } from "sonner";

type RecentGift = GiftRecord & { personName: string; eventName: string | null };

interface RecentGiftsWidgetProps {
  token: string;
}

function GiftOrderBadge({ placedAt }: { placedAt: string }) {
  const { canCancel, formatted } = useCancelCountdown(placedAt);
  if (!canCancel) return null;
  return <OrderStatusBadge status="ordered" cancelCountdown={formatted} />;
}

export function RecentGiftsWidget({ token }: RecentGiftsWidgetProps) {
  const [gifts, setGifts] = useState<RecentGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackGift, setFeedbackGift] = useState<RecentGift | null>(null);
  const [recentOrders, setRecentOrders] = useState<Map<string, { status: string; placedAt: string }>>(new Map());

  useEffect(() => {
    api
      .getRecentGifts(token)
      .then((res) => setGifts(res.gifts as RecentGift[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    api
      .getOrders(token, { limit: 10, status: "ordered" })
      .then((res) => {
        const orderMap = new Map<string, { status: string; placedAt: string }>();
        for (const order of res.data) {
          if (order.giftRecordId) {
            orderMap.set(order.giftRecordId, {
              status: order.status,
              placedAt: order.placedAt ?? order.createdAt,
            });
          }
        }
        setRecentOrders(orderMap);
      })
      .catch(() => {});
  }, [token]);

  async function handleNailedIt(gift: RecentGift) {
    try {
      const result = await api.recordFeedback(token, gift.id, {
        rating: 5,
        note: "Nailed it",
      });
      toast.success(VOICE.gifts.nailedIt);
      setGifts((prev) =>
        prev.map((g) =>
          g.id === gift.id ? { ...result.giftRecord, personName: gift.personName, eventName: gift.eventName } as RecentGift : g,
        ),
      );
    } catch {
      toast.error("Failed to save. Try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Gifts</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : gifts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {VOICE.emptyStates.recentGifts}
          </p>
        ) : (
          <div className="space-y-1">
            {gifts.map((gift) => (
              <div
                key={gift.id}
                className="flex items-center gap-3 py-2"
              >
                <StarRating value={gift.rating} size="sm" readonly />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {gift.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {gift.personName} &middot;{" "}
                    {new Date(gift.givenAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {recentOrders.get(gift.id) && (
                  <GiftOrderBadge placedAt={recentOrders.get(gift.id)!.placedAt} />
                )}
                {!gift.rating && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleNailedIt(gift)}
                      aria-label="Rate this gift 5 stars - nailed it"
                    >
                      <ThumbsUp className="mr-1 h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setFeedbackGift(gift)}
                      aria-label="Rate this gift"
                    >
                      <Star className="mr-1 h-3 w-3" />
                      Rate
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {feedbackGift && (
          <FeedbackDialog
            gift={feedbackGift}
            personName={feedbackGift.personName}
            token={token}
            open={!!feedbackGift}
            onOpenChange={(open) => !open && setFeedbackGift(null)}
            onSaved={(result) => {
              setGifts((prev) =>
                prev.map((g) =>
                  g.id === result.giftRecord.id
                    ? { ...result.giftRecord, personName: (g as RecentGift).personName, eventName: (g as RecentGift).eventName } as RecentGift
                    : g,
                ),
              );
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
