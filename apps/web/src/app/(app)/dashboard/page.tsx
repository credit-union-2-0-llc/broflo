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
    const [eventsRes, remindersRes, recentGiftsRes, ordered, processing, shipped] = await Promise.all([
      api.getUpcomingEvents(session.accessToken, { limit: 10 }),
      api.getReminders(session.accessToken),
      api.getRecentGifts(session.accessToken),
      api.getOrders(session.accessToken, { status: "ordered", limit: 3 }),
      api.getOrders(session.accessToken, { status: "processing", limit: 3 }),
      api.getOrders(session.accessToken, { status: "shipped", limit: 3 }),
    ]);
    events = eventsRes.data;
    reminders = remindersRes;
    recentGifts = recentGiftsRes.gifts;
    flightOrders = [...ordered.data, ...processing.data, ...shipped.data].slice(0, 3);
    flightTotal = ordered.meta.total + processing.meta.total + shipped.meta.total;
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
