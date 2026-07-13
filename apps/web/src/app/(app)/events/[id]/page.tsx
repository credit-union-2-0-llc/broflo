import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { UpcomingEvent, GiftRecord, AutopilotRule } from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Gift as GiftIcon } from "lucide-react";
import { EventDetailActions } from "./event-detail-actions";
import { SuggestionsView } from "@/components/suggestions/suggestions-view";
import { PersonContextSidebar } from "@/components/suggestions/person-context-sidebar";
import { StarRating } from "@/components/gifts/star-rating";

const CYAN = "#22d3ee";

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

function urgencyColor(days: number) {
  if (days <= 1) return "#ff8fa3";
  if (days <= 7) return "#ffc24b";
  if (days <= 29) return "#ffc24b";
  return "#7c85a0";
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
  let allPersonGifts: GiftRecord[] = [];
  try {
    const giftsRes = await api.getPersonGifts(session.accessToken, event.personId, { limit: 100 });
    allPersonGifts = giftsRes.data;
  } catch {
    // Non-critical — the rest of the page still renders without gift history.
  }
  const eventGifts = allPersonGifts.filter((g) => g.eventId === event.id);
  const recentGifts = [...allPersonGifts]
    .sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime())
    .slice(0, 3);

  const person = await api.getPerson(session.accessToken, event.personId).catch(() => null);

  let autopilotRule: AutopilotRule | null = null;
  try {
    const rules = await api.listRules(session.accessToken);
    autopilotRule = rules.find((r) => r.personId === event.personId) ?? null;
  } catch {
    // Non-critical — sidebar shows "no rule set up"
  }

  const budgetStr =
    event.budgetMinCents || event.budgetMaxCents
      ? `${dollars(event.budgetMinCents) || "$0"} – ${dollars(event.budgetMaxCents) || "..."}`
      : null;

  return (
    <div className="relative -m-4 lg:-m-5 overflow-hidden bg-[#0b0e14] p-4 lg:p-8">
      {/* aurora wash, contained to this page */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30" aria-hidden="true">
        <div className="absolute -left-[8%] -top-[12%] h-[44vw] w-[44vw] rounded-full bg-[#06b6d4] blur-[80px]" />
        <div className="absolute -right-[10%] top-[4%] h-[38vw] w-[38vw] rounded-full bg-[#fb7185] blur-[80px]" />
        <div className="absolute -bottom-[18%] left-[22%] h-[40vw] w-[40vw] rounded-full bg-[#f5a524] blur-[80px]" />
      </div>

      <div className="mx-auto max-w-[1160px]">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#7c85a0] hover:text-[#eef2fa] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Link>
          <EventDetailActions
            eventId={event.id}
            personId={event.personId}
            eventName={event.name}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
          <div className="min-w-0 space-y-5">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarFallback className="bg-white/10 text-[#eef2fa] text-lg font-bold">
                    {initials(event.personName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Link
                    href={`/people/${event.personId}`}
                    className="text-lg font-semibold text-[#eef2fa] hover:underline"
                  >
                    {event.personName}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize border-white/10 bg-white/[0.06] text-[#b9c0d4]">
                      {event.occasionType}
                    </Badge>
                    {event.isAutoCreated && (
                      <Badge variant="secondary" className="text-xs border-white/10 bg-white/[0.06] text-[#b9c0d4]">auto</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[#eef2fa]">{event.name}</h2>
                  <p className="mt-1 text-sm text-[#7c85a0]">{formatDate(event.nextOccurrence)}</p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11.5px] font-bold"
                  style={{ color: urgencyColor(event.daysUntil), background: "rgba(255,255,255,0.06)" }}
                  aria-label={`${countdownLabel(event.daysUntil)} remaining`}
                >
                  {countdownLabel(event.daysUntil)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-[#7c85a0]">Recurrence</span>
                  <p className="font-medium capitalize text-[#eef2fa]">{event.recurrenceRule.replace("_", "-")}</p>
                </div>
                {budgetStr && (
                  <div>
                    <span className="text-[#7c85a0]">Budget</span>
                    <p className="font-medium text-[#eef2fa]">{budgetStr}</p>
                  </div>
                )}
              </div>

              {event.notes && (
                <div className="mt-4 text-sm">
                  <span className="text-[#7c85a0]">Notes</span>
                  <p className="mt-1 whitespace-pre-line text-[#b9c0d4]">&ldquo;{event.notes}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Gift Ideas — S-4 Gift Brain */}
            <SuggestionsView
              eventId={event.id}
              personId={event.personId}
              personName={event.personName}
              token={session.accessToken}
              tier={(session.user as Record<string, unknown>)?.subscriptionTier as "free" | "pro" | "elite" | "family" ?? "free"}
            />

            {/* Past Gifts — S-5 Gift History, scoped to this event */}
            <div className="rounded-[26px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-[#eef2fa]">Past Gifts for This Event</h3>
                <Link
                  href={`/people/${event.personId}`}
                  className="text-xs text-[#7c85a0] hover:text-[#eef2fa] hover:underline transition-colors"
                >
                  View all history for {event.personName} →
                </Link>
              </div>
              <div className="mt-4">
                {eventGifts.length === 0 ? (
                  <p className="text-sm italic text-[#7c85a0]">
                    No gifts logged for this event yet.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {eventGifts
                      .sort((a, b) => new Date(b.givenAt).getTime() - new Date(a.givenAt).getTime())
                      .map((gift) => (
                        <li
                          key={gift.id}
                          className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-none last:pb-0"
                        >
                          <div className="flex items-start gap-2.5">
                            <GiftIcon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: CYAN }} />
                            <div>
                              <p className="text-sm font-medium text-[#eef2fa]">{gift.title}</p>
                              <p className="text-xs text-[#7c85a0]">
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
              </div>
            </div>
          </div>

          {person && (
            <PersonContextSidebar
              person={person}
              autopilotRule={autopilotRule}
              recentGifts={recentGifts}
            />
          )}
        </div>
      </div>
    </div>
  );
}
