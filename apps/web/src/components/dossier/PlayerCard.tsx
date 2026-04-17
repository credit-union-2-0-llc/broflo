import Link from "next/link";

interface PlayerCardProps {
  id: string;
  index: number;
  name: string;
  relationship: string;
  tags?: { id: string; tag: string }[];
  nextEventDays?: number | null;
  nextEventLabel?: string | null;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  autopilot?: boolean;
}

function urgencyColor(days: number | null | undefined) {
  if (days == null) return "var(--muted)";
  if (days < 7) return "var(--red)";
  if (days <= 21) return "var(--amber)";
  return "var(--green-bright)";
}

function formatBudget(minCents: number | null | undefined, maxCents: number | null | undefined) {
  if (!minCents && !maxCents) return "—";
  const min = minCents ? `$${Math.round(minCents / 100)}` : "";
  const max = maxCents ? `$${Math.round(maxCents / 100)}` : "";
  if (min && max) return `${min}–${max}`;
  return min || max;
}

export function PlayerCard({
  id,
  index,
  name,
  relationship,
  tags = [],
  nextEventDays,
  nextEventLabel,
  budgetMinCents,
  budgetMaxCents,
  autopilot = false,
}: PlayerCardProps) {
  return (
    <Link
      href={`/people/${id}`}
      className="transition-[border-color] duration-[120ms]"
      style={{
        border: "1px solid var(--border2)",
        background: "var(--s1)",
        display: "block",
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border3)";
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)";
      }}
    >
      {/* Desktop: 3-column grid */}
      <div className="hidden md:grid" style={{ gridTemplateColumns: "auto 1fr auto" }}>
        {/* Number column */}
        <div
          className="flex items-center justify-center min-w-[48px] p-3"
          style={{
            background: "var(--s2)",
            borderRight: "1px solid var(--border2)",
          }}
        >
          <span
            className="text-[36px] font-black"
            style={{ fontFamily: "var(--font-display)", color: "var(--border3)" }}
          >
            {index}
          </span>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <div
            className="text-[22px] font-extrabold"
            style={{
              fontFamily: "var(--font-display)",
              letterSpacing: ".5px",
              color: "var(--cream)",
            }}
          >
            {name}
          </div>
          <div
            className="mt-[3px] text-[8px] uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              letterSpacing: ".12em",
              color: "var(--muted2)",
            }}
          >
            {relationship}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-[5px] mt-[7px]">
              {tags.slice(0, 5).map((t) => (
                <span
                  key={t.id}
                  className="text-[7px] uppercase px-[7px] py-[2px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: ".08em",
                    background: "var(--s3)",
                    border: "1px solid var(--border2)",
                    color: "var(--muted2)",
                  }}
                >
                  {t.tag}
                </span>
              ))}
              {autopilot && (
                <span
                  className="text-[7px] uppercase px-[7px] py-[2px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: ".08em",
                    background: "var(--amber-glow)",
                    border: "1px solid var(--amber3)",
                    color: "var(--amber)",
                  }}
                >
                  Autopilot ON
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats column */}
        <div
          className="flex flex-col items-end justify-center gap-2 px-4 py-3"
          style={{ borderLeft: "1px solid var(--border2)" }}
        >
          <div className="text-right">
            <div
              className="text-[22px] font-extrabold"
              style={{
                fontFamily: "var(--font-display)",
                color: nextEventDays != null ? urgencyColor(nextEventDays) : "var(--muted)",
              }}
            >
              {nextEventDays != null ? `${nextEventDays}d` : "—"}
            </div>
            <div
              className="text-[7px] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                color: "var(--muted)",
              }}
            >
              {nextEventLabel || "next event"}
            </div>
          </div>
          <div className="w-5 h-px" style={{ background: "var(--border2)" }} />
          <div className="text-right">
            <div
              className="text-[22px] font-extrabold"
              style={{ fontFamily: "var(--font-display)", color: "var(--cream)" }}
            >
              {formatBudget(budgetMinCents, budgetMaxCents)}
            </div>
            <div
              className="text-[7px] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                color: "var(--muted)",
              }}
            >
              budget
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: stacked layout */}
      <div className="md:hidden p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div
              className="text-[18px] font-extrabold truncate"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: ".5px",
                color: "var(--cream)",
              }}
            >
              {name}
            </div>
            <div
              className="mt-[2px] text-[8px] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: ".12em",
                color: "var(--muted2)",
              }}
            >
              {relationship}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div
              className="text-[22px] font-extrabold"
              style={{
                fontFamily: "var(--font-display)",
                color: nextEventDays != null ? urgencyColor(nextEventDays) : "var(--muted)",
              }}
            >
              {nextEventDays != null ? `${nextEventDays}d` : "—"}
            </div>
            <div
              className="text-[7px] uppercase"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                color: "var(--muted)",
              }}
            >
              {nextEventLabel || "next event"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-[9px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)" }}
          >
            {formatBudget(budgetMinCents, budgetMaxCents)}
          </span>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-[4px]">
              {tags.slice(0, 3).map((t) => (
                <span
                  key={t.id}
                  className="text-[7px] uppercase px-[6px] py-[2px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: ".08em",
                    background: "var(--s3)",
                    border: "1px solid var(--border2)",
                    color: "var(--muted2)",
                  }}
                >
                  {t.tag}
                </span>
              ))}
            </div>
          )}
          {autopilot && (
            <span
              className="text-[7px] uppercase px-[6px] py-[2px]"
              style={{
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                background: "var(--amber-glow)",
                border: "1px solid var(--amber3)",
                color: "var(--amber)",
              }}
            >
              AP
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
