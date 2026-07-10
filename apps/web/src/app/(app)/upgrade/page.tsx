"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VOICE, SUBSCRIPTION_PLANS } from "@broflo/shared";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const FEATURES: Record<string, string[]> = {
  free: [
    "Up to 3 people",
    "AI gift suggestions (safe mode)",
    "Auto-generated events",
    "Gift history tracking",
  ],
  pro: [
    "Unlimited people",
    "5 suggestions per request",
    "Bold surprise mode",
    "Up to 3 re-rolls",
    "Gift history context",
    "Full gamification",
    "Auto-execute purchases",
    "Autopilot mode",
  ],
  elite: [
    "Everything in Pro",
    "Concierge support",
    "Handwritten notes",
    "Priority AI processing",
    "Unlimited re-rolls",
  ],
  family: [
    "Everything in Elite",
    "Up to 5 seats, one bill",
    "Secret Santa organizer",
    "Group gift chip-in",
    "Shared family calendar",
  ],
};

const TAGLINES: Record<string, string> = {
  free: VOICE.billing.freeTagline,
  pro: VOICE.billing.proTagline,
  elite: VOICE.billing.eliteTagline,
  family: VOICE.billing.familyTagline,
};

const MONTHLY_PRICE_ID_ENV: Record<string, string | undefined> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
  elite: process.env.NEXT_PUBLIC_STRIPE_ELITE_MONTHLY_PRICE_ID,
  family: process.env.NEXT_PUBLIC_STRIPE_FAMILY_MONTHLY_PRICE_ID,
};

const ANNUAL_PRICE_ID_ENV: Record<string, string | undefined> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID,
  elite: process.env.NEXT_PUBLIC_STRIPE_ELITE_ANNUAL_PRICE_ID,
  family: process.env.NEXT_PUBLIC_STRIPE_FAMILY_ANNUAL_PRICE_ID,
};

async function startCheckout(priceId: string, token: string) {
  const res = await fetch(`${API_URL}/billing/checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) throw new Error("Failed to create checkout session");
  const { url } = await res.json();
  window.location.href = url;
}

function UpgradeContent() {
  const { data: session, update } = useSession();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");
  const currentTier = session?.user?.subscriptionTier || "free";
  const [devOverrideEnabled, setDevOverrideEnabled] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    api
      .getSubscription(session.accessToken)
      .then((sub) => setDevOverrideEnabled(sub.devTierOverrideEnabled))
      .catch(() => {});
  }, [session?.accessToken]);

  async function handleDevUnlock(tier: "pro" | "elite" | "family") {
    if (!session?.accessToken) return;
    setSwitching(tier);
    try {
      await api.devSetTier(session.accessToken, tier);
      await update({ user: { subscriptionTier: tier } });
      toast.success(`Unlocked ${tier} for testing.`);
    } catch {
      toast.error("Failed to unlock plan.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4 sm:px-6 sm:py-8 md:px-8">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {VOICE.billing.upgradeCta}
        </h1>
        <p className="text-muted-foreground mt-2">
          Choose the plan that fits your gift-giving game.
        </p>
        {canceled && (
          <p className="text-sm text-muted-foreground mt-2">
            {VOICE.billing.checkoutCanceled}
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {(["free", "pro", "elite", "family"] as const).map((tier) => {
          const plan = SUBSCRIPTION_PLANS[tier];
          const isCurrent = currentTier === tier;
          const isHighlighted = tier === "pro";

          return (
            <Card
              key={tier}
              className={cn(
                "relative flex flex-col",
                isHighlighted && "border-amber shadow-md",
              )}
            >
              {isHighlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber text-white">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{TAGLINES[tier]}</CardDescription>
                <div className="mt-3">
                  {plan.priceMonthly === 0 ? (
                    <span className="text-3xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">
                        ${plan.priceMonthly}
                      </span>
                      <span className="text-muted-foreground">/mo</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        or ${plan.priceAnnual}/yr (save{" "}
                        {Math.round(
                          (1 -
                            plan.priceAnnual / (plan.priceMonthly * 12)) *
                            100,
                        )}
                        %)
                      </p>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-2">
                  {FEATURES[tier].map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 mt-0.5 text-amber shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    {VOICE.billing.currentPlan}
                  </Button>
                ) : tier === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    Included
                  </Button>
                ) : devOverrideEnabled ? (
                  <Button
                    className={cn(
                      "w-full",
                      isHighlighted &&
                        "bg-amber hover:bg-amber-light text-white",
                    )}
                    disabled={switching === tier}
                    onClick={() => handleDevUnlock(tier as "pro" | "elite" | "family")}
                  >
                    {switching === tier ? "Unlocking..." : `Get ${plan.name} (testing)`}
                  </Button>
                ) : (
                  <>
                    <Button
                      className={cn(
                        "w-full",
                        isHighlighted &&
                          "bg-amber hover:bg-amber-light text-white",
                      )}
                      onClick={() => {
                        const priceId = MONTHLY_PRICE_ID_ENV[tier];
                        if (priceId && session?.accessToken) {
                          startCheckout(priceId, session.accessToken);
                        }
                      }}
                    >
                      Get {plan.name} Monthly
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const priceId = ANNUAL_PRICE_ID_ENV[tier];
                        if (priceId && session?.accessToken) {
                          startCheckout(priceId, session.accessToken);
                        }
                      }}
                    >
                      Get {plan.name} Annual
                    </Button>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense>
      <UpgradeContent />
    </Suspense>
  );
}
