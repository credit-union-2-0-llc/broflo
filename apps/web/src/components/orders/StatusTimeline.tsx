"use client";

import { CheckCircle, Circle, Clock, Package, Truck, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatusHistoryEntry } from "@/lib/api";

const STATUS_ORDER = ["pending", "ordered", "processing", "shipped", "delivered"];

const STATUS_ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  ordered: CheckCircle,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
  failed: AlertCircle,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  ordered: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Failed",
};

interface StatusTimelineProps {
  entries: OrderStatusHistoryEntry[];
  currentStatus: string;
}

export function StatusTimeline({ entries, currentStatus }: StatusTimelineProps) {
  const completedStatuses = new Set(entries.map((e) => e.toStatus));
  const isTerminal = ["cancelled", "failed"].includes(currentStatus);

  const steps = isTerminal
    ? [...entries.map((e) => e.toStatus)]
    : STATUS_ORDER;

  // Deduplicate while preserving order
  const uniqueSteps = [...new Set(steps)];

  return (
    <div className="space-y-0">
      {uniqueSteps.map((status, i) => {
        const entry = entries.find((e) => e.toStatus === status);
        const isCompleted = completedStatuses.has(status);
        const isCurrent = status === currentStatus;
        const isFuture = !isCompleted && !isCurrent;
        const isLast = i === uniqueSteps.length - 1;

        const Icon = STATUS_ICONS[status] ?? Circle;

        return (
          <div key={status} className="flex gap-3">
            {/* Vertical line + circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isCurrent && "bg-blue-100 text-blue-600 ring-2 ring-blue-400",
                  isCompleted && !isCurrent && "bg-green-100 text-green-600",
                  isFuture && "bg-muted text-muted-foreground",
                )}
              >
                <Icon className={cn("h-4 w-4", isCurrent && "animate-pulse")} />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[24px]",
                    isCompleted && !isFuture ? "bg-green-300" : "bg-muted",
                  )}
                />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 pt-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isFuture && "text-muted-foreground",
                )}
              >
                {STATUS_LABELS[status] ?? status}
              </p>
              {entry && (
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.changedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {entry.source !== "system" && (
                    <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0">
                      {entry.source}
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
