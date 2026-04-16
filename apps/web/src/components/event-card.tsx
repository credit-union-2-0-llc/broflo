import Link from "next/link";
import type { UpcomingEvent } from "@/lib/api";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatBudget(minCents: number | null, maxCents: number | null) {
  if (!minCents && !maxCents) return null;
  const min = minCents ? `$${(minCents / 100).toFixed(0)}` : "$0";
  const max = maxCents ? `$${(maxCents / 100).toFixed(0)}` : "...";
  return `${min} - ${max}`;
}

function countdownLabel(days: number) {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `${days} days`;
}

function urgencyClass(days: number) {
  if (days <= 1) return "bg-broflo-warm text-white";
  if (days <= 7) return "bg-amber-100 text-amber-800 border-amber-300";
  if (days <= 29) return "bg-broflo-electric-subtle text-broflo-electric";
  return "bg-secondary text-muted-foreground";
}

export function EventCard({ event }: { event: UpcomingEvent }) {
  const budget = formatBudget(event.budgetMinCents, event.budgetMaxCents);

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {initials(event.personName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{event.personName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs capitalize">
                {event.occasionType}
              </Badge>
              {event.isAutoCreated && (
                <Badge variant="secondary" className="text-xs" aria-label="Auto-created from dossier">
                  auto
                </Badge>
              )}
            </div>
          </div>
          <Badge
            className={cn("shrink-0 text-xs", urgencyClass(event.daysUntil))}
            aria-label={`${countdownLabel(event.daysUntil)}${event.daysUntil <= 1 ? ", urgent" : ""}`}
          >
            {countdownLabel(event.daysUntil)}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-0">
          <span className="text-sm text-muted-foreground">
            {budget ? `Budget: ${budget}` : "No budget set"}
          </span>
          {event.daysUntil <= 30 && (
            <Button variant="ghost" size="sm" className="text-xs gap-1 w-fit" tabIndex={-1}>
              <Gift className="h-3.5 w-3.5" />
              Find Gifts
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
