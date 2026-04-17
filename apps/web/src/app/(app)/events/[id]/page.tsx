import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { UpcomingEvent } from "@/lib/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft } from "lucide-react";
import { EventDetailActions } from "./event-detail-actions";
import { SuggestionsView } from "@/components/suggestions/suggestions-view";

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
  } catch {
    notFound();
  }

  const event = events.find((e) => e.id === id);
  if (!event) notFound();

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

        {/* Past Gifts — placeholder for S-5 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past Gifts for This Event</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              No gift history yet. (Gift History activates in S-5)
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
