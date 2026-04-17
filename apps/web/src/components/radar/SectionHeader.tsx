interface SectionHeaderProps {
  title: string;
  count?: number;
  countLabel?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function SectionHeader({
  title,
  count,
  countLabel = "events",
  actionLabel,
  actionHref,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h2
        className="text-xl font-extrabold uppercase"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "0.1em",
          color: "var(--cream)",
        }}
      >
        {title}
      </h2>
      {count !== undefined && (
        <span
          className="text-[8px] uppercase px-2 py-0.5"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: ".14em",
            color: "var(--muted)",
            background: "var(--s2)",
            border: "1px solid var(--border2)",
          }}
        >
          {count} {countLabel}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: "var(--border2)" }} />
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="text-[9px] uppercase cursor-pointer"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: ".1em",
            color: "var(--amber)",
            borderBottom: "1px solid var(--amber3)",
          }}
        >
          {actionLabel}
        </a>
      )}
    </div>
  );
}
