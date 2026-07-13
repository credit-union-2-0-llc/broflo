"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import type { WishlistItem } from "@broflo/shared";
import type { BrofloEvent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_GIFT_LIST_ITEMS = 20;

interface WishlistParserProps {
  personId: string;
  wishlistUrls: string | null;
  initialItems: WishlistItem[];
  personEvents: BrofloEvent[];
}

export function WishlistParser({
  personId,
  wishlistUrls,
  initialItems,
  personEvents,
}: WishlistParserProps) {
  const { data: session } = useSession();
  const [items, setItems] = useState<WishlistItem[]>(initialItems);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResults, setParseResults] = useState<string | null>(null);

  const [eventId, setEventId] = useState("");
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<string | null>(null);

  const urls = (wishlistUrls || "")
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("https://"));

  async function handleParse() {
    if (!session?.accessToken || urls.length === 0) return;
    setParsing(true);
    setError(null);
    setParseResults(null);

    try {
      const result = await api.parseWishlist(
        session.accessToken,
        personId,
        urls.slice(0, 5),
      );
      setItems((prev) => [...result.persisted, ...prev]);
      const count = result.persisted.length;
      setParseResults(
        count > 0
          ? `Found ${count} item${count !== 1 ? "s" : ""}`
          : "No products found. Try pasting direct product URLs.",
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setError("Wishlist parsing requires a Pro or Elite subscription.");
      } else {
        setError("Failed to parse wishlist URLs. Try again.");
      }
    } finally {
      setParsing(false);
    }
  }

  async function handleImportGiftList() {
    if (!session?.accessToken || !eventId || !rawText.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportResults(null);

    try {
      const result = await api.importGiftList(session.accessToken, personId, {
        eventId,
        rawText,
      });
      setItems((prev) => [...result.items, ...prev]);
      const found = result.totalRequested - result.notFoundCount;
      const notes = [VOICE.giftList.results(found, result.totalRequested)];
      if (result.truncated) notes.push(VOICE.giftList.truncatedNotice(MAX_GIFT_LIST_ITEMS));
      notes.push(VOICE.giftList.savedNote);
      setImportResults(notes.join(" "));
      setRawText("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        setImportError("Importing a gift list requires a Pro or Elite subscription.");
      } else {
        setImportError("Couldn't import that list. Try again.");
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleDismiss(itemId: string) {
    if (!session?.accessToken) return;
    try {
      await api.deleteWishlistItem(session.accessToken, personId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // silently fail
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground">
          {VOICE.giftList.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {VOICE.giftList.subtitle}
        </p>
      </div>

      {personEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{VOICE.giftList.noEvents}</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {VOICE.giftList.eventLabel}
            </label>
            <Select value={eventId} onValueChange={(v) => setEventId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={VOICE.giftList.eventPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {personEvents.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={VOICE.giftList.textareaPlaceholder}
            rows={4}
            className="text-sm"
          />

          <Button
            size="sm"
            onClick={handleImportGiftList}
            disabled={!eventId || !rawText.trim() || importing}
          >
            {importing ? VOICE.giftList.submitting : VOICE.giftList.submitCta}
          </Button>

          {importError && <p className="text-xs text-destructive">{importError}</p>}
          {importResults && !importError && (
            <p className="text-xs text-muted-foreground">{importResults}</p>
          )}
        </div>
      )}

      {urls.length > 0 && (
        <div className="flex items-center justify-between pt-1 border-t">
          <p className="text-xs text-muted-foreground pt-3">Have wishlist URLs on file instead?</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={handleParse}
            disabled={parsing}
          >
            {parsing ? "Parsing..." : "Parse Wishlist URLs"}
          </Button>
        </div>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {parseResults && !error && (
        <p className="text-xs text-muted-foreground">{parseResults}</p>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-dashed">
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.productName || "Unknown product"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {item.brand && <span>{item.brand}</span>}
                    {item.brand && item.category && <span>&middot;</span>}
                    {item.category && <span>{item.category}</span>}
                    {item.priceRange && (
                      <>
                        <span>&middot;</span>
                        <span>{item.priceRange}</span>
                      </>
                    )}
                    {item.sourceUrl && (
                      <>
                        <span>&middot;</span>
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          View
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDismiss(item.id)}
                >
                  &#x2715;
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
