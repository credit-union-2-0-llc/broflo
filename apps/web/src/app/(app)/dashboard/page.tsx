import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { UpcomingEvent, Reminder, GiftRecord, Order } from "@/lib/api";
import { ThreatRoster } from "@/components/radar/ThreatRoster";
import { DashboardReminders } from "./dashboard-reminders";
import { RecentGiftsWidget } from "@/components/gifts/recent-gifts-widget";
import { OrdersInFlightWidget } from "@/components/dashboard/OrdersInFlightWidget";

type RecentGift = GiftRecord & { personName: string; eventName: string | null };
type FlightOrder = Order & { person: { name: string } };

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let events: UpcomingEvent[] = [];
  let reminders: Reminder[] = [];
  let recentGifts: RecentGift[] = [];
  let flightOrders: FlightOrder[] = [];
  let flightTotal = 0;

  try {
    // "In-flight" = ordered/processing/shipped. One query with all three
    // statuses instead of three separate calls: fewer round-trips and DB
    // queries on the landing page, and correctly the 3 most-recent across all
    // three statuses (the old "3 of each, then slice(0,3)" could drop a newer
    // shipped order behind three older ordered ones).
    const [eventsRes, remindersRes, recentGiftsRes, inFlight] = await Promise.all([
      api.getUpcomingEvents(session.accessToken, { limit: 10 }),
      api.getReminders(session.accessToken),
      api.getRecentGifts(session.accessToken),
      api.getOrders(session.accessToken, { status: "ordered,processing,shipped", limit: 3 }),
    ]);
    events = eventsRes.data;
    reminders = remindersRes;
    recentGifts = recentGiftsRes.gifts;
    flightOrders = inFlight.data;
    flightTotal = inFlight.meta.total;
  } catch {
    // Graceful degradation — widgets show empty state
  }

  return (
    <>
      {reminders.length > 0 && (
        <DashboardReminders reminders={reminders} />
      )}

      <ThreatRoster events={events} />

      <RecentGiftsWidget token={session.accessToken} initialGifts={recentGifts} />

      <OrdersInFlightWidget
        token={session.accessToken}
        initialOrders={flightOrders}
        initialTotal={flightTotal}
      />
    </>
  );
}
