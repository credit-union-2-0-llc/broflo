"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { BrofloEvent, CreateGiftResponse } from "@/lib/api";
import { toast } from "sonner";

interface AddGiftDialogProps {
  personId: string;
  personName: string;
  events: BrofloEvent[];
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: CreateGiftResponse) => void;
}

export function AddGiftDialog({
  personId,
  personName,
  events,
  token,
  open,
  onOpenChange,
  onCreated,
}: AddGiftDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [givenAt, setGivenAt] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addTracking, setAddTracking] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierName, setCarrierName] = useState("");

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "What did you give them?";
    if (!givenAt) e.givenAt = "When did you give it?";
    if (addTracking && !trackingNumber.trim()) e.trackingNumber = "Enter a tracking number, or uncheck this";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const priceCents = priceDollars
        ? Math.round(parseFloat(priceDollars) * 100)
        : undefined;
      const result = await api.createGift(token, personId, {
        title: title.trim(),
        description: description.trim() || undefined,
        priceCents,
        eventId: eventId || undefined,
        givenAt,
      });

      if (addTracking && trackingNumber.trim()) {
        try {
          await api.createManualOrder(token, {
            personId,
            productTitle: title.trim(),
            giftRecordId: result.giftRecord.id,
            priceCents,
            trackingNumber: trackingNumber.trim(),
            carrierName: carrierName.trim() || undefined,
            status: "shipped",
          });
        } catch {
          // Gift was already logged successfully — tracking is a bonus, don't
          // block or roll back the gift record over it.
          toast.error("Gift logged, but tracking couldn't be added. Add it later from Orders.");
        }
      }

      toast.success(VOICE.gifts.recorded);
      onCreated(result);
      onOpenChange(false);
      // Reset form
      setTitle("");
      setDescription("");
      setPriceDollars("");
      setGivenAt("");
      setEventId("");
      setAddTracking(false);
      setTrackingNumber("");
      setCarrierName("");
    } catch {
      toast.error("Failed to log gift. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Gift</DialogTitle>
        </DialogHeader>
        <form
          aria-label={`Log a gift you gave to ${personName}`}
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">For: {personName}</p>

          <div>
            <Label htmlFor="gift-title">What did you give them? *</Label>
            <Input
              id="gift-title"
              placeholder="Handmade photo album, concert tickets..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              aria-required="true"
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <Label htmlFor="gift-price">Price (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="gift-price"
                type="number"
                min="0"
                step="0.01"
                className="pl-7"
                placeholder="35"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                aria-label="Price in dollars"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="gift-date">When? *</Label>
            <Input
              id="gift-date"
              type="date"
              value={givenAt}
              onChange={(e) => setGivenAt(e.target.value)}
              aria-required="true"
            />
            {errors.givenAt && (
              <p className="text-xs text-destructive mt-1">{errors.givenAt}</p>
            )}
          </div>

          {events.length > 0 && (
            <div>
              <Label>Event (optional)</Label>
              <Select
                value={eventId}
                onValueChange={(val) => setEventId(val ?? "")}
              >
                <SelectTrigger aria-label="Link to an event (optional)">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="gift-note">Note (optional)</Label>
            <Textarea
              id="gift-note"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="Made from vacation photos"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={addTracking}
                onChange={(e) => setAddTracking(e.target.checked)}
              />
              I already ordered this — add tracking
            </label>
            {addTracking && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="tracking-number">Tracking Number</Label>
                  <Input
                    id="tracking-number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="1Z999AA10123456784"
                  />
                  {errors.trackingNumber && (
                    <p className="text-xs text-destructive mt-1">{errors.trackingNumber}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="carrier-name">Carrier (optional)</Label>
                  <Input
                    id="carrier-name"
                    value={carrierName}
                    onChange={(e) => setCarrierName(e.target.value)}
                    placeholder="UPS, USPS, FedEx..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Logging..." : "Log Gift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
