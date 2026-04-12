"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  ShoppingCart,
  CreditCard,
  FileCheck,
  CheckCircle,
  Circle,
  Loader2,
  ExternalLink,
  Package,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { VOICE } from "@broflo/shared";
import { api } from "@/lib/api";
import type { AgentJob, AgentStep, Order } from "@/lib/api";
import { RotatingCopy } from "@/components/rotating-copy";
import { AgentConfidenceBadge } from "@/components/orders/agent-confidence-badge";
import { AgentFailureState } from "@/components/orders/agent-failure-state";
import { cn } from "@/lib/utils";

type ModalPhase = "searching" | "preview" | "executing" | "completed" | "failed";

function dollars(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}

// Agent execution step definitions
const EXECUTION_STEPS = [
  { action: "select_product", label: "Found product", Icon: Search },
  { action: "add_to_cart", label: "Added to cart", Icon: ShoppingCart },
  { action: "enter_payment", label: "Checking out", Icon: CreditCard },
  { action: "confirm_order", label: "Confirming order", Icon: FileCheck },
  { action: "capture_confirmation", label: "Done", Icon: CheckCircle },
] as const;

interface AgentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestionId: string;
  personId: string;
  eventId: string;
  retailerUrl?: string;
  giftRecordId?: string;
  token: string;
  onOrderPlaced: (order: Order) => void;
}

export function AgentPreviewModal({
  open,
  onOpenChange,
  suggestionId,
  personId,
  eventId,
  retailerUrl,
  giftRecordId,
  token,
  onOrderPlaced,
}: AgentPreviewModalProps) {
  const [phase, setPhase] = useState<ModalPhase>("searching");
  const [job, setJob] = useState<AgentJob | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shipping address form
  const [shippingName, setShippingName] = useState("");
  const [shippingAddress1, setShippingAddress1] = useState("");
  const [shippingAddress2, setShippingAddress2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingZip, setShippingZip] = useState("");

  // Start agent preview search when modal opens
  useEffect(() => {
    if (!open) return;
    setPhase("searching");
    setJob(null);
    setSteps([]);
    setError(null);

    api
      .agentPreview(token, { suggestionId, personId, eventId, retailerUrl })
      .then((result) => {
        setJob(result);
        if (result.status === "previewing") {
          setPhase("preview");
          setShippingName(result.searchTerms); // Will be overridden if person has address
        } else if (result.status === "failed") {
          setPhase("failed");
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : VOICE.errors.generic);
        setPhase("failed");
      });
  }, [open, suggestionId, personId, eventId, retailerUrl, token]);

  // Poll for job status during execution
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const updated = await api.agentGetJob(token, jobId);
          setJob(updated);
          if (updated.steps) setSteps(updated.steps);

          if (updated.status === "completed") {
            setPhase("completed");
            if (pollRef.current) clearInterval(pollRef.current);
          } else if (updated.status === "failed" || updated.status === "aborted") {
            setPhase("failed");
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch {
          // Silently continue polling
        }
      }, 5000);
    },
    [token],
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleConfirmOrder() {
    if (!job) return;
    setPlacing(true);
    setPhase("executing");

    try {
      const result = await api.agentPlace(token, { jobId: job.id });
      setJob(result.job);

      if (result.job.status === "completed" && result.order) {
        setPhase("completed");
        toast.success(VOICE.orderSuccess);
        onOrderPlaced(result.order);
      } else if (result.job.status === "failed") {
        setPhase("failed");
      } else {
        // Still in progress — poll
        startPolling(job.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : VOICE.orderFailed);
      setPhase("failed");
    } finally {
      setPlacing(false);
    }
  }

  function handleClose() {
    if (phase === "executing") {
      setShowCloseConfirm(true);
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    onOpenChange(false);
  }

  function handleForceClose() {
    if (pollRef.current) clearInterval(pollRef.current);
    setShowCloseConfirm(false);
    onOpenChange(false);
  }

  const retailerName = job?.retailerDomain?.replace(/\.(com|net|org)$/, "") ?? "retailer";
  const displayRetailer = retailerName.charAt(0).toUpperCase() + retailerName.slice(1);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          {/* SEARCHING phase */}
          {phase === "searching" && (
            <>
              <DialogHeader>
                <DialogTitle>Finding Your Gift on {displayRetailer}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 space-y-4">
                <Search className="h-10 w-10 text-broflo-electric animate-pulse" />
                <RotatingCopy lines={VOICE.agent.searching} intervalMs={4000} />
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-broflo-electric h-full rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]"
                    style={{ width: "40%" }} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}

          {/* PREVIEW phase */}
          {phase === "preview" && job && (
            <>
              <DialogHeader>
                <DialogTitle>Broflo found this on {displayRetailer}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Product screenshot */}
                {job.foundProductImage ? (
                  <div className="rounded-lg border overflow-hidden">
                    <img
                      src={job.foundProductImage}
                      alt={job.foundProductTitle ?? "Product"}
                      className="w-full h-48 object-cover bg-muted"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border h-48 bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Product info + confidence */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{job.foundProductTitle}</p>
                    {job.foundProductPrice && (
                      <p className="font-mono text-lg font-semibold">
                        {dollars(job.foundProductPrice)}
                      </p>
                    )}
                  </div>
                  {job.matchConfidence != null && (
                    <AgentConfidenceBadge confidence={job.matchConfidence} />
                  )}
                </div>

                {/* Match reasoning */}
                <p className="text-sm text-muted-foreground">
                  {job.matchConfidence != null && job.matchConfidence >= 0.8
                    ? VOICE.agent.found
                    : VOICE.agent.foundLowConfidence}
                </p>

                {/* Price exceeds budget warning (M4) */}
                {job.foundProductPrice != null && job.maxBudgetCents != null &&
                  job.foundProductPrice > job.maxBudgetCents && (
                  <Card className="bg-amber-50 border-amber-200 p-3">
                    <p className="text-sm text-amber-800">
                      {VOICE.agent.priceOverBudget(
                        dollars(job.foundProductPrice),
                        dollars(job.maxBudgetCents),
                      )}
                    </p>
                  </Card>
                )}

                {/* Low confidence warning */}
                {job.matchConfidence != null && job.matchConfidence < 0.5 && (
                  <Card className="bg-amber-50 border-amber-200 p-3">
                    <p className="text-sm text-amber-800">
                      We&apos;re not 100% sure this is the right product. Double-check before confirming.
                    </p>
                    {job.foundProductUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        asChild
                      >
                        <a href={job.foundProductUrl} target="_blank" rel="noopener noreferrer">
                          View on {displayRetailer}
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </Card>
                )}

                {/* Info banner */}
                <Card className="bg-muted/50 border p-3">
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <Info className="h-4 w-4 shrink-0 mt-0.5" />
                    Broflo will place this order on {displayRetailer} on your behalf. {VOICE.cancelWindow}
                  </p>
                </Card>

                {/* Shipping form */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Shipping address</p>
                  <div className="space-y-1">
                    <Label htmlFor="agent-shipping-name">Name</Label>
                    <Input id="agent-shipping-name" value={shippingName}
                      onChange={(e) => setShippingName(e.target.value)} placeholder="Recipient name" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agent-shipping-addr1">Address Line 1</Label>
                    <Input id="agent-shipping-addr1" value={shippingAddress1}
                      onChange={(e) => setShippingAddress1(e.target.value)} placeholder="Street address" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="agent-shipping-addr2">Address Line 2 (optional)</Label>
                    <Input id="agent-shipping-addr2" value={shippingAddress2}
                      onChange={(e) => setShippingAddress2(e.target.value)} placeholder="Apt, suite, unit" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="agent-shipping-city">City</Label>
                      <Input id="agent-shipping-city" value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)} placeholder="City" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="agent-shipping-state">State</Label>
                      <Input id="agent-shipping-state" value={shippingState}
                        onChange={(e) => setShippingState(e.target.value)} placeholder="OR" maxLength={2} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="agent-shipping-zip">Zip</Label>
                      <Input id="agent-shipping-zip" value={shippingZip}
                        onChange={(e) => setShippingZip(e.target.value)} placeholder="97520" />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {VOICE.agent.tryDifferent}
                </Button>
                <Button
                  variant="default"
                  onClick={handleConfirmOrder}
                  disabled={placing || !shippingName || !shippingAddress1 || !shippingCity || !shippingState || !shippingZip}
                >
                  {placing ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Placing...
                    </>
                  ) : (
                    "Confirm Order"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* EXECUTING phase */}
          {phase === "executing" && (
            <>
              <DialogHeader>
                <DialogTitle>Placing Your Order</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <RotatingCopy lines={VOICE.agent.executing} intervalMs={8000} />

                {/* Step timeline */}
                <div className="space-y-0" aria-label="Order progress">
                  {EXECUTION_STEPS.map((step, i) => {
                    const matchedStep = steps.find((s) => s.action === step.action);
                    const isCompleted = matchedStep?.status === "completed";
                    const isRunning = matchedStep?.status === "running";
                    const isFuture = !matchedStep || matchedStep.status === "pending";
                    const isLast = i === EXECUTION_STEPS.length - 1;

                    return (
                      <div key={step.action} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                              isCompleted && "bg-green-100 text-green-600",
                              isRunning && "bg-blue-100 text-blue-600 ring-2 ring-blue-400",
                              isFuture && "bg-muted text-muted-foreground",
                            )}
                            aria-current={isRunning ? "step" : undefined}
                          >
                            <step.Icon className={cn("h-4 w-4", isRunning && "animate-pulse")} />
                          </div>
                          {!isLast && (
                            <div className={cn("w-0.5 flex-1 min-h-[24px]",
                              isCompleted ? "bg-green-300" : "bg-muted")} />
                          )}
                        </div>
                        <div className="pb-4 pt-1">
                          <p className={cn("text-sm font-medium",
                            isFuture && "text-muted-foreground")}>
                            {step.label}
                          </p>
                          {matchedStep?.completedAt && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {new Date(matchedStep.completedAt).toLocaleTimeString("en-US", {
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live screenshot */}
                {steps.length > 0 && steps[steps.length - 1].screenshotUrl && (
                  <div className="rounded-md border overflow-hidden">
                    <img
                      src={steps[steps.length - 1].screenshotUrl!}
                      alt={`Agent screenshot: ${steps[steps.length - 1].action}`}
                      className="w-full h-36 object-cover"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <p className="text-xs text-muted-foreground">
                  Closing this won&apos;t cancel the order.
                </p>
              </DialogFooter>
            </>
          )}

          {/* COMPLETED phase */}
          {phase === "completed" && job && (
            <>
              <DialogHeader>
                <DialogTitle>Order Placed</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center py-6 space-y-4">
                <CheckCircle className="h-12 w-12 text-green-600" />
                <p className="text-sm italic text-muted-foreground text-center">
                  &ldquo;{VOICE.orderSuccess}&rdquo;
                </p>
                <div className="text-center">
                  <p className="font-semibold">{job.foundProductTitle}</p>
                  {job.foundProductPrice && (
                    <p className="text-sm text-muted-foreground">
                      {dollars(job.foundProductPrice)} via {displayRetailer}
                    </p>
                  )}
                  {job.confirmationNumber && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Order #{job.confirmationNumber}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {VOICE.cancelWindow}
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
                {job.orderId && (
                  <Button variant="default" asChild>
                    <a href={`/orders/${job.orderId}`}>View Order</a>
                  </Button>
                )}
              </DialogFooter>
            </>
          )}

          {/* FAILED phase */}
          {phase === "failed" && (
            <>
              <AgentFailureState
                type={job?.failureReason ?? "unknown"}
                retailer={displayRetailer}
                productUrl={job?.foundProductUrl ?? undefined}
                productTitle={job?.foundProductTitle ?? undefined}
                priceExpected={job?.maxBudgetCents}
                priceActual={job?.foundProductPrice ?? undefined}
                shippingAddress={
                  shippingName
                    ? {
                        name: shippingName,
                        address1: shippingAddress1,
                        address2: shippingAddress2 || undefined,
                        city: shippingCity,
                        state: shippingState,
                        zip: shippingZip,
                      }
                    : undefined
                }
                errorMessage={error ?? undefined}
                onRetry={() => {
                  setPhase("searching");
                  setError(null);
                  api
                    .agentPreview(token, { suggestionId, personId, eventId, retailerUrl })
                    .then((result) => {
                      setJob(result);
                      if (result.status === "previewing") setPhase("preview");
                      else setPhase("failed");
                    })
                    .catch(() => setPhase("failed"));
                }}
                onManual={() => {
                  if (job?.foundProductUrl) {
                    window.open(job.foundProductUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                onFindAnother={() => onOpenChange(false)}
                onMarkPurchased={
                  job?.orderId
                    ? async () => {
                        try {
                          await api.markOrderManual(token, job.orderId!);
                          toast.success("Marked as purchased.");
                          onOpenChange(false);
                        } catch {
                          toast.error("Could not update order.");
                        }
                      }
                    : undefined
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close confirmation during execution */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close while ordering?</AlertDialogTitle>
            <AlertDialogDescription>
              The order is being placed. Closing this won&apos;t cancel it.
              You can track progress in Orders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceClose}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
