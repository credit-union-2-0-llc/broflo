"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  token: string;
  onCancelled: () => void;
}

export function CancelDialog({
  open,
  onOpenChange,
  orderId,
  token,
  onCancelled,
}: CancelDialogProps) {
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.cancelOrder(token, orderId);
      toast.success(VOICE.orderCancel);
      onCancelled();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE.errors.generic);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{VOICE.orderCancelConfirm}</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone once the cancel window closes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cancelling}
          >
            {VOICE.orderCancelKeep}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              VOICE.orderCancelConfirmAction
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
