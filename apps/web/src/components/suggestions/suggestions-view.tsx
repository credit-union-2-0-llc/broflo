"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Gift, RefreshCw, Shuffle, Lock, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { VOICE, tierAtLeast } from "@broflo/shared";
import { api } from "@/lib/api";
import type { GiftSuggestion, SuggestionMetaResponse, Order, BuyOption } from "@/lib/api";
import { SuggestionCard } from "./suggestion-card";
import { GuidedInterview } from "./guided-interview";
import { OrderPreviewModal } from "@/components/orders/order-preview-modal";
import { CancelCountdown } from "@/components/orders/cancel-countdown";
import { ConfirmPurchaseDialog } from "./confirm-purchase-dialog";
import { BuyOptionsDialog } from "./buy-options-dialog";

const CYAN = "#22d3ee";
const CORAL = "#ff8fa3";
const AMBER = "#ffc24b";

interface SuggestionsViewProps {
  eventId: string;
  personId: string;
  personName: string;
  token: string;
  tier: "free" | "pro" | "elite" | "family";
}

export function SuggestionsView({
  eventId,
  personId,
  personName,
  token,
  tier,
}: SuggestionsViewProps) {
  const [suggestions, setSuggestions] = useState<GiftSuggestion[]>([]);
  const [meta, setMeta] = useState<SuggestionMetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [surpriseFactor, setSurpriseFactor] = useState<"safe" | "bold">("safe");
  const [guidanceText, setGuidanceText] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [interviewChecked, setInterviewChecked] = useState(false);

  // Order modal state
  const [orderingSuggestionId, setOrderingSuggestionId] = useState<string | null>(null);
  const [orderedSuggestions, setOrderedSuggestions] = useState<Map<string, { orderId: string; status: string; placedAt: string }>>(new Map());
  // Map from suggestionId -> giftRecordId (set when suggestion is selected)
  const [suggestionGiftRecordIds, setSuggestionGiftRecordIds] = useState<Map<string, string>>(new Map());
  const [buyOptionsSuggestionId, setBuyOptionsSuggestionId] = useState<string | null>(null);
  const [confirmingPurchase, setConfirmingPurchase] = useState<{ suggestionId: string; priceCents: number } | null>(null);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % VOICE.suggestions.loading.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // Load existing suggestions + check dossier completeness on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getEventSuggestions(token, eventId);
        if (res.suggestions.length > 0) {
          setSuggestions(res.suggestions);
          setHasGenerated(true);
          setSuggestionGiftRecordIds((prev) => {
            const next = new Map(prev);
            for (const s of res.suggestions) {
              if (s.giftRecordId) next.set(s.id, s.giftRecordId);
            }
            return next;
          });
        }
        const metaRes = await api.getSuggestionMeta(token, eventId);
        setMeta(metaRes);
      } catch {
        // No suggestions yet — that's fine
      }
      try {
        const person = await api.getPerson(token, personId);
        if (person.completenessScore < 40) {
          setShowInterview(true);
        }
      } catch {
        // Non-critical — skip interview check
      }
      setInterviewChecked(true);
    })();
  }, [token, eventId, personId]);

  // Product images are enriched server-side AFTER generate returns (so the Exa
  // lookup doesn't block generation). Poll getEventSuggestions briefly to patch
  // images in as they land. A monotonic token cancels a stale poll when a new
  // generate/re-roll starts or the component unmounts.
  const imagePollRef = useRef(0);
  useEffect(() => () => { imagePollRef.current++; }, []);

  const pollForImages = useCallback(
    (targetEventId: string) => {
      const pollId = ++imagePollRef.current;
      let attempts = 0;
      const tick = async () => {
        if (pollId !== imagePollRef.current) return; // superseded
        attempts++;
        try {
          const res = await api.getEventSuggestions(token, targetEventId);
          if (pollId !== imagePollRef.current) return;
          const byId = new Map(res.suggestions.map((s) => [s.id, s]));
          setSuggestions((prev) =>
            prev.map((s) => {
              const fresh = byId.get(s.id);
              if (fresh && (fresh.imageUrl || fresh.productUrl)) {
                return {
                  ...s,
                  imageUrl: fresh.imageUrl,
                  productUrl: fresh.productUrl,
                  productSourcePriceCents: fresh.productSourcePriceCents,
                };
              }
              return s;
            }),
          );
          const allEnriched =
            res.suggestions.length > 0 &&
            res.suggestions.every((s) => s.imageUrl || s.productUrl);
          if (!allEnriched && attempts < 5) {
            setTimeout(tick, 1500);
          }
        } catch {
          if (attempts < 5) setTimeout(tick, 1500);
        }
      };
      // Small initial delay to let the async enrichment start.
      setTimeout(tick, 1200);
    },
    [token],
  );

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMsgIdx(0);
    try {
      const res = await api.generateSuggestions(token, {
        personId,
        eventId,
        surpriseFactor: tier === "free" ? "safe" : surpriseFactor,
        guidanceText: tier !== "free" && guidanceText ? guidanceText : undefined,
      });
      setSuggestions(res.suggestions);
      setHasGenerated(true);
      setShowGuidance(false);
      setGuidanceText("");
      // Images arrive asynchronously — poll them in.
      if (res.suggestions.some((s) => !s.imageUrl)) {
        pollForImages(eventId);
      }
      // Refresh meta
      const metaRes = await api.getSuggestionMeta(token, eventId);
      setMeta(metaRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : VOICE.errors.aiGeneric;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, personId, eventId, tier, surpriseFactor, guidanceText, pollForImages]);

  const handleSelect = async (suggestionId: string) => {
    setSelecting(true);
    try {
      const res = await api.selectSuggestion(token, eventId, suggestionId);
      setSuggestions((prev) =>
        prev.map((s) => ({
          ...s,
          isSelected: s.id === suggestionId,
        })),
      );
      // Capture giftRecordId so OrderPreviewModal can pass it to the place endpoint
      if (res.giftRecord && typeof res.giftRecord === "object" && "id" in res.giftRecord) {
        setSuggestionGiftRecordIds((prev) => {
          const next = new Map(prev);
          next.set(suggestionId, String(res.giftRecord.id));
          return next;
        });
      }
    } catch {
      setError(VOICE.errors.generic);
    } finally {
      setSelecting(false);
    }
  };

  const handleDismiss = async (suggestionId: string) => {
    try {
      await api.dismissSuggestion(token, suggestionId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
    } catch {
      setError(VOICE.errors.generic);
    }
  };

  const handleSurpriseMe = async () => {
    if (suggestions.length === 0) return;
    const top = [...suggestions].sort((a, b) => b.confidenceScore - a.confidenceScore)[0];
    await handleSelect(top.id);
  };

  function handleOrderThis(suggestionId: string) {
    setOrderingSuggestionId(suggestionId);
  }

  function handleBuyNow(suggestionId: string) {
    // No need to check suggestionGiftRecordIds here — the options dialog
    // only needs the suggestionId. That map is only used later, for the
    // optional "confirm what you paid" step, which already handles a
    // missing entry gracefully (e.g. after a page reload, since it's local
    // state populated only by this session's own "Select" click).
    setBuyOptionsSuggestionId(suggestionId);
  }

  function handleOptionChosen(option: BuyOption) {
    if (!buyOptionsSuggestionId) return;
    setBuyOptionsSuggestionId(null);
    setConfirmingPurchase({ suggestionId: buyOptionsSuggestionId, priceCents: option.priceCents });
  }

  function handleOrderPlaced(order: Order) {
    setOrderingSuggestionId(null);
    toast.success(VOICE.orderSuccess);
    setOrderedSuggestions((prev) => {
      const next = new Map(prev);
      next.set(order.suggestionId ?? "", {
        orderId: order.id,
        status: order.status,
        placedAt: order.placedAt ?? new Date().toISOString(),
      });
      return next;
    });
  }

  function handleCancelCompleted(suggestionId: string) {
    setOrderedSuggestions((prev) => {
      const next = new Map(prev);
      next.delete(suggestionId);
      return next;
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6">
        <h2 className="text-base font-medium text-[#eef2fa]">Gift Ideas</h2>
        <div className="flex flex-col items-center justify-center py-12" aria-live="polite" aria-busy="true">
          <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: CYAN }} />
          <p className="text-sm italic text-center text-[#7c85a0]">
            {VOICE.suggestions.loading[loadingMsgIdx]}
          </p>
        </div>
      </div>
    );
  }

  // Not yet generated — show interview or generate button
  if (!hasGenerated) {
    if (interviewChecked && showInterview) {
      return (
        <GuidedInterview
          personId={personId}
          personName={personName}
          token={token}
          onComplete={() => {
            setShowInterview(false);
            generate();
          }}
          onSkip={() => {
            setShowInterview(false);
            generate();
          }}
        />
      );
    }
    return (
      <div className="rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-medium text-[#eef2fa]">Gift Ideas for This Event</h2>
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#04222a] hover:opacity-90 transition-opacity"
            style={{ background: CYAN }}
          >
            <Gift className="h-4 w-4" />
            Find Gift Ideas
          </button>
        </div>
        <p className="mt-3 text-sm text-[#7c85a0]">
          No suggestions yet. Click &ldquo;Find Gift Ideas&rdquo; to get started.
        </p>
        {error && (
          <div className="mt-3 text-sm" style={{ color: CORAL }}>
            {error}
            <button
              onClick={generate}
              className="ml-2 rounded-full border border-white/10 px-3 py-1 text-[12.5px] text-[#b9c0d4] hover:border-white/20"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  const canReroll = meta?.canReroll ?? false;
  const hasSelected = suggestions.some((s) => s.isSelected);

  return (
    <>
    <div className="rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6">
      <h2 className="text-base font-medium text-[#eef2fa]">Gift Ideas</h2>

      <div className="mt-4 space-y-4">
        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Safe/Bold toggle */}
          <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm">
            <button
              onClick={() => tier !== "free" && setSurpriseFactor("safe")}
              className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                surpriseFactor === "safe" ? "bg-[#eef2fa] text-[#0b0e14] font-semibold" : "text-[#7c85a0]"
              } ${tier === "free" ? "opacity-50" : ""}`}
              disabled={tier === "free"}
            >
              Safe
            </button>
            <button
              onClick={() => tier !== "free" && setSurpriseFactor("bold")}
              className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                surpriseFactor === "bold" ? "bg-[#eef2fa] text-[#0b0e14] font-semibold" : "text-[#7c85a0]"
              } ${tier === "free" ? "opacity-50" : ""}`}
              disabled={tier === "free"}
              aria-disabled={tier === "free"}
            >
              Bold
            </button>
          </div>
          {tier === "free" && (
            <span className="text-xs text-[#7c85a0]">{VOICE.upsell.boldMode}</span>
          )}

          {/* Surprise Me */}
          {!hasSelected && (
            <button
              onClick={handleSurpriseMe}
              disabled={tier === "free" || suggestions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[12.5px] text-[#b9c0d4] hover:border-white/20 disabled:opacity-40 transition-colors"
            >
              {tier === "free" ? <Lock className="h-3.5 w-3.5" /> : <Shuffle className="h-3.5 w-3.5" />}
              Surprise Me
            </button>
          )}

          {/* Regenerate */}
          {tier !== "free" && canReroll && (
            <button
              onClick={() => setShowGuidance(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-[#7c85a0] hover:text-[#b9c0d4] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </button>
          )}
        </div>

        {/* Guidance input for re-roll */}
        {showGuidance && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Any guidance? e.g. 'more experiential', 'under $50'"
              value={guidanceText}
              onChange={(e) => setGuidanceText(e.target.value)}
              maxLength={200}
              className="border-white/10 bg-white/[0.04] text-sm text-[#eef2fa] placeholder:text-[#7c85a0]"
            />
            <div className="flex gap-2 shrink-0">
              <button
                onClick={generate}
                className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[#04222a]"
                style={{ background: CYAN }}
              >
                Go
              </button>
              <button
                onClick={() => { setShowGuidance(false); generate(); }}
                className="rounded-full px-4 py-2 text-[12.5px] text-[#7c85a0] hover:text-[#b9c0d4]"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm" style={{ color: CORAL }}>
            {error}
            <button
              onClick={generate}
              className="ml-2 rounded-full border border-white/10 px-3 py-1 text-[12.5px] text-[#b9c0d4] hover:border-white/20"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Suggestion cards */}
        {suggestions.length > 0 ? (
          <div className="space-y-4" role="list">
            {suggestions.map((s, i) => {
              const orderInfo = orderedSuggestions.get(s.id);
              return (
                <div key={s.id}>
                  <SuggestionCard
                    suggestion={s}
                    isTopPick={i === 0 && tierAtLeast(tier, "elite")}
                    onSelect={handleSelect}
                    onDismiss={handleDismiss}
                    selecting={selecting}
                    onOrderThis={tier !== "free" ? handleOrderThis : undefined}
                    orderStatus={orderInfo?.status ?? null}
                    orderPlacedAt={orderInfo?.placedAt ?? null}
                    onBuyNow={handleBuyNow}
                  />
                  {orderInfo?.status === "ordered" && orderInfo.placedAt && (
                    <div className="mt-1 flex justify-end">
                      <CancelCountdown
                        orderId={orderInfo.orderId}
                        placedAt={orderInfo.placedAt}
                        token={token}
                        onCancelled={() => handleCancelCompleted(s.id)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm italic text-[#7c85a0]">
            {VOICE.suggestions.empty}
          </p>
        )}

        {/* Free tier upsell */}
        {tier === "free" && suggestions.length > 0 && (
          <div className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
            <Sparkles className="h-6 w-6 shrink-0" style={{ color: AMBER }} />
            <div>
              <p className="text-sm font-semibold text-[#eef2fa]">{VOICE.upsell.moreSuggestions}</p>
              <button
                className="mt-2 rounded-full px-4 py-1.5 text-[12.5px] font-semibold text-[#04222a]"
                style={{ background: AMBER }}
              >
                Upgrade to Pro – $9.99/mo
              </button>
            </div>
          </div>
        )}

        {/* Selected confirmation */}
        {hasSelected && (
          <p className="text-sm font-medium" style={{ color: CYAN }} aria-live="polite">
            {VOICE.suggestions.selected(personName)}
          </p>
        )}
      </div>
    </div>

    {orderingSuggestionId && (
      <OrderPreviewModal
        open={!!orderingSuggestionId}
        onOpenChange={(open) => { if (!open) setOrderingSuggestionId(null); }}
        suggestionId={orderingSuggestionId}
        personId={personId}
        eventId={eventId}
        giftRecordId={suggestionGiftRecordIds.get(orderingSuggestionId)}
        token={token}
        onOrderPlaced={handleOrderPlaced}
      />
    )}

    {buyOptionsSuggestionId && (
      <BuyOptionsDialog
        open={!!buyOptionsSuggestionId}
        onOpenChange={(open) => { if (!open) setBuyOptionsSuggestionId(null); }}
        suggestionId={buyOptionsSuggestionId}
        token={token}
        onOptionChosen={handleOptionChosen}
      />
    )}

    {confirmingPurchase && (() => {
      const confirmingGiftRecordId = suggestionGiftRecordIds.get(confirmingPurchase.suggestionId);
      if (!confirmingGiftRecordId) return null;
      return (
        <ConfirmPurchaseDialog
          open={!!confirmingPurchase}
          onOpenChange={(open) => { if (!open) setConfirmingPurchase(null); }}
          giftRecordId={confirmingGiftRecordId}
          token={token}
          defaultPriceCents={confirmingPurchase.priceCents}
          onConfirmed={() => setConfirmingPurchase(null)}
        />
      );
    })()}
  </>
  );
}
