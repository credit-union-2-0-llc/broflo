"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { GiftRecord, FeedbackResponse } from "@/lib/api";
import { StarRating } from "./star-rating";
import { toast } from "sonner";

interface FeedbackDialogProps {
  gift: GiftRecord;
  personName: string;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (result: FeedbackResponse) => void;
}

export function FeedbackDialog({
  gift,
  personName,
  token,
  open,
  onOpenChange,
  onSaved,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<number | null>(gift.rating);
  const [note, setNote] = useState(gift.feedbackNote || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!rating) return;
    setSaving(true);
    try {
      const result = await api.recordFeedback(token, gift.id, {
        rating,
        note: note.trim() || undefined,
      });
      toast.success(VOICE.gifts.feedbackThanks);
      onSaved(result);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save feedback. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Gift</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">{gift.title}</p>
            <p className="text-xs text-muted-foreground">
              For {personName}
              {gift.givenAt &&
                ` \u00b7 ${new Date(gift.givenAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`}
            </p>
          </div>

          <div>
            <p className="text-sm mb-2">How did it land?</p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <div>
            <Textarea
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              aria-label="Optional feedback note"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Skip
            </Button>
            <Button
              onClick={handleSave}
              disabled={!rating || saving}
            >
              {saving ? "Saving..." : "Save Feedback"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
