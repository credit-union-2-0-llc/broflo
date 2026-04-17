"use client";

import { useSession } from "next-auth/react";

const stats = [
  { label: "Broflo Score", sub: "lifetime", color: "var(--amber)", key: "score" },
  { label: "Code Red", sub: "this month", color: "var(--red)", key: "codeRed" },
  { label: "Mission Rate", sub: "on-time %", color: "var(--green-bright)", key: "missionRate" },
  { label: "Active Assets", sub: "people", color: "var(--blue)", key: "assets" },
] as const;

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function ScoreboardStrip() {
  const { data: session } = useSession();
  const user = session?.user;

  const statValues: Record<string, string> = {
    score: String(user?.brofloScore ?? 0),
    codeRed: "0",
    missionRate: "—",
    assets: "0",
  };

  return (
    <header
      className="col-span-full grid bg-s1 border-b"
      style={{
        gridTemplateColumns: "auto 1fr 1fr 1fr 1fr auto",
        borderColor: "var(--border2)",
      }}
    >
      {/* Logo cell */}
      <div
        className="flex flex-col justify-center px-6"
        style={{ borderRight: "1px solid var(--border2)" }}
      >
        <span
          className="font-[var(--font-display)] text-[34px] font-black uppercase"
          style={{ color: "var(--amber)", letterSpacing: "3px", fontFamily: "var(--font-display)" }}
        >
          BROFLO
        </span>
        <span
          className="font-[var(--font-mono)] text-[8px] uppercase"
          style={{ color: "var(--muted)", letterSpacing: ".18em", fontFamily: "var(--font-mono)" }}
        >
          War Room
        </span>
      </div>

      {/* Stat cells */}
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="relative flex flex-col justify-center px-5 py-3"
          style={{ borderRight: "1px solid var(--border2)" }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: stat.color }}
          />
          <span
            className="text-[8px] uppercase"
            style={{
              color: "var(--muted)",
              letterSpacing: ".14em",
              fontFamily: "var(--font-mono)",
            }}
          >
            {stat.label}
          </span>
          <span
            className="text-[44px] font-black leading-none"
            style={{
              color: stat.color,
              fontFamily: "var(--font-display)",
            }}
          >
            {statValues[stat.key]}
          </span>
          <span
            className="mt-[3px] text-[8px]"
            style={{
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {stat.sub}
          </span>
        </div>
      ))}

      {/* User cell */}
      <div className="flex items-center gap-3 px-5">
        <div
          className="flex h-[38px] w-[38px] items-center justify-center"
          style={{
            border: "1px solid var(--amber3)",
            background: "var(--amber-glow)",
          }}
        >
          <span
            className="text-[16px] font-extrabold"
            style={{ color: "var(--amber)", fontFamily: "var(--font-display)" }}
          >
            {initials(user?.name)}
          </span>
        </div>
        <div className="flex flex-col">
          <span
            className="text-[17px] font-bold"
            style={{
              color: "var(--cream)",
              letterSpacing: ".5px",
              fontFamily: "var(--font-display)",
            }}
          >
            {user?.name || "Agent"}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[8px] uppercase"
              style={{ color: "var(--amber)", fontFamily: "var(--font-mono)" }}
            >
              {user?.subscriptionTier === "pro" ? "PRO" : "FREE"}
            </span>
            <div className="ap-dot" />
            <span
              className="text-[8px]"
              style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)" }}
            >
              online
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
