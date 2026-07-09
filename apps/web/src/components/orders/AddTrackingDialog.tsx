"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface AddTrackingDialogProps {
  orderId: string;
  token: string;
  currentTrackingNumber: string | null;
  currentCarrierName: string | null;
  currentStatus: string;
  onSaved: () => void;
}

const STATUS_OPTIONS = ["ordered", "processing", "shipped", "delivered"] as const;

export function AddTrackingDialog({
  orderId,
  token,
  currentTrackingNumber,
  currentCarrierName,
  currentStatus,
  onSaved,
}: AddTrackingDialogProps) {
  const [open, setOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber ?? "");
  const [carrierName, setCarrierName] = useState(currentCarrierName ?? "");
  const [status, setStatus] = useState<string>(
    STATUS_OPTIONS.includes(currentStatus as typeof STATUS_OPTIONS[number]) ? currentStatus : "shipped",
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!trackingNumber.trim()) return;
    setSaving(true);
    try {
      await api.updateOrderTracking(token, orderId, {
        trackingNumber: trackingNumber.trim(),
        carrierName: carrierName.trim() || undefined,
        status: status as typeof STATUS_OPTIONS[number],
      });
      onSaved();
      toast.success("Tracking updated.");
      setOpen(false);
    } catch {
      toast.error("Failed to update tracking. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {currentTrackingNumber ? "Edit tracking" : "Add tracking"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentTrackingNumber ? "Edit Tracking" : "Add Tracking"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-tracking-number">Tracking Number</Label>
              <Input
                id="edit-tracking-number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="1Z999AA10123456784"
              />
            </div>
            <div>
              <Label htmlFor="edit-carrier">Carrier (optional)</Label>
              <Input
                id="edit-carrier"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="UPS, USPS, FedEx..."
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? status)}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !trackingNumber.trim()}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
