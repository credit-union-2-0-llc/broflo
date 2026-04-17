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

  const mobileStats = stats.filter((s) => s.key === "score" || s.key === "codeRed");

  return (
    <header
      className="col-span-full bg-s1 border-b"
      style={{ borderColor: "var(--border2)" }}
    >
      {/* Desktop: full strip */}
      <div
        className="hidden md:grid"
        style={{ gridTemplateColumns: "auto 1fr 1fr 1fr 1fr auto" }}
      >
        {/* Logo cell */}
        <div
          className="flex flex-col justify-center xl:px-6 px-3"
          style={{ borderRight: "1px solid var(--border2)" }}
        >
          <span
            className="font-black uppercase xl:text-[34px] text-[24px]"
            style={{ color: "var(--amber)", letterSpacing: "3px", fontFamily: "var(--font-display)" }}
          >
            BROFLO
          </span>
          <span
            className="text-[8px] uppercase xl:block hidden"
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
              className="xl:text-[44px] text-[32px] font-black leading-none"
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
            className="flex h-[38px] w-[38px] items-center justify-center shrink-0"
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
          <div className="flex flex-col xl:block hidden">
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
      </div>

      {/* Mobile: collapsed strip — Score + Code Red only */}
      <div
        className="md:hidden grid items-center"
        style={{ gridTemplateColumns: "auto 1fr 1fr auto" }}
      >
        <div
          className="flex items-center justify-center px-3 py-2"
          style={{ borderRight: "1px solid var(--border2)" }}
        >
          <span
            className="font-black uppercase text-[20px]"
            style={{ color: "var(--amber)", letterSpacing: "2px", fontFamily: "var(--font-display)" }}
          >
            BF
          </span>
        </div>

        {mobileStats.map((stat) => (
          <div
            key={stat.key}
            className="relative flex flex-col justify-center px-3 py-2"
            style={{ borderRight: "1px solid var(--border2)" }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: stat.color }}
            />
            <span
              className="text-[7px] uppercase"
              style={{
                color: "var(--muted)",
                letterSpacing: ".12em",
                fontFamily: "var(--font-mono)",
              }}
            >
              {stat.label}
            </span>
            <span
              className="text-[28px] font-black leading-none"
              style={{
                color: stat.color,
                fontFamily: "var(--font-display)",
              }}
            >
              {statValues[stat.key]}
            </span>
          </div>
        ))}

        <div
          className="flex items-center justify-center px-3"
        >
          <div
            className="flex h-[32px] w-[32px] items-center justify-center"
            style={{
              border: "1px solid var(--amber3)",
              background: "var(--amber-glow)",
            }}
          >
            <span
              className="text-[13px] font-extrabold"
              style={{ color: "var(--amber)", fontFamily: "var(--font-display)" }}
            >
              {initials(user?.name)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
