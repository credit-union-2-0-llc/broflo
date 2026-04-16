"use client";

import { Suspense } from "react";
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
};

const TAGLINES: Record<string, string> = {
  free: VOICE.billing.freeTagline,
  pro: VOICE.billing.proTagline,
  elite: VOICE.billing.eliteTagline,
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
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled");
  const currentTier = session?.user?.subscriptionTier || "free";

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

      <div className="grid gap-6 md:grid-cols-3">
        {(["free", "pro", "elite"] as const).map((tier) => {
          const plan = SUBSCRIPTION_PLANS[tier];
          const isCurrent = currentTier === tier;
          const isHighlighted = tier === "pro";

          return (
            <Card
              key={tier}
              className={cn(
                "relative flex flex-col",
                isHighlighted && "border-broflo-electric shadow-md",
              )}
            >
              {isHighlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-broflo-electric text-white">
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
                      <Check className="h-4 w-4 mt-0.5 text-broflo-electric shrink-0" />
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
                ) : (
                  <>
                    <Button
                      className={cn(
                        "w-full",
                        isHighlighted &&
                          "bg-broflo-electric hover:bg-broflo-electric-light text-white",
                      )}
                      onClick={() => {
                        const priceId =
                          tier === "pro"
                            ? process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID
                            : process.env.NEXT_PUBLIC_STRIPE_ELITE_MONTHLY_PRICE_ID;
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
                        const priceId =
                          tier === "pro"
                            ? process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID
                            : process.env.NEXT_PUBLIC_STRIPE_ELITE_ANNUAL_PRICE_ID;
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
