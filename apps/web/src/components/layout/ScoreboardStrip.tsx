"use client";

import { useSession } from "next-auth/react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const stats = [
  { label: "Due Soon", sub: "next 24h", color: "var(--coral)", key: "dueSoon" },
  { label: "People", sub: "tracked", color: "var(--cyan)", key: "people" },
] as const;

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface ScoreboardStripProps {
  peopleCount: number;
  dueSoonCount: number;
}

export function ScoreboardStrip({ peopleCount, dueSoonCount }: ScoreboardStripProps) {
  const { data: session } = useSession();
  const user = session?.user;

  const statValues: Record<string, string> = {
    dueSoon: String(dueSoonCount),
    people: String(peopleCount),
  };

  return (
    <header className="col-span-full border-b border-border bg-white/[0.03] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 lg:px-6 h-16">
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-heading text-2xl font-black tracking-wide text-cream">
            BRO<span className="text-cyan">FLO</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {stats.map((stat) => (
            <div
              key={stat.key}
              className="flex items-center gap-2 rounded-full border border-border bg-white/[0.04] px-3.5 py-1.5"
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: stat.color }}
              />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-sm font-semibold tabular-nums text-cream">
                {statValues[stat.key]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell />
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-white/[0.04] py-1 pl-1 pr-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-coral text-[11px] font-bold text-[#04222a]">
              {initials(user?.name)}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-cream">{user?.name || "Agent"}</span>
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="uppercase text-amber">
                  {user?.subscriptionTier === "free" || !user?.subscriptionTier ? "FREE" : user.subscriptionTier}
                </span>
                <span className="ap-dot" />
                online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: compact stat row */}
      <div className="flex md:hidden items-center gap-2 px-4 pb-3">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-white/[0.04] py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: stat.color }} />
            <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            <span className="text-xs font-semibold tabular-nums text-cream">{statValues[stat.key]}</span>
          </div>
        ))}
      </div>
    </header>
  );
}
