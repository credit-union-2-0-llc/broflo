"use client";

import Link from "next/link";
import type { UpcomingEvent } from "@/lib/api";

interface ThreatRowProps {
  event: UpcomingEvent;
  index: number;
  gridCols: string;
}

function urgencyColor(days: number) {
  if (days <= 7) return "var(--red)";
  if (days <= 21) return "var(--amber)";
  return "var(--green-bright)";
}

function statusTag(days: number) {
  if (days <= 3) return { label: "CRITICAL", bg: "var(--red-dim)", color: "var(--red)", border: "rgba(220, 38, 38, 0.3)" };
  if (days <= 14) return { label: "WARNING", bg: "var(--amber-glow)", color: "var(--amber)", border: "var(--amber3)" };
  return { label: "ON TRACK", bg: "var(--green-dim)", color: "var(--green-bright)", border: "rgba(34, 197, 94, 0.3)" };
}

function formatBudget(minCents: number | null, maxCents: number | null) {
  if (!minCents && !maxCents) return "—";
  const min = minCents ? `$${Math.round(minCents / 100)}` : "";
  const max = maxCents ? `$${Math.round(maxCents / 100)}` : "";
  if (min && max) return `${min}–${max}`;
  return min || max;
}

export function ThreatRow({ event, index, gridCols }: ThreatRowProps) {
  const color = urgencyColor(event.daysUntil);
  const tag = statusTag(event.daysUntil);

  return (
    <Link
      href={`/events/${event.id}`}
      className="grid items-center min-h-[52px] transition-[background] duration-100 hover:bg-s2"
      style={{
        gridTemplateColumns: gridCols,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Row number */}
      <span
        className="text-center text-[18px] font-black"
        style={{ fontFamily: "var(--font-display)", color: "var(--border3)" }}
      >
        {index}
      </span>

      {/* Urgency bar */}
      <div
        className="h-full w-[6px]"
        style={{ background: color, borderRadius: "1px" }}
      />

      {/* Identity */}
      <div className="px-3 py-2.5">
        <div
          className="text-[17px] font-bold"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: ".5px",
            color: "var(--cream)",
          }}
        >
          {event.personName}
        </div>
        <div
          className="text-[9px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)" }}
        >
          {event.occasionType} &middot; {event.name}
        </div>
      </div>

      {/* Days out */}
      <div className="text-center">
        <div
          className="text-[32px] font-black leading-none"
          style={{ fontFamily: "var(--font-display)", color }}
        >
          {event.daysUntil}
        </div>
        <div
          className="text-[7px] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: ".1em",
            color: "var(--muted)",
          }}
        >
          days
        </div>
      </div>

      {/* Status tag */}
      <div className="flex justify-center">
        <span
          className="text-[8px] uppercase px-2 py-[3px]"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: ".08em",
            background: tag.bg,
            color: tag.color,
            border: `1px solid ${tag.border}`,
          }}
        >
          {tag.label}
        </span>
      </div>

      {/* Budget */}
      <div
        className="text-center text-[10px]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)" }}
      >
        {formatBudget(event.budgetMinCents, event.budgetMaxCents)}
      </div>

      {/* Action */}
      <div className="flex justify-end pr-3">
        <span
          className="text-[8px] font-bold uppercase px-3 py-1.5"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: ".1em",
            background: event.daysUntil <= 14 ? "var(--amber)" : "transparent",
            color: event.daysUntil <= 14 ? "#000" : "var(--muted2)",
            border: event.daysUntil <= 14 ? "none" : "1px solid var(--border3)",
          }}
        >
          {event.daysUntil <= 14 ? "Find Gift" : "Browse"}
        </span>
      </div>
    </Link>
  );
}
