"use client";

import { Badge } from "@/components/ui/badge";

interface AgentConfidenceBadgeProps {
  confidence: number;
}

export function AgentConfidenceBadge({ confidence }: AgentConfidenceBadgeProps) {
  if (confidence >= 0.8) {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 border">
        Strong match
      </Badge>
    );
  }
  if (confidence >= 0.5) {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">
        Likely match
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground">
      Best guess
    </Badge>
  );
}
