"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { VOICE } from "@broflo/shared";

const LEVELS = [
  { min: 0, max: 49, key: "rookieBro" as const, index: 1 },
  { min: 50, max: 149, key: "solidDude" as const, index: 2 },
  { min: 150, max: 349, key: "giftWhisperer" as const, index: 3 },
  { min: 350, max: 699, key: "theLegend" as const, index: 4 },
  { min: 700, max: Infinity, key: "brofloElite" as const, index: 5 },
];

function getLevel(score: number) {
  return LEVELS.find((l) => score >= l.min && score <= l.max)!;
}

function getNextLevel(score: number) {
  const current = getLevel(score);
  return LEVELS.find((l) => l.index === current.index + 1) ?? null;
}

interface BrofloScoreWidgetProps {
  score: number;
  variant?: "full" | "compact";
}

export function BrofloScoreWidget({
  score,
  variant = "full",
}: BrofloScoreWidgetProps) {
  const level = getLevel(score);
  const next = getNextLevel(score);
  const levelName = VOICE.levels[level.key];
  const progress = next
    ? ((score - level.min) / (level.max - level.min + 1)) * 100
    : 100;

  if (variant === "compact") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Trophy className="h-5 w-5 text-amber" />
          <div>
            <span className="text-lg font-bold">{score}</span>
            <span className="text-sm text-muted-foreground ml-2">
              &middot; &ldquo;{levelName}&rdquo;
            </span>
          </div>
          {next && (
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber rounded-full transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Next: {VOICE.levels[next.key]} at {next.min} pts
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your Broflo Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber" />
          <span className="text-3xl font-bold">{score}</span>
        </div>

        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-amber rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <div>
          <p className="text-sm font-medium">&ldquo;{levelName}&rdquo;</p>
          <p className="text-xs text-muted-foreground">
            Level {level.index} of 5
          </p>
        </div>

        {next && (
          <p className="text-xs text-muted-foreground">
            Next: {VOICE.levels[next.key]} at {next.min} pts
          </p>
        )}

        <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
          <p>+10 gift recorded</p>
          <p>+5 feedback given</p>
          <p>+20 5-star rating</p>
        </div>
      </CardContent>
    </Card>
  );
}
