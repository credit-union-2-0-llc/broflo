"use client";

import type { UpcomingEvent } from "@/lib/api";
import type { Person } from "@broflo/shared";
import { PersonEventsSection } from "@/components/person-events-section";

interface Props {
  events: UpcomingEvent[];
  person: Person;
  people: Person[];
}

export function PersonEventsClient({ events, person, people }: Props) {
  return <PersonEventsSection events={events} person={person} people={people} />;
}
