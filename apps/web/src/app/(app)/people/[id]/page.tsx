import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { UpcomingEvent } from "@/lib/api";
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
import { Separator } from "@/components/ui/separator";
import { CompletenessRing } from "@/components/completeness-ring";
import { DeletePersonButton } from "@/components/delete-person-button";
import { PersonEventsClient } from "./person-events-client";
import { GiftHistorySection } from "@/components/gifts/gift-history-section";
import { WishlistParser } from "@/components/wishlist-parser";
import { InsightCard } from "@/components/insight-card";
import { PhotoSection } from "@/components/photos";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function dollars(cents: number | null) {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  let person;
  let events: UpcomingEvent[] = [];
  let people: Awaited<ReturnType<typeof api.listPersons>> = [];
  try {
    const [personRes, eventsRes, peopleRes] = await Promise.all([
      api.getPerson(session.accessToken, id),
      api.getUpcomingEvents(session.accessToken, { limit: 100 }),
      api.listPersons(session.accessToken),
    ]);
    person = personRes;
    events = eventsRes.data;
    people = peopleRes;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      redirect("/login");
    }
    notFound();
  }

  const sections = [
    {
      label: "Sizes",
      items: [
        { label: "Top", value: person.clothingSizeTop },
        { label: "Bottom", value: person.clothingSizeBottom },
        { label: "Shoes", value: person.shoeSize },
      ].filter((i) => i.value),
    },
    {
      label: "Preferences",
      items: [
        { label: "Music", value: person.musicTaste },
        { label: "Brands", value: person.favoriteBrands },
        { label: "Hobbies", value: person.hobbies },
        { label: "Food", value: person.foodPreferences },
      ].filter((i) => i.value),
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/people">
            <Button variant="ghost" size="sm">&larr; Back</Button>
          </Link>
          <div className="flex gap-2">
            <Link href={`/people/${person.id}/edit`}>
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
            <DeletePersonButton personId={person.id} personName={person.name} />
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {initials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">{person.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize">
                  {person.relationship}
                </Badge>
                {person.pronouns && (
                  <span className="text-xs text-muted-foreground">({person.pronouns})</span>
                )}
              </div>
            </div>
            <CompletenessRing score={person.completenessScore} size={48} />
          </CardHeader>
          <CardContent className="space-y-4">
            <InsightCard
              personId={person.id}
              initialInsight={person.dossierInsight}
              completenessScore={person.completenessScore}
              tier={(session.user as Record<string, unknown>)?.subscriptionTier as string ?? "free"}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {person.birthday && (
                <div>
                  <span className="text-muted-foreground">Birthday</span>
                  <p className="font-medium">
                    {new Date(person.birthday).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {person.anniversary && (
                <div>
                  <span className="text-muted-foreground">Anniversary</span>
                  <p className="font-medium">
                    {new Date(person.anniversary).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
              {(person.budgetMinCents || person.budgetMaxCents) && (
                <div>
                  <span className="text-muted-foreground">Budget Range</span>
                  <p className="font-medium">
                    {dollars(person.budgetMinCents) || "$0"} &ndash;{" "}
                    {dollars(person.budgetMaxCents) || "..."}
                  </p>
                </div>
              )}
            </div>

            {person.tags && person.tags.length > 0 && (
              <>
                <Separator className="my-3" />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {person.tags.slice(0, 8).map((t) => (
                      <span key={t.id} className="inline-flex items-center rounded-full bg-amber-glow px-2.5 py-1 text-xs font-medium text-primary">
                        {t.tag}
                      </span>
                    ))}
                    {person.tags.length > 8 && (
                      <span className="text-xs text-muted-foreground self-center">+{person.tags.length - 8} more</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {(person.allergens.length > 0 || person.dietaryRestrictions.length > 0) && (
              <>
                <Separator className="my-3" />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Dietary</h3>
                  <div className="flex flex-wrap gap-2">
                    {person.allergens.map((a) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-red-dim px-2.5 py-1 text-xs font-medium text-destructive capitalize">
                        &#9888; {a}
                      </span>
                    ))}
                    {person.dietaryRestrictions.map((d) => (
                      <span key={d} className="inline-flex items-center rounded-full bg-amber-glow px-2.5 py-1 text-xs font-medium text-amber capitalize">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {sections.map(
              (section) =>
                section.items.length > 0 && (
                  <div key={section.label}>
                    <Separator className="my-3" />
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                      {section.label}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {section.items.map((item) => (
                        <div key={item.label}>
                          <span className="text-muted-foreground">{item.label}</span>
                          <p>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            )}

            {(person.wishlistUrls || (person.wishlistItems && person.wishlistItems.length > 0)) && (
              <>
                <Separator className="my-3" />
                <WishlistParser
                  personId={person.id}
                  wishlistUrls={person.wishlistUrls}
                  initialItems={person.wishlistItems || []}
                />
              </>
            )}

            <Separator className="my-3" />
            <PhotoSection
              personId={person.id}
              tier={(session.user as Record<string, unknown>)?.subscriptionTier as string ?? "free"}
            />

            {person.notes && (
              <>
                <Separator className="my-3" />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Notes</h3>
                  <p className="text-sm whitespace-pre-line">{person.notes}</p>
                </div>
              </>
            )}

            <Separator className="my-3" />
            <PersonEventsClient events={events} person={person} people={people} />

            <Separator className="my-3" />
            <GiftHistorySection
              personId={person.id}
              personName={person.name}
              events={events.filter((e) => e.personId === person.id)}
              token={session.accessToken}
              tier={(session.user as Record<string, unknown>)?.subscriptionTier as string ?? "free"}
            />

            <Separator className="my-3" />
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                Never Again List
              </h3>
              {person.neverAgainItems.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  {VOICE.emptyStates.neverAgain}
                </p>
              ) : (
                <ul className="space-y-1">
                  {person.neverAgainItems.map((item) => (
                    <li key={item.id} className="text-sm flex items-center gap-2">
                      <span className="text-destructive">&#x2717;</span>
                      {item.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
