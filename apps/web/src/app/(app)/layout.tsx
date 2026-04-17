import { ScoreboardStrip } from "@/components/layout/ScoreboardStrip";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[48px_1fr] xl:grid-cols-[200px_1fr] grid-rows-[auto_1fr] min-h-screen">
      <ScoreboardStrip />
      <Sidebar />
      <main className="overflow-y-auto p-4 lg:p-5 flex flex-col gap-[18px] pb-20 lg:pb-5">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
