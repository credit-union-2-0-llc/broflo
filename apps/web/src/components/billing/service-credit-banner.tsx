"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, X } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { useState } from "react";

interface ServiceCreditBannerProps {
  amountCents: number;
  onDismiss?: () => void;
}

function dollars(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

export function ServiceCreditBanner({ amountCents, onDismiss }: ServiceCreditBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Card className="bg-green-50 border-green-200 p-4">
      <div className="flex items-start gap-3">
        <CreditCard className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">Credit Applied</p>
          <p className="text-sm text-green-700 mt-0.5">
            {VOICE.agent.creditIssued(dollars(amountCents))}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-green-700 hover:text-green-800 hover:bg-green-100 px-0"
            asChild
          >
            <a href="/billing">{VOICE.agent.creditBannerCta}</a>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-green-800 hover:bg-green-100 shrink-0"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
}
