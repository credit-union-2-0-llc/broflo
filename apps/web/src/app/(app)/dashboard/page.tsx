import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { UpcomingEvent, Reminder } from "@/lib/api";
import { ComingUpWidget } from "@/components/coming-up-widget";
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
      api.getUpcomingEvents(session.accessToken, { limit: 5 }),
      api.getReminders(session.accessToken),
    ]);
    events = eventsRes.data;
    reminders = remindersRes;
  } catch {
    // Graceful degradation — widgets show empty state
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>

        {reminders.length > 0 && (
          <div className="mb-6">
            <DashboardReminders reminders={reminders} />
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          <BrofloScoreWidget score={session.user?.brofloScore ?? 0} />
          <ComingUpWidget events={events} />
        </div>

        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 sm:grid-cols-2">
          <RecentGiftsWidget token={session.accessToken} />
          <OrdersInFlightWidget token={session.accessToken} />
        </div>
      </div>
    </div>
  );
}
