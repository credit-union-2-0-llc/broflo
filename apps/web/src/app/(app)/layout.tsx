import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { ScoreboardStrip } from "@/components/layout/ScoreboardStrip";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // A refresh token that's genuinely invalid (revoked, or from before a
  // migration that couldn't carry old sessions forward) can never succeed
  // on its own — every page load just fails the same way forever with no
  // way out. Force a real re-login instead of leaving the user stuck.
  if (session?.error === "RefreshTokenError") {
    redirect("/login");
  }

  let peopleCount = 0;
  let dueSoonCount = 0;

  if (session?.accessToken) {
    try {
      // This layout wraps every authenticated page, so these run on every
      // navigation. The header only needs the due-soon COUNT, so ask the API
      // for exactly that (days=1 → meta.total) instead of pulling up to 100
      // event rows and filtering them in JS every time. days=1 matches the old
      // `daysUntil <= 1` filter: upcoming() bounds on `nextOccurrence <= today
      // + days` with no lower bound, so overdue events are counted the same way.
      const [people, dueSoonRes] = await Promise.all([
        api.listPersons(session.accessToken),
        api.getUpcomingEvents(session.accessToken, { days: 1, limit: 1 }),
      ]);
      peopleCount = people.length;
      dueSoonCount = dueSoonRes.meta.total;
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
