"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CreditCard, ExternalLink, FlaskConical } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function openPortal(token: string) {
  const res = await fetch(`${API_URL}/billing/portal-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to create portal session");
  const { url } = await res.json();
  window.location.href = url;
}

function BillingContent() {
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const tier = session?.user?.subscriptionTier || "free";
  const [devOverrideEnabled, setDevOverrideEnabled] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      update();
    }
  }, [success, update]);

  useEffect(() => {
    if (!session?.accessToken) return;
    api
      .getSubscription(session.accessToken)
      .then((sub) => setDevOverrideEnabled(sub.devTierOverrideEnabled))
      .catch(() => {});
  }, [session?.accessToken]);

  async function handleDevSwitch(newTier: "free" | "pro" | "elite") {
    if (!session?.accessToken) return;
    setSwitching(newTier);
    try {
      await api.devSetTier(session.accessToken, newTier);
      await update();
      toast.success(`Switched to ${newTier}.`);
    } catch {
      toast.error("Failed to switch tier.");
    } finally {
      setSwitching(null);
    }
  }

  const isPaid = tier !== "free";

  return (
    <div className="container max-w-lg mx-auto py-6 px-4 sm:px-6 sm:py-8 md:px-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Billing</h1>

      {success && (
        <div className="mb-4 p-3 rounded-md bg-amber-glow text-sm">
          {VOICE.billing.checkoutSuccess}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <Badge
              variant={isPaid ? "default" : "outline"}
              className={isPaid ? "bg-amber text-white" : ""}
            >
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPaid ? (
            <>
              <p className="text-sm text-muted-foreground">
                Manage your subscription, update payment method, or cancel
                through the Stripe billing portal.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  if (session?.accessToken) {
                    openPortal(session.accessToken);
                  }
                }}
              >
                {VOICE.billing.portalButton}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {VOICE.billing.noPlan}
              </p>
              <Link
                href="/upgrade"
                className="inline-flex w-full items-center justify-center rounded-lg h-8 px-2.5 text-sm font-medium bg-amber hover:bg-amber-light text-white transition-colors"
              >
                {VOICE.billing.upgradeCta}
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {devOverrideEnabled && (
        <Card className="mt-4 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              Testing — switch plans without Stripe
            </CardTitle>
            <CardDescription>
              Stripe isn&apos;t connected yet. This flips your own tier directly so you can test paywalled features.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            {(["free", "pro", "elite"] as const).map((t) => (
              <Button
                key={t}
                variant={tier === t ? "default" : "outline"}
                size="sm"
                disabled={!!switching || tier === t}
                onClick={() => handleDevSwitch(t)}
              >
                {switching === t ? "Switching..." : t.charAt(0).toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
