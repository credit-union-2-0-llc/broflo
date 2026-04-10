"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

interface NeverAgainDialogProps {
  giftTitle: string;
  personId: string;
  personName: string;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}

export function NeverAgainDialog({
  giftTitle,
  personId,
  personName,
  token,
  open,
  onOpenChange,
  onConfirmed,
}: NeverAgainDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleBan() {
    setSubmitting(true);
    try {
      await api.addNeverAgain(token, personId, giftTitle);
      toast.success(VOICE.gifts.neverAgainConfirm);
      onConfirmed();
      onOpenChange(false);
    } catch {
      toast.error("Failed to add to never-again list. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Never suggest this again?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{giftTitle}&rdquo; will be added to {personName}&apos;s
            never-again list. We&apos;ll make sure nothing like it shows up in
            future suggestions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            autoFocus
          >
            Keep It
          </Button>
          <Button
            variant="destructive"
            onClick={handleBan}
            disabled={submitting}
          >
            {submitting ? "Banning..." : "Ban It Forever"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
