"use client";

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
} from "lucide-react";
import { VOICE } from "@broflo/shared";

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
  priceExpected?: number;
  priceActual?: number;
  errorMessage?: string;
  onRetry: () => void;
  onManual: () => void;
  onFindAnother: () => void;
}

function dollars(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export function AgentFailureState({
  type,
  retailer,
  productUrl,
  priceExpected,
  priceActual,
  errorMessage,
  onRetry,
  onManual,
  onFindAnother,
}: AgentFailureStateProps) {
  // CAPTCHA
  if (type === "captcha") {
    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>Hit a Wall</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 space-y-3">
          <ShieldAlert className="h-10 w-10 text-broflo-warm" />
          <p className="text-sm text-muted-foreground text-center">
            {VOICE.agent.captcha(retailer)}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            We can&apos;t complete this order automatically. You can finish it yourself.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFindAnother}>
            {VOICE.agent.tryDifferent}
          </Button>
          {productUrl && (
            <Button variant="default" onClick={onManual}>
              {VOICE.agent.orderManually(retailer)}
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  }

  // Out of stock
  if (type === "out_of_stock") {
    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>Sold Out</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 space-y-3">
          <PackageX className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {VOICE.agent.outOfStock}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            This item is no longer available on {retailer}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={onFindAnother}>
            {VOICE.agent.tryDifferent}
          </Button>
          {productUrl && (
            <Button variant="outline" onClick={onManual}>
              Order Manually
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  }

  // Site blocked
  if (type === "blocked") {
    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>Can&apos;t Reach Retailer</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 space-y-3">
          <Globe className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            {VOICE.agent.siteBlocked(retailer)}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            We couldn&apos;t complete the purchase on {retailer}. Here&apos;s a direct link.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFindAnother}>
            {VOICE.agent.tryDifferent}
          </Button>
          {productUrl && (
            <Button variant="default" onClick={onManual}>
              {VOICE.agent.orderManually(retailer)}
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  }

  // Timeout
  if (type === "timeout") {
    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>Taking Too Long</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center py-6 space-y-3">
          <Clock className="h-10 w-10 text-broflo-warm" />
          <p className="text-sm text-muted-foreground text-center">
            {VOICE.agent.timeout}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            We couldn&apos;t complete the purchase in time.
          </p>
        </div>
        <DialogFooter>
          <Button variant="default" onClick={onRetry}>
            {VOICE.agent.tryAgain}
          </Button>
          {productUrl && (
            <Button variant="outline" onClick={onManual}>
              Order Manually
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </div>
    );
  }

  // Price mismatch
  if (type === "price_mismatch" && priceExpected != null && priceActual != null) {
    const diff = priceActual - priceExpected;
    const isHigher = diff > 0;

    return (
      <div role="alert">
        <DialogHeader>
          <DialogTitle>Price Changed</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex justify-center">
            <DollarSign className="h-10 w-10 text-amber-500" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {isHigher ? VOICE.agent.priceMismatch : VOICE.agent.priceLower}
          </p>

          <Card className="bg-muted/50 p-3">
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
                <dd className={`font-mono ${isHigher ? "text-broflo-warm" : "text-green-600"}`}>
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

  // Generic / unknown failure
  return (
    <div role="alert">
      <DialogHeader>
        <DialogTitle>Something Went Wrong</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col items-center py-6 space-y-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center">
          {errorMessage ?? VOICE.errors.generic}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onFindAnother}>
          {VOICE.agent.tryDifferent}
        </Button>
        <Button variant="default" onClick={onRetry}>
          {VOICE.agent.tryAgain}
        </Button>
      </DialogFooter>
    </div>
  );
}
