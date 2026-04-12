"use client";

import { Badge } from "@/components/ui/badge";
import { Bot, Plug } from "lucide-react";

interface OrderMethodBadgeProps {
  method: "api" | "agent";
}

export function OrderMethodBadge({ method }: OrderMethodBadgeProps) {
  if (method === "agent") {
    return (
      <Badge
        variant="outline"
        className="text-broflo-electric border-broflo-electric-light text-xs gap-1"
        aria-label="Order method: Browser Agent"
      >
        <Bot className="h-3 w-3" />
        Agent
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground text-xs gap-1"
      aria-label="Order method: Direct API"
    >
      <Plug className="h-3 w-3" />
      Direct
    </Badge>
  );
}
