"use client";

import { Badge } from "@/components/ui/badge";
import { Satellite } from "lucide-react";

const CARRIER_LABELS: Record<string, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
};

interface LiveTrackingBadgeProps {
  carrierKey: string | null;
  configuredCarriers: string[];
}

// Only renders once a carrier is both detected on the order (carrierKey) and
// has live credentials configured server-side (configuredCarriers) — a
// carrier with no adapter configured yet shows nothing extra, same as today.
export function LiveTrackingBadge({ carrierKey, configuredCarriers }: LiveTrackingBadgeProps) {
  if (!carrierKey || !configuredCarriers.includes(carrierKey)) return null;

  const label = CARRIER_LABELS[carrierKey] ?? carrierKey.toUpperCase();

  return (
    <Badge variant="outline" className="text-blue border-blue/40 text-xs gap-1">
      <Satellite className="h-3 w-3" />
      Live tracking ({label})
    </Badge>
  );
}
