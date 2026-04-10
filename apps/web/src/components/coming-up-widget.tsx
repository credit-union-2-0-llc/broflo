import Link from "next/link";
import type { UpcomingEvent } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function countdownLabel(days: number) {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `${days} days`;
}

function urgencyClass(days: number) {
  if (days <= 1) return "bg-broflo-warm text-white";
  if (days <= 7) return "bg-amber-100 text-amber-800";
  if (days <= 29) return "bg-broflo-electric-subtle text-broflo-electric";
  return "bg-secondary text-muted-foreground";
}

export function ComingUpWidget({ events }: { events: UpcomingEvent[] }) {
  const top5 = events.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Coming Up</CardTitle>
        {events.length > 0 && (
          <Link
            href="/events"
            className="text-xs text-broflo-electric hover:underline"
          >
            View All &rarr;
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {top5.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground italic">
              {VOICE.emptyStates.events}
            </p>
            <Link href="/events">
              <Button variant="ghost" size="sm" className="mt-3">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Your First Event
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {top5.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-3 py-2 rounded-md hover:bg-muted/50 px-2 -mx-2 transition-colors"
                aria-label={`${event.personName}'s ${event.occasionType}, ${countdownLabel(event.daysUntil)}`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {initials(event.personName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{event.personName}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    &middot; {event.occasionType}
                  </span>
                </div>
                <Badge className={cn("text-xs shrink-0", urgencyClass(event.daysUntil))}>
                  {countdownLabel(event.daysUntil)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
