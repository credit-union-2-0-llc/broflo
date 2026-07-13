import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ScoreboardStrip } from "@/components/layout/ScoreboardStrip";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  let peopleCount = 0;
  let dueSoonCount = 0;

  if (session?.accessToken) {
    try {
      const [people, eventsRes] = await Promise.all([
        api.listPersons(session.accessToken),
        api.getUpcomingEvents(session.accessToken, { limit: 100 }),
      ]);
      peopleCount = people.length;
      dueSoonCount = eventsRes.data.filter((e) => e.daysUntil <= 1).length;
    } catch {
      // Graceful degradation — header shows zero counts
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[48px_1fr] xl:grid-cols-[200px_1fr] grid-rows-[auto_1fr] min-h-screen">
      <div className="aurora-wash" aria-hidden="true">
        <div className="b1" />
        <div className="b2" />
        <div className="b3" />
      </div>
      <ScoreboardStrip peopleCount={peopleCount} dueSoonCount={dueSoonCount} />
      <Sidebar />
      <main className="overflow-y-auto p-4 lg:p-5 flex flex-col gap-[18px] pb-20 lg:pb-5">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
