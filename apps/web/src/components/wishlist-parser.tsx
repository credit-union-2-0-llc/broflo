"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api";
import type { WishlistItem } from "@broflo/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WishlistParserProps {
  personId: string;
  wishlistUrls: string | null;
  initialItems: WishlistItem[];
}

export function WishlistParser({
  personId,
  wishlistUrls,
  initialItems,
}: WishlistParserProps) {
  const { data: session } = useSession();
  const [items, setItems] = useState<WishlistItem[]>(initialItems);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResults, setParseResults] = useState<string | null>(null);

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
      setItems(result.persisted);
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

  async function handleDismiss(itemId: string) {
    if (!session?.accessToken) return;
    try {
      await api.deleteWishlistItem(session.accessToken, personId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // silently fail
    }
  }

  if (urls.length === 0 && items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Wishlist Items
        </h3>
        {urls.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleParse}
            disabled={parsing}
          >
            {parsing ? "Parsing..." : "Parse Wishlist URLs"}
          </Button>
        )}
      </div>

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
