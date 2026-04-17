"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ShieldAlert,
  PackageX,
  Globe,
  Clock,
  DollarSign,
  ExternalLink,
  AlertCircle,
  Copy,
  Check,
  ShoppingBag,
} from "lucide-react";
import { VOICE } from "@broflo/shared";
import { toast } from "sonner";

type FailureType =
  | "captcha"
  | "out_of_stock"
  | "blocked"
  | "timeout"
  | "price_mismatch"
  | "payment_declined"
  | "address_rejected"
  | "unknown"
  | null;

interface AgentFailureStateProps {
  type: FailureType;
  retailer: string;
  productUrl?: string;
  productTitle?: string;
  priceExpected?: number;
  priceActual?: number;
  shippingAddress?: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
  };
  errorMessage?: string;
  onRetry: () => void;
  onManual: () => void;
  onFindAnother: () => void;
  onMarkPurchased?: () => void;
}

function dollars(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

function formatAddress(addr: AgentFailureStateProps["shippingAddress"]) {
  if (!addr) return "";
  const parts = [addr.name, addr.address1];
  if (addr.address2) parts.push(addr.address2);
  parts.push(`${addr.city}, ${addr.state} ${addr.zip}`);
  return parts.join("\n");
}

function FailureIcon({ type }: { type: FailureType }) {
  switch (type) {
    case "captcha":
      return <ShieldAlert className="h-10 w-10 text-red" />;
    case "out_of_stock":
      return <PackageX className="h-10 w-10 text-muted-foreground" />;
    case "blocked":
      return <Globe className="h-10 w-10 text-muted-foreground" />;
    case "timeout":
      return <Clock className="h-10 w-10 text-red" />;
    case "price_mismatch":
      return <DollarSign className="h-10 w-10 text-amber-500" />;
    default:
      return <AlertCircle className="h-10 w-10 text-muted-foreground" />;
  }
}

function failureTitle(type: FailureType): string {
  switch (type) {
    case "captcha": return "Hit a Wall";
    case "out_of_stock": return "Sold Out";
    case "blocked": return "Can\u2019t Reach Retailer";
    case "timeout": return "Taking Too Long";
    case "price_mismatch": return "Price Changed";
    default: return "Something Went Wrong";
  }
}

function failureMessage(type: FailureType, retailer: string): string {
  switch (type) {
    case "captcha": return VOICE.agent.captcha(retailer);
    case "out_of_stock": return VOICE.agent.outOfStock;
    case "blocked": return VOICE.agent.siteBlocked(retailer);
    case "timeout": return VOICE.agent.timeout;
    case "price_mismatch": return VOICE.agent.priceMismatch;
    default: return "";
  }
}

export function AgentFailureState({
  type,
  retailer,
  productUrl,
  productTitle,
  priceExpected,
  priceActual,
  shippingAddress,
  errorMessage,
  onRetry,
  onManual,
  onFindAnother,
  onMarkPurchased,
}: AgentFailureStateProps) {
  const [addressCopied, setAddressCopied] = useState(false);

  async function handleCopyAddress() {
    if (!shippingAddress) return;
    await navigator.clipboard.writeText(formatAddress(shippingAddress));
    setAddressCopied(true);
    toast.success(VOICE.agent.addressCopied);
    setTimeout(() => setAddressCopied(false), 2000);
  }

  // Price mismatch gets a special layout with price comparison card
  if (type === "price_mismatch" && priceExpected != null && priceActual != null) {
    const diff = priceActual - priceExpected;
    const isHigher = diff > 0;

    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>{failureTitle(type)}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex justify-center">
            <FailureIcon type={type} />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {isHigher ? VOICE.agent.priceMismatch : VOICE.agent.priceLower}
          </p>

          <Card className="bg-s2 p-3">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expected:</dt>
                <dd className="font-mono">{dollars(priceExpected)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Actual:</dt>
                <dd className="font-mono font-semibold">{dollars(priceActual)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Difference:</dt>
                <dd className={`font-mono ${isHigher ? "text-red" : "text-green-600"}`}>
                  {isHigher ? "+" : "-"}{dollars(Math.abs(diff))} {isHigher ? "above" : "under"} budget
                </dd>
              </div>
            </dl>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFindAnother}>
            {VOICE.agent.tryDifferent}
          </Button>
          <Button variant="default" onClick={onRetry}>
            {VOICE.agent.continueAtPrice(dollars(priceActual))}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  // All other failure types share a common layout
  return (
    <div role="alert">
      <DialogHeader>
        <DialogTitle>{failureTitle(type)}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center py-4 space-y-3">
        <FailureIcon type={type} />
        <p className="text-sm text-muted-foreground text-center">
          {failureMessage(type, retailer) || errorMessage || VOICE.errors.generic}
        </p>

        {/* S7: Product context for manual fallback */}
        {(productTitle || priceExpected != null) && (
          <Card className="w-full bg-s2 p-3">
            <dl className="space-y-1 text-sm">
              {productTitle && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Product:</dt>
                  <dd className="font-medium text-right max-w-[60%] truncate">{productTitle}</dd>
                </div>
              )}
              {priceExpected != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Price:</dt>
                  <dd className="font-mono">{dollars(priceExpected)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Retailer:</dt>
                <dd>{retailer}</dd>
              </div>
            </dl>
          </Card>
        )}

        {/* S2: Shipping address with copy button */}
        {shippingAddress && (
          <Card className="w-full bg-s2 p-3">
            <div className="flex items-start justify-between">
              <div className="text-sm text-muted-foreground whitespace-pre-line">
                {formatAddress(shippingAddress)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 ml-2"
                onClick={handleCopyAddress}
              >
                {addressCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="ml-1 text-xs">{VOICE.agent.copyAddress}</span>
              </Button>
            </div>
          </Card>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onFindAnother}>
          {VOICE.agent.tryDifferent}
        </Button>

        {/* S6: Manual fallback on ALL failure types */}
        {productUrl && (
          <Button variant="default" onClick={onManual}>
            {VOICE.agent.fallbackCta}
            <ExternalLink className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}

        {/* Retry for timeout/unknown */}
        {(type === "timeout" || type === "unknown" || type === null) && (
          <Button variant="outline" onClick={onRetry}>
            {VOICE.agent.tryAgain}
          </Button>
        )}

        {/* S1: "Purchased Manually" button */}
        {onMarkPurchased && productUrl && (
          <Button variant="ghost" size="sm" onClick={onMarkPurchased}>
            <ShoppingBag className="mr-1 h-3.5 w-3.5" />
            {VOICE.agent.purchasedManually}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
