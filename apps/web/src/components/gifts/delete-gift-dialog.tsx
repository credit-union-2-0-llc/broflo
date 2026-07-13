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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

interface DeleteGiftDialogProps {
  giftId: string;
  giftTitle: string;
  hasRealOrder: boolean;
  token: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteGiftDialog({
  giftId,
  giftTitle,
  hasRealOrder,
  token,
  open,
  onOpenChange,
  onDeleted,
}: DeleteGiftDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    try {
      await api.deleteGift(token, giftId);
      toast.success("Gift removed from history.");
      onDeleted();
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this gift?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{giftTitle}&rdquo; will be removed from gift history. This
            can&apos;t be undone.
            {hasRealOrder &&
              " The actual order and its tracking info are unaffected — only this history entry goes away."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} autoFocus>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
            {submitting ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
