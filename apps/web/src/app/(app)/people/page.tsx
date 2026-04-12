import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompletenessRing } from "@/components/completeness-ring";

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
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your People</h1>
            <p className="mt-1 text-muted-foreground">
              {people.length === 0
                ? VOICE.emptyStates.people
                : `${people.length} ${people.length === 1 ? "person" : "people"} in your circle`}
            </p>
          </div>
          <Link href="/people/new">
            <Button>{people.length === 0 ? VOICE.people.addFirst : VOICE.people.addAnother}</Button>
          </Link>
        </div>

        {people.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                        {initials(person.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">{person.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1 text-xs capitalize">
                        {person.relationship}
                      </Badge>
                    </div>
                    <CompletenessRing score={person.completenessScore} />
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-1">
                    {person.birthday && (
                      <p>
                        Birthday:{" "}
                        {new Date(person.birthday).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                    {formatBudget(person.budgetMinCents, person.budgetMaxCents) && (
                      <p>Budget: {formatBudget(person.budgetMinCents, person.budgetMaxCents)}</p>
                    )}
                    {person.tags && person.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {person.tags.slice(0, 3).map((t) => (
                          <span key={t.id} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {t.tag}
                          </span>
                        ))}
                        {person.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{person.tags.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
