import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { UpcomingEvent, GiftRecord } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Gift as GiftIcon } from "lucide-react";
import { EventDetailActions } from "./event-detail-actions";
import { SuggestionsView } from "@/components/suggestions/suggestions-view";
import { StarRating } from "@/components/gifts/star-rating";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function dollars(cents: number | null) {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

function countdownLabel(days: number) {
  if (days === 0) return "TODAY";
  if (days === 1) return "TOMORROW";
  return `${days} days`;
}

function urgencyClass(days: number) {
  if (days <= 1) return "bg-red text-white";
  if (days <= 7) return "bg-amber-glow text-amber border-amber-3";
  if (days <= 29) return "bg-amber-glow text-amber";
  return "bg-secondary text-muted-foreground";
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  let events: UpcomingEvent[] = [];
  try {
    const res = await api.getUpcomingEvents(session.accessToken, { limit: 100 });
    events = res.data;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      redirect("/login");
    }
    notFound();
  }

  const event = events.find((e) => e.id === id);
  if (!event) notFound();

  // S-5 shipped after this page was first built — it was never wired up to
  // actually show gifts scoped to this event, just left as a placeholder.
  let eventGifts: GiftRecord[] = [];
  try {
    const giftsRes = await api.getPersonGifts(session.accessToken, event.personId, { limit: 100 });
    eventGifts = giftsRes.data.filter((g) => g.eventId === event.id);
  } catch {
    // Non-critical — the rest of the page still renders without gift history.
  }

  const budgetStr =
    event.budgetMinCents || event.budgetMaxCents
      ? `${dollars(event.budgetMinCents) || "$0"} \u2013 ${dollars(event.budgetMaxCents) || "..."}`
      : null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/events">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Events
            </Button>
          </Link>
          <EventDetailActions
            eventId={event.id}
            personId={event.personId}
            eventName={event.name}
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {initials(event.personName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                href={`/people/${event.personId}`}
                className="text-lg font-semibold hover:underline"
              >
                {event.personName}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="secondary" className="capitalize">
                  {event.occasionType}
                </Badge>
                {event.isAutoCreated && (
                  <Badge variant="secondary" className="text-xs">auto</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">{event.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(event.nextOccurrence)}
                </p>
              </div>
              <Badge
                className={urgencyClass(event.daysUntil)}
                aria-label={`${countdownLabel(event.daysUntil)} remaining`}
              >
                {countdownLabel(event.daysUntil)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Recurrence</span>
                <p className="font-medium capitalize">{event.recurrenceRule.replace("_", "-")}</p>
              </div>
              {budgetStr && (
                <div>
                  <span className="text-muted-foreground">Budget</span>
                  <p className="font-medium">{budgetStr}</p>
                </div>
              )}
            </div>

            {event.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notes</span>
                <p className="mt-1 whitespace-pre-line">&ldquo;{event.notes}&rdquo;</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gift Ideas — S-4 Gift Brain */}
        <SuggestionsView
          eventId={event.id}
          personId={event.personId}
          personName={event.personName}
          token={session.accessToken}
          tier={(session.user as Record<string, unknown>)?.subscriptionTier as "free" | "pro" | "elite" ?? "free"}
        />

        {/* Past Gifts — S-5 Gift History, scoped to this event */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Past Gifts for This Event</CardTitle>
            <Link
              href={`/people/${event.personId}`}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              View all history for {event.personName} →
            </Link>
          </CardHeader>
          <CardContent>
            {eventGifts.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No gifts logged for this event yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {eventGifts
                  .sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime())
                  .map((gift) => (
                    <li
                      key={gift.id}
                      className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-none last:pb-0"
                    >
                      <div className="flex items-start gap-2.5">
                        <GiftIcon className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{gift.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(gift.givenAt)}
                            {dollars(gift.priceCents) ? ` · ${dollars(gift.priceCents)}` : ""}
                          </p>
                        </div>
                      </div>
                      {gift.rating !== null && (
                        <StarRating value={gift.rating} readonly size="sm" />
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
