import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { UpcomingEvent, Reminder } from "@/lib/api";
import { ThreatRoster } from "@/components/radar/ThreatRoster";
import { DashboardReminders } from "./dashboard-reminders";
import { RecentGiftsWidget } from "@/components/gifts/recent-gifts-widget";
import { BrofloScoreWidget } from "@/components/gifts/broflo-score-widget";
import { OrdersInFlightWidget } from "@/components/dashboard/OrdersInFlightWidget";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let events: UpcomingEvent[] = [];
  let reminders: Reminder[] = [];

  try {
    const [eventsRes, remindersRes] = await Promise.all([
      api.getUpcomingEvents(session.accessToken, { limit: 10 }),
      api.getReminders(session.accessToken),
    ]);
    events = eventsRes.data;
    reminders = remindersRes;
  } catch {
    // Graceful degradation — widgets show empty state
  }

  return (
    <>
      {reminders.length > 0 && (
        <DashboardReminders reminders={reminders} />
      )}

      <ThreatRoster events={events} />

      <div className="grid gap-[18px] sm:grid-cols-2">
        <BrofloScoreWidget score={session.user?.brofloScore ?? 0} />
        <RecentGiftsWidget token={session.accessToken} />
      </div>

      <OrdersInFlightWidget token={session.accessToken} />
    </>
  );
}
