import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { SectionHeader } from "@/components/radar/SectionHeader";
import { PlayerCard } from "@/components/dossier/PlayerCard";

export default async function PeoplePage() {
  const session = await auth();
  if (!session) redirect("/login");

  let people: Awaited<ReturnType<typeof api.listPersons>> = [];
  try {
    people = await api.listPersons(session.accessToken);
  } catch {
    // token may be expired — show empty state
  }

  return (
    <>
      <SectionHeader
        title="Assets"
        count={people.length}
        countLabel="people"
        actionLabel="Add Asset +"
        actionHref="/people/new"
      />

      {people.length === 0 ? (
        <div
          className="text-center py-10 border"
          style={{ borderColor: "var(--border)", background: "var(--s1)" }}
        >
          <Users
            className="mx-auto h-8 w-8 mb-3"
            style={{ color: "var(--border3)" }}
          />
          <p
            className="text-sm italic"
            style={{ color: "var(--muted2)", fontFamily: "var(--font-body)" }}
          >
            {VOICE.emptyStates.people}
          </p>
          <Link
            href="/people/new"
            className="inline-flex items-center gap-1.5 mt-4 text-[9px] uppercase px-3 py-1.5"
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
              color: "#000",
              background: "var(--amber)",
            }}
          >
            <Plus className="h-3 w-3" />
            {VOICE.people.addFirst}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {people.map((person, i) => (
            <PlayerCard
              key={person.id}
              id={person.id}
              index={i + 1}
              name={person.name}
              relationship={person.relationship}
              tags={person.tags}
              budgetMinCents={person.budgetMinCents}
              budgetMaxCents={person.budgetMaxCents}
            />
          ))}
        </div>
      )}
    </>
  );
}
