"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ConfirmPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  giftRecordId: string;
  token: string;
  defaultPriceCents: number;
  onConfirmed: (priceCents: number) => void;
}

export function ConfirmPurchaseDialog({
  open,
  onOpenChange,
  giftRecordId,
  token,
  defaultPriceCents,
  onConfirmed,
}: ConfirmPurchaseDialogProps) {
  const [priceDollars, setPriceDollars] = useState(() => (defaultPriceCents / 100).toFixed(2));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const priceCents = Math.round(parseFloat(priceDollars) * 100);
    if (!priceDollars || Number.isNaN(priceCents) || priceCents < 0) return;

    setSaving(true);
    try {
      await api.confirmPurchase(token, giftRecordId, { priceCents });
      toast.success(VOICE.confirmPurchaseSuccess);
      onConfirmed(priceCents);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save that price. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{VOICE.confirmPurchaseTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{VOICE.confirmPurchaseBody}</p>
        <div>
          <Label htmlFor="confirm-purchase-price">Price</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="confirm-purchase-price"
              type="number"
              min="0"
              step="0.01"
              className="pl-7"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              aria-label="Price in dollars"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {VOICE.confirmPurchaseSkip}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {VOICE.confirmPurchaseCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
