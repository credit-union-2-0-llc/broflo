"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Gift, RefreshCw, Shuffle, Lock, Loader2, Sparkles } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { GiftSuggestion, SuggestionMetaResponse } from "@/lib/api";
import { SuggestionCard } from "./suggestion-card";

interface SuggestionsViewProps {
  eventId: string;
  personId: string;
  personName: string;
  token: string;
  tier: "free" | "pro" | "elite";
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

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % VOICE.suggestions.loading.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  // Load existing suggestions on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getEventSuggestions(token, eventId);
        if (res.suggestions.length > 0) {
          setSuggestions(res.suggestions);
          setHasGenerated(true);
        }
        const metaRes = await api.getSuggestionMeta(token, eventId);
        setMeta(metaRes);
      } catch {
        // No suggestions yet — that's fine
      }
    })();
  }, [token, eventId]);

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
      // Refresh meta
      const metaRes = await api.getSuggestionMeta(token, eventId);
      setMeta(metaRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : VOICE.errors.aiGeneric;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, personId, eventId, tier, surpriseFactor, guidanceText]);

  const handleSelect = async (suggestionId: string) => {
    setSelecting(true);
    try {
      await api.selectSuggestion(token, eventId, suggestionId);
      setSuggestions((prev) =>
        prev.map((s) => ({
          ...s,
          isSelected: s.id === suggestionId,
        })),
      );
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

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gift Ideas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12" aria-live="polite" aria-busy="true">
            <Loader2 className="h-8 w-8 animate-spin text-broflo-electric mb-4" />
            <p className="text-sm text-muted-foreground italic text-center">
              {VOICE.suggestions.loading[loadingMsgIdx]}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not yet generated
  if (!hasGenerated) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Gift Ideas for This Event</CardTitle>
          <Button variant="default" size="sm" className="gap-1.5" onClick={generate}>
            <Gift className="h-4 w-4" />
            Find Gift Ideas
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No suggestions yet. Click &ldquo;Find Gift Ideas&rdquo; to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canReroll = meta?.canReroll ?? false;
  const hasSelected = suggestions.some((s) => s.isSelected);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gift Ideas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Safe/Bold toggle */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              onClick={() => tier !== "free" && setSurpriseFactor("safe")}
              className={`px-3 py-1 ${surpriseFactor === "safe" ? "bg-primary text-primary-foreground" : "bg-background"} ${tier === "free" ? "opacity-50" : ""}`}
              disabled={tier === "free"}
            >
              Safe
            </button>
            <button
              onClick={() => tier !== "free" && setSurpriseFactor("bold")}
              className={`px-3 py-1 ${surpriseFactor === "bold" ? "bg-primary text-primary-foreground" : "bg-background"} ${tier === "free" ? "opacity-50" : ""}`}
              disabled={tier === "free"}
              aria-disabled={tier === "free"}
            >
              Bold
            </button>
          </div>
          {tier === "free" && (
            <span className="text-xs text-muted-foreground">{VOICE.upsell.boldMode}</span>
          )}

          {/* Surprise Me */}
          {!hasSelected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSurpriseMe}
              disabled={tier === "free" || suggestions.length === 0}
              className="gap-1"
            >
              {tier === "free" ? <Lock className="h-3.5 w-3.5" /> : <Shuffle className="h-3.5 w-3.5" />}
              Surprise Me
            </Button>
          )}

          {/* Regenerate */}
          {tier !== "free" && canReroll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGuidance(true)}
              className="gap-1 ml-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          )}
        </div>

        {/* Guidance input for re-roll */}
        {showGuidance && (
          <div className="flex gap-2">
            <Input
              placeholder="Any guidance? e.g. 'more experiential', 'under $50'"
              value={guidanceText}
              onChange={(e) => setGuidanceText(e.target.value)}
              maxLength={200}
              className="text-sm"
            />
            <Button size="sm" onClick={generate}>Go</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowGuidance(false); generate(); }}>
              Skip
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="ml-2" onClick={generate}>
              Try Again
            </Button>
          </div>
        )}

        {/* Suggestion cards */}
        {suggestions.length > 0 ? (
          <div className="space-y-3" role="list">
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                isTopPick={i === 0 && tier === "elite"}
                onSelect={handleSelect}
                onDismiss={handleDismiss}
                selecting={selecting}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {VOICE.suggestions.empty}
          </p>
        )}

        {/* Free tier upsell */}
        {tier === "free" && suggestions.length > 0 && (
          <Card className="border-broflo-electric/30 bg-gradient-to-r from-broflo-electric-subtle/50 to-transparent">
            <CardContent className="flex items-start gap-3 py-4">
              <Sparkles className="h-6 w-6 text-broflo-electric shrink-0" />
              <div>
                <p className="text-sm font-semibold">{VOICE.upsell.moreSuggestions}</p>
                <Button size="sm" className="mt-2 bg-broflo-electric hover:bg-broflo-electric-light text-white">
                  Upgrade to Pro – $9.99/mo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selected confirmation */}
        {hasSelected && (
          <p className="text-sm font-medium text-broflo-electric" aria-live="polite">
            {VOICE.suggestions.selected(personName)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
