"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { Order } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";

interface OrdersInFlightWidgetProps {
  token: string;
}

export function OrdersInFlightWidget({ token }: OrdersInFlightWidgetProps) {
  const [orders, setOrders] = useState<Array<Order & { person: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const [ordered, processing, shipped] = await Promise.all([
          api.getOrders(token, { status: "ordered", limit: 3 }),
          api.getOrders(token, { status: "processing", limit: 3 }),
          api.getOrders(token, { status: "shipped", limit: 3 }),
        ]);
        const all = [...ordered.data, ...processing.data, ...shipped.data];
        setTotal(ordered.meta.total + processing.meta.total + shipped.meta.total);
        setOrders(all.slice(0, 3));
      } catch {
        // Graceful degradation
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const nextDelivery = orders
    .filter((o) => o.estimatedDeliveryDate)
    .sort((a, b) => new Date(a.estimatedDeliveryDate!).getTime() - new Date(b.estimatedDeliveryDate!).getTime())[0];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Orders In Flight
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {VOICE.tracking.allClear}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{total} active order{total !== 1 ? "s" : ""}</span>
              {nextDelivery?.estimatedDeliveryDate && (
                <span className="text-muted-foreground">
                  Next delivery:{" "}
                  {new Date(nextDelivery.estimatedDeliveryDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-2 py-1.5 hover:bg-muted rounded px-1 -mx-1 transition-colors"
                >
                  <OrderStatusBadge status={order.status} />
                  <span className="text-sm truncate flex-1">{order.productTitle}</span>
                </Link>
              ))}
            </div>
            <Link
              href="/orders"
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              View all orders
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
