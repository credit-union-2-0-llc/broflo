"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { BuyOption } from "@/lib/api";

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface BuyOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestionId: string;
  token: string;
  onOptionChosen: (option: BuyOption) => void;
}

export function BuyOptionsDialog({
  open,
  onOpenChange,
  suggestionId,
  token,
  onOptionChosen,
}: BuyOptionsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState<BuyOption[]>([]);
  const [error, setError] = useState(false);

  // Fresh mount each time it opens (the parent only renders this dialog
  // while a suggestionId is set), so the initial state above is already
  // correct — no need to reset it defensively here.
  useEffect(() => {
    if (!open) return;
    api
      .getBuyOptions(token, suggestionId)
      .then((res) => setOptions(res.options))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [open, suggestionId, token]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{VOICE.buyOptionsTitle}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber" />
            <p className="text-sm text-muted-foreground italic">{VOICE.buyOptionsLoading}</p>
          </div>
        )}

        {!loading && (error || options.length === 0) && (
          <div className="py-6 space-y-3">
            <p className="text-sm text-muted-foreground">{VOICE.buyOptionsEmpty}</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}

        {!loading && !error && options.length > 0 && (
          <div className="space-y-2">
            {options.map((option) => (
              <div
                key={option.url}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{option.retailer}</p>
                  <p className="text-sm text-muted-foreground">{dollars(option.priceCents)}</p>
                </div>
                <a
                  href={option.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOptionChosen(option)}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  Buy
                  <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
