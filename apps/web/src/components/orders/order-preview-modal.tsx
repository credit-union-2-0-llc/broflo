"use client";

import { useState, useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { Order, OrderPreviewResponse } from "@/lib/api";

function dollars(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

function estimatedDeliveryLabel(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return "Arrives by " + date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

interface OrderPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestionId: string;
  personId: string;
  eventId: string;
  giftRecordId?: string;
  token: string;
  onOrderPlaced: (order: Order) => void;
}

export function OrderPreviewModal({
  open,
  onOpenChange,
  suggestionId,
  personId,
  eventId,
  giftRecordId,
  token,
  onOrderPlaced,
}: OrderPreviewModalProps) {
  const [preview, setPreview] = useState<OrderPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shipping address form state
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZip, setShippingZip] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    api
      .previewOrder(token, { suggestionId, personId, eventId })
      .then((data) => {
        setPreview(data);
        setShippingName(data.person.name);
        setShippingAddress1(data.person.shippingAddress1 ?? "");
        setShippingAddress2(data.person.shippingAddress2 ?? "");
        setShippingCity(data.person.shippingCity ?? "");
        setShippingState(data.person.shippingState ?? "");
        setShippingZip(data.person.shippingZip ?? "");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : VOICE.errors.generic);
      })
      .finally(() => setLoading(false));
  }, [open, suggestionId, personId, eventId, token]);

  async function handlePlaceOrder() {
    if (!preview) return;
    setPlacing(true);
    try {
      const order = await api.placeOrder(token, {
        suggestionId,
        personId,
        eventId,
        retailerProductId: preview.product.id,
        giftRecordId,
        shippingName,
        shippingAddress1,
        shippingAddress2: shippingAddress2 || undefined,
        shippingCity,
        shippingState,
        shippingZip,
      });
      toast.success(VOICE.orderSuccess);
      onOrderPlaced(order);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : VOICE.orderFailed);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : (
              preview?.product.title ?? "Order Preview"
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full mt-4" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive py-2">{error}</p>
        )}

        {preview && !loading && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{preview.product.description}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-semibold">{dollars(preview.product.priceCents)}</span>
                <span className="text-sm text-muted-foreground">
                  {estimatedDeliveryLabel(preview.product.estimatedDeliveryDays)}
                </span>
              </div>
              {preview.product.retailerHint && (
                <p className="text-xs text-muted-foreground mt-1">via {preview.product.retailerHint}</p>
              )}
            </div>

            <div className="rounded-md bg-s2 border px-3 py-2 text-sm text-muted-foreground">
              {VOICE.cancelWindow}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Shipping address</p>

              <div className="space-y-1">
                <Label htmlFor="order-shipping-name">Name</Label>
                <Input
                  id="order-shipping-name"
                  value={shippingName}
                  onChange={(e) => setShippingName(e.target.value)}
                  placeholder="Recipient name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="order-shipping-address1">Address Line 1</Label>
                <Input
                  id="order-shipping-address1"
                  value={shippingAddress1}
                  onChange={(e) => setShippingAddress1(e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="order-shipping-address2">Address Line 2 (optional)</Label>
                <Input
                  id="order-shipping-address2"
                  value={shippingAddress2}
                  onChange={(e) => setShippingAddress2(e.target.value)}
                  placeholder="Apt, suite, unit, etc."
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <Label htmlFor="order-shipping-city">City</Label>
                  <Input
                    id="order-shipping-city"
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label htmlFor="order-shipping-state">State</Label>
                  <Input
                    id="order-shipping-state"
                    value={shippingState}
                    onChange={(e) => setShippingState(e.target.value)}
                    placeholder="OR"
                    maxLength={2}
                  />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label htmlFor="order-shipping-zip">Zip</Label>
                  <Input
                    id="order-shipping-zip"
                    value={shippingZip}
                    onChange={(e) => setShippingZip(e.target.value)}
                    placeholder="97520"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={placing}
          >
            Back
          </Button>
          <Button
            variant="default"
            onClick={handlePlaceOrder}
            disabled={placing || loading || !preview}
          >
            {placing ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {VOICE.orderPlacing}
              </>
            ) : (
              <>
                <ShoppingBag className="mr-1 h-4 w-4" />
                {VOICE.orderPreviewCta}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
