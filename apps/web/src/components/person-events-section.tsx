"use client";

import Link from "next/link";
import type { UpcomingEvent } from "@/lib/api";
import type { Person } from "@broflo/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CreateEventDialog } from "@/components/create-event-dialog";
import { cn } from "@/lib/utils";

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PersonEventsSectionProps {
  events: UpcomingEvent[];
  person: Person;
  people: Person[];
}

export function PersonEventsSection({
  events,
  person,
  people,
}: PersonEventsSectionProps) {
  const personEvents = events.filter((e) => e.personId === person.id);

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">
        Upcoming Events
      </h3>
      {personEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <div className="space-y-1">
          {personEvents.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center gap-2 text-sm py-1 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
              aria-label={`${event.occasionType} on ${formatDate(event.nextOccurrence)}, ${countdownLabel(event.daysUntil)}`}
            >
              <span className="text-muted-foreground capitalize">{event.occasionType}</span>
              <span className="font-medium">{formatDate(event.nextOccurrence)}</span>
              <Badge className={cn("text-xs", urgencyClass(event.daysUntil))}>
                {countdownLabel(event.daysUntil)}
              </Badge>
              {event.isAutoCreated && (
                <Badge variant="secondary" className="text-xs">auto</Badge>
              )}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-2">
        <CreateEventDialog
          people={people}
          preselectedPersonId={person.id}
          trigger={
            <Button variant="ghost" size="sm" className="text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Event for {person.name.split(" ")[0]}
            </Button>
          }
        />
      </div>
    </div>
  );
}
