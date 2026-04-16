"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { OrderDetailResponse, OrderStatusHistoryEntry } from "@/lib/api";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { StatusTimeline } from "@/components/orders/StatusTimeline";
import { TrackingCard } from "@/components/orders/TrackingCard";
import { CancelCountdown } from "@/components/orders/cancel-countdown";
import { AgentSessionLog } from "@/components/orders/agent-session-log";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2 } from "lucide-react";
import type { AgentStep } from "@/lib/api";

export default function OrderDetailPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [timeline, setTimeline] = useState<OrderStatusHistoryEntry[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/login");
  }, [sessionStatus, router]);

  useEffect(() => {
    async function load() {
      if (!session?.accessToken || !params.id) return;
      try {
        const [orderData, timelineData] = await Promise.all([
          api.getOrder(session.accessToken, params.id),
          api.getOrderTimeline(session.accessToken, params.id),
        ]);
        setOrder(orderData);
        setTimeline(timelineData);
        // Load agent steps if this is a browser-agent order
        if (orderData.retailerKey === "browser-agent" && orderData.id) {
          try {
            const steps = await api.agentGetSteps(session.accessToken, orderData.id);
            setAgentSteps(steps);
          } catch {
            // Agent steps may not be available — non-blocking
          }
        }
      } catch {
        router.push("/orders");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session?.accessToken, params.id, router]);

  function formatPrice(cents: number) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        {/* Header */}
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{order.productTitle}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {formatPrice(order.priceCents)}
              {order.confirmationNumber && (
                <span> &middot; #{order.confirmationNumber}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {order.retailerKey === "browser-agent" && (
              <Badge
                variant="outline"
                className="text-broflo-electric border-broflo-electric-light text-xs gap-1"
                aria-label="This order was placed by the Broflo browser agent"
              >
                <Bot className="h-3 w-3" />
                Placed by Broflo Agent
              </Badge>
            )}
            {order.retailerKey === "browser-agent" && order.status === "delivered" && (
              <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verified by Broflo
              </Badge>
            )}
            <OrderStatusBadge status={order.status} />
            {session?.accessToken &&
              ["pending", "ordered"].includes(order.status) &&
              order.placedAt && (
                <CancelCountdown
                  orderId={order.id}
                  placedAt={order.placedAt}
                  token={session.accessToken}
                  onCancelled={() => router.push("/orders")}
                />
              )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Order Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusTimeline entries={timeline} currentStatus={order.status} />
            </CardContent>
          </Card>

          {/* Tracking Card */}
          <TrackingCard
            trackingNumber={order.trackingNumber}
            trackingUrl={order.trackingUrl}
            carrierName={order.carrierName}
          />

          {/* Agent Session Log */}
          {order.retailerKey === "browser-agent" && agentSteps.length > 0 && (
            <AgentSessionLog
              steps={agentSteps}
              sessionId={order.id}
              retailerDomain={order.retailerKey}
              durationSeconds={
                agentSteps.length > 0 && agentSteps[agentSteps.length - 1].completedAt && agentSteps[0].startedAt
                  ? Math.round(
                      (new Date(agentSteps[agentSteps.length - 1].completedAt!).getTime() -
                        new Date(agentSteps[0].startedAt!).getTime()) / 1000
                    )
                  : undefined
              }
            />
          )}

          {/* Product Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Product</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              {order.productImageUrl ? (
                <img
                  src={order.productImageUrl}
                  alt={order.productTitle}
                  className="h-20 w-20 rounded object-cover bg-muted shrink-0"
                />
              ) : (
                <div className="h-20 w-20 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs shrink-0">
                  Gift
                </div>
              )}
              <div>
                <p className="font-medium">{order.productTitle}</p>
                {order.productDescription && (
                  <p className="text-sm text-muted-foreground mt-1">{order.productDescription}</p>
                )}
                {order.estimatedDeliveryDate && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Est. delivery:{" "}
                    {new Date(order.estimatedDeliveryDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recipient */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recipient</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{order.person?.name ?? order.shippingName}</p>
              <p className="text-sm text-muted-foreground">
                {order.shippingAddress1}
                {order.shippingAddress2 && `, ${order.shippingAddress2}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.shippingCity}, {order.shippingState} {order.shippingZip}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
