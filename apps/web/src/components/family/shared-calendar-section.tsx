"use client";

import { useEffect, useState } from "react";
import { CalendarHeart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";
import type { SharedEvent } from "@/lib/api";

const OCCASION_LABELS: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Anniversary",
  holiday: "Holiday",
  graduation: "Graduation",
  promotion: "Promotion",
  custom: "Event",
};

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export function SharedCalendarSection({ token }: { token: string }) {
  const [events, setEvents] = useState<SharedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSharedEvents(token)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="h-4 w-4" />
          Family Calendar
        </CardTitle>
        <CardDescription>
          Dates your family has chosen to share — just the date and occasion, nothing else.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nothing shared yet — check &ldquo;Share this date with my family plan&rdquo; when adding an event.
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((e, i) => (
              <div key={i} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <span className="font-medium">
                  {e.personFirstName}&apos;s {OCCASION_LABELS[e.occasionType] ?? e.occasionType}
                </span>
                <span className="text-muted-foreground">{formatDate(e.date)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
