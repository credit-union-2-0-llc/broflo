import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { UpcomingEvent } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import { Calendar } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { EventsPageClient } from "./events-page-client";

export default async function EventsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let events: UpcomingEvent[] = [];
  let people: Awaited<ReturnType<typeof api.listPersons>> = [];
  let error = false;

  try {
    const [eventsRes, peopleRes] = await Promise.all([
      api.getUpcomingEvents(session.accessToken, { limit: 100 }),
      api.listPersons(session.accessToken),
    ]);
    events = eventsRes.data;
    people = peopleRes;
  } catch {
    error = true;
  }

  const thisWeek = events.filter((e) => e.daysUntil <= 7);
  const thisMonth = events.filter((e) => e.daysUntil > 7 && e.daysUntil <= 30);
  const later = events.filter((e) => e.daysUntil > 30);
  const totalPeople = new Set(events.map((e) => e.personId)).size;

  if (error) {
    return (
      <div className="bg-transparent px-4 py-6 sm:px-6 sm:py-8 md:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 sm:mb-8 flex items-center justify-between">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Events</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-sm text-destructive">{VOICE.errors.eventsLoad}</p>
            <Link href="/events" className="text-sm text-amber hover:underline mt-2 inline-block">
              Try Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Events</h1>
            {events.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                {events.length} {events.length === 1 ? "event" : "events"} across {totalPeople}{" "}
                {totalPeople === 1 ? "person" : "people"}
              </p>
            )}
          </div>
          <EventsPageClient people={people} />
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground italic">
              {VOICE.emptyStates.events}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {thisWeek.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  This Week
                </h2>
                <div className="space-y-3">
                  {thisWeek.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {thisMonth.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  This Month
                </h2>
                <div className="space-y-3">
                  {thisMonth.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}

            {later.length > 0 && (
              <section>
                <EventsLaterSection events={later} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventsLaterSection({ events }: { events: UpcomingEvent[] }) {
  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Later
      </h2>
      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </>
  );
}
