"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bot } from "lucide-react";
import { VOICE } from "@broflo/shared";

const STORAGE_KEY = "broflo_agent_explainer_dismissed";

export function useAgentExplainer() {
  const isDismissed =
    typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
  return { shouldShow: !isDismissed };
}

interface AgentExplainerProps {
  open: boolean;
  onDismiss: () => void;
  onProceed: () => void;
}

export function AgentExplainer({ open, onDismiss, onProceed }: AgentExplainerProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleProceed() {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onProceed();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{VOICE.agent.explainerTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <Bot className="h-8 w-8 text-amber" />
          </div>

          <p className="text-sm text-muted-foreground">
            {VOICE.agent.explainerBody}
          </p>

          <p className="text-sm text-muted-foreground">Here&apos;s what happens:</p>

          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {VOICE.agent.explainerSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          <p className="text-xs text-muted-foreground">
            {VOICE.agent.explainerPaymentNote}
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="rounded border-muted-foreground"
            />
            <span className="text-sm text-muted-foreground">{VOICE.agent.explainerDismiss}</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={handleProceed}>
            {VOICE.agent.explainerCta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
