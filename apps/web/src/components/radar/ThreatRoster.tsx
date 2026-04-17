import Link from "next/link";
import type { UpcomingEvent } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import { SectionHeader } from "./SectionHeader";
import { ThreatRow } from "./ThreatRow";
import { Calendar, Plus } from "lucide-react";

interface ThreatRosterProps {
  events: UpcomingEvent[];
}

const GRID_COLS = "28px 6px 1fr 90px 90px 80px 110px";

export function ThreatRoster({ events }: ThreatRosterProps) {
  return (
    <div>
      <SectionHeader
        title="Threat Board"
        count={events.length}
        countLabel="events"
        actionLabel="Add Event +"
        actionHref="/events"
      />

      {events.length === 0 ? (
        <div
          className="text-center py-10 border"
          style={{ borderColor: "var(--border)", background: "var(--s1)" }}
        >
          <Calendar
            className="mx-auto h-8 w-8 mb-3"
            style={{ color: "var(--border3)" }}
          />
          <p
            className="text-sm italic"
            style={{ color: "var(--muted2)", fontFamily: "var(--font-body)" }}
          >
            {VOICE.emptyStates.events}
          </p>
          <Link
            href="/events"
            className="inline-flex items-center gap-1.5 mt-4 text-[9px] uppercase px-3 py-1.5 min-h-[44px] min-w-[44px] items-center"
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
              color: "#000",
              background: "var(--amber)",
            }}
          >
            <Plus className="h-3 w-3" />
            Add Event
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop: table layout */}
          <div className="hidden md:block">
            {/* Header row */}
            <div
              className="grid items-center py-2"
              style={{
                gridTemplateColumns: GRID_COLS,
                background: "var(--s2)",
                borderBottom: "1px solid var(--border2)",
              }}
            >
              <span />
              <span />
              <span className="px-3 text-[8px] uppercase" style={headerStyle}>
                Name / Event
              </span>
              <span className="text-center text-[8px] uppercase" style={headerStyle}>
                Days Out
              </span>
              <span className="text-center text-[8px] uppercase" style={headerStyle}>
                Status
              </span>
              <span className="text-center text-[8px] uppercase" style={headerStyle}>
                Budget
              </span>
              <span className="text-right pr-3 text-[8px] uppercase" style={headerStyle}>
                Action
              </span>
            </div>

            {events.map((event, i) => (
              <ThreatRow
                key={event.id}
                event={event}
                index={i + 1}
                gridCols={GRID_COLS}
                mode="table"
              />
            ))}
          </div>

          {/* Mobile: card stack */}
          <div className="md:hidden flex flex-col gap-2">
            {events.map((event, i) => (
              <ThreatRow
                key={event.id}
                event={event}
                index={i + 1}
                gridCols={GRID_COLS}
                mode="card"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  letterSpacing: ".12em",
  color: "var(--muted)",
};
