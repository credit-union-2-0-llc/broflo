"use client";

import { Copy, ExternalLink, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TrackingCardProps {
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrierName?: string | null;
}

export function TrackingCard({ trackingNumber, trackingUrl, carrierName }: TrackingCardProps) {
  if (!trackingNumber) return null;

  function copyTracking() {
    if (trackingNumber) {
      navigator.clipboard.writeText(trackingNumber);
      toast.success("Tracking number copied");
    }
  }

  const isValidUrl = trackingUrl?.startsWith("https://");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Tracking Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {carrierName && (
          <p className="text-sm text-muted-foreground">{carrierName}</p>
        )}
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
            {trackingNumber}
          </code>
          <Button variant="ghost" size="sm" onClick={copyTracking} aria-label="Copy tracking number">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
        {isValidUrl && (
          <a
            href={trackingUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Track Package
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
