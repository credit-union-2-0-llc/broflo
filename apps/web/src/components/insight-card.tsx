"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface InsightCardProps {
  personId: string;
  initialInsight: string | null;
  completenessScore: number;
  tier: string;
}

export function InsightCard({
  personId,
  initialInsight,
  completenessScore,
  tier,
}: InsightCardProps) {
  const { data: session } = useSession();
  const [insight, setInsight] = useState(initialInsight);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free users see nothing
  if (tier === "free") return null;

  // Pro users see teaser
  if (tier === "pro") {
    return (
      <Card className="border border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-4 text-center">
          <p className="text-sm font-medium text-primary mb-1">
            AI Gift Profile
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Get AI-powered personality insights for better gift suggestions.
          </p>
          <a href="/upgrade">
            <Button variant="outline" size="sm">Upgrade to Elite</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  // Elite: empty state when completeness < 40%
  if (completenessScore < 40 && !insight) {
    return (
      <Card className="border border-dashed border-muted-foreground/20">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Fill in more dossier details to unlock AI insights.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Completeness needs to be at least 40%.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function handleRefresh() {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateInsight(session.accessToken, personId);
      setInsight(result.profile_text);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setError("Please wait a few minutes before regenerating.");
      } else {
        setError("Failed to generate insight.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Elite with insight
  return (
    <Card className="relative overflow-hidden border-2 border-transparent bg-gradient-to-br from-primary/5 via-background to-primary/10" style={{ borderImage: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.3)) 1" }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Gift Profile</h3>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Elite
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-7 text-xs"
          >
            {loading ? "Generating..." : "Refresh"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive mb-2">{error}</p>}
        {insight ? (
          <p className="text-sm leading-relaxed">{insight}</p>
        ) : (
          <div className="text-center py-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Gift Profile"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
