"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { Order } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { CancelCountdown } from "@/components/orders/cancel-countdown";
import { Badge } from "@/components/ui/badge";
import { Bot } from "lucide-react";

type StatusFilter = "all" | "active" | "delivered" | "cancelled";

const ACTIVE_STATUSES = ["ordered", "processing", "shipped"];

export default function OrdersPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Array<Order & { person: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const loadOrders = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        limit,
        sortBy: "placedAt",
        sortOrder,
      };

      if (filter === "active") {
        // Fetch active statuses separately and combine
        const results = await Promise.all(
          ACTIVE_STATUSES.map((s) =>
            api.getOrders(session.accessToken, { status: s, limit: 50, sortBy: "placedAt", sortOrder }),
          ),
        );
        const all = results.flatMap((r) => r.data);
        all.sort((a, b) => {
          const aTime = new Date(a.placedAt ?? a.createdAt).getTime();
          const bTime = new Date(b.placedAt ?? b.createdAt).getTime();
          return sortOrder === "desc" ? bTime - aTime : aTime - bTime;
        });
        setOrders(all);
        setTotal(results.reduce((sum, r) => sum + r.meta.total, 0));
      } else {
        if (filter !== "all") params.status = filter;
        const res = await api.getOrders(session.accessToken, params as Parameters<typeof api.getOrders>[1]);
        setOrders(res.data);
        setTotal(res.meta.total);
      }
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filter, sortOrder, page]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/login");
  }, [sessionStatus, router]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  function formatPrice(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {(["all", "active", "delivered", "cancelled"] as StatusFilter[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => { setFilter(f); setPage(1); }}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest first</SelectItem>
              <SelectItem value="asc">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Order list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground italic">
                {VOICE.tracking.emptyState}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-4">
                    {order.productImageUrl ? (
                      <img
                        src={order.productImageUrl}
                        alt={order.productTitle}
                        className="h-14 w-14 rounded object-cover bg-muted"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                        Gift
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{order.productTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        For {order.person?.name} &middot;{" "}
                        {order.placedAt
                          ? new Date(order.placedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "Pending"}
                      </p>
                      {order.retailerKey === "browser-agent" && (
                        <Badge
                          variant="outline"
                          className="text-broflo-electric border-broflo-electric-light text-[10px] gap-1 w-fit mt-0.5"
                          aria-label="This order was placed by the Broflo browser agent"
                        >
                          <Bot className="h-3 w-3" />
                          Placed by Broflo Agent
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium">{formatPrice(order.priceCents)}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    {session?.accessToken &&
                      ["pending", "ordered"].includes(order.status) &&
                      order.placedAt && (
                        <div onClick={(e) => e.preventDefault()}>
                          <CancelCountdown
                            orderId={order.id}
                            placedAt={order.placedAt}
                            token={session.accessToken}
                            onCancelled={loadOrders}
                          />
                        </div>
                      )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="mt-6 flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground self-center">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / limit)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
