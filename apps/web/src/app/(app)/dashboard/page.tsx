import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { UpcomingEvent, Reminder } from "@/lib/api";
import { ComingUpWidget } from "@/components/coming-up-widget";
import { DashboardReminders } from "./dashboard-reminders";
import { RecentGiftsWidget } from "@/components/gifts/recent-gifts-widget";
import { BrofloScoreWidget } from "@/components/gifts/broflo-score-widget";

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
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        </div>

        {reminders.length > 0 && (
          <div className="mb-6">
            <DashboardReminders reminders={reminders} />
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <BrofloScoreWidget score={session.user?.brofloScore ?? 0} />
          <ComingUpWidget events={events} />
        </div>

        <div className="mt-6">
          <RecentGiftsWidget token={session.accessToken} />
        </div>
      </div>
    </div>
  );
}
