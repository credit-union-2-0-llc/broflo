"use client";

import type { Person } from "@broflo/shared";
import { CreateEventDialog } from "@/components/create-event-dialog";

export function EventsPageClient({ people }: { people: Person[] }) {
  return <CreateEventDialog people={people} />;
}
