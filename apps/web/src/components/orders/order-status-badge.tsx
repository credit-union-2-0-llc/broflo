"use client";

import { Badge } from "@/components/ui/badge";
import { Clock, Package, Truck, XCircle, AlertCircle, CheckCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  pending: { label: "Pending", variant: "outline", icon: Clock },
  ordered: { label: "Ordered", variant: "default", icon: CheckCircle },
  processing: { label: "Processing", variant: "secondary", icon: Package },
  shipped: { label: "Shipped", variant: "default", icon: Truck },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
  failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
};

interface OrderStatusBadgeProps {
  status: string;
  cancelCountdown?: string;
}

export function OrderStatusBadge({ status, cancelCountdown }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending!;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
      {cancelCountdown && status === "ordered" && (
        <span className="ml-1 font-mono text-xs">({cancelCountdown})</span>
      )}
    </Badge>
  );
}
