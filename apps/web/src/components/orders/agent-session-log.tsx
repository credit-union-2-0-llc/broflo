"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ChevronDown, ChevronUp, Image } from "lucide-react";
import { VOICE } from "@broflo/shared";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/api";
import { ScreenshotGallery } from "@/components/orders/screenshot-gallery";

const STEP_LABELS: Record<string, string> = {
  navigate: "Navigated to site",
  search: "Searched for product",
  filter: "Filtered results",
  select_product: "Selected product",
  add_to_cart: "Added to cart",
  enter_address: "Entered shipping address",
  enter_payment: "Applied payment",
  confirm_order: "Order confirmed",
  capture_confirmation: "Captured confirmation",
  detect_captcha: "CAPTCHA detected",
  detect_oos: "Out of stock detected",
  error: "Error encountered",
};

interface AgentSessionLogProps {
  steps: AgentStep[];
  sessionId: string;
  retailerDomain: string;
  durationSeconds?: number;
}

export function AgentSessionLog({
  steps,
  sessionId,
  retailerDomain,
  durationSeconds,
}: AgentSessionLogProps) {
  const [expanded, setExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const screenshots = steps
    .filter((s) => s.screenshotUrl && s.action !== "enter_payment")
    .map((s) => ({
      url: s.screenshotUrl!,
      label: STEP_LABELS[s.action] ?? s.action,
    }));

  return (
    <Card>
      <CardHeader className="pb-0">
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 px-0 font-normal"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {VOICE.agent.sessionLogToggle}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-3 space-y-3">
          {/* Session metadata */}
          <div className="text-xs text-muted-foreground font-mono space-y-0.5">
            <p>Session ID: {sessionId}</p>
            {durationSeconds != null && <p>Duration: {durationSeconds} seconds</p>}
            <p>Retailer: {retailerDomain}</p>
          </div>

          {/* Step timeline */}
          <div className="space-y-0">
            {steps.map((step, i) => {
              const isLast = i === steps.length - 1;
              const isPayment = step.action === "enter_payment";

              return (
                <div key={step.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      step.status === "completed" && "bg-green-100 text-green-600",
                      step.status === "failed" && "bg-red-100 text-red-600",
                      step.status === "running" && "bg-blue-100 text-blue-600",
                      step.status === "pending" && "bg-muted text-muted-foreground",
                    )}>
                      <CheckCircle className="h-3 w-3" />
                    </div>
                    {!isLast && <div className="w-0.5 flex-1 min-h-[16px] bg-green-300" />}
                  </div>
                  <div className="pb-3 pt-0.5 flex items-center gap-2">
                    <p className="text-xs font-medium">
                      {STEP_LABELS[step.action] ?? step.action}
                    </p>
                    {step.completedAt && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(step.completedAt).toLocaleTimeString("en-US", {
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    )}
                    {step.screenshotUrl && !isPayment && (
                      <button
                        className="cursor-pointer"
                        onClick={() => {
                          const idx = screenshots.findIndex((s) => s.url === step.screenshotUrl);
                          setGalleryIndex(idx >= 0 ? idx : 0);
                          setGalleryOpen(true);
                        }}
                      >
                        <Image className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {screenshots.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            >
              {VOICE.agent.viewScreenshots}
            </Button>
          )}

          <ScreenshotGallery
            screenshots={screenshots}
            initialIndex={galleryIndex}
            open={galleryOpen}
            onOpenChange={setGalleryOpen}
          />
        </CardContent>
      )}
    </Card>
  );
}
