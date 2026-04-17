import { ScoreboardStrip } from "@/components/layout/ScoreboardStrip";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[200px_1fr] grid-rows-[auto_1fr] min-h-screen">
      <ScoreboardStrip />
      <Sidebar />
      <main className="overflow-y-auto p-5 flex flex-col gap-[18px]">
        {children}
      </main>
    </div>
  );
}
