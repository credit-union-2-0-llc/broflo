"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useCancelCountdown } from "@/hooks/use-cancel-countdown";
import { CancelDialog } from "./cancel-dialog";

interface CancelCountdownProps {
  orderId: string;
  placedAt: string;
  token: string;
  onCancelled: () => void;
}

export function CancelCountdown({
  orderId,
  placedAt,
  token,
  onCancelled,
}: CancelCountdownProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { canCancel, formatted } = useCancelCountdown(placedAt);

  if (!canCancel) return null;

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setDialogOpen(true)}
      >
        <XCircle className="mr-1 h-3.5 w-3.5" />
        Cancel ({formatted})
      </Button>
      <CancelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orderId={orderId}
        token={token}
        onCancelled={onCancelled}
      />
    </>
  );
}
