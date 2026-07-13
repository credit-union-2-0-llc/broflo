import Link from "next/link";
import type { Person } from "@broflo/shared";
import type { AutopilotRule, GiftRecord } from "@/lib/api";

const CYAN = "#22d3ee";

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function dollars(cents: number | null) {
  if (cents === null) return null;
  return `$${(cents / 100).toFixed(0)}`;
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

interface PersonContextSidebarProps {
  person: Person;
  autopilotRule: AutopilotRule | null;
  recentGifts: GiftRecord[];
}

export function PersonContextSidebar({ person, autopilotRule, recentGifts }: PersonContextSidebarProps) {
  const budgetStr =
    person.budgetMinCents || person.budgetMaxCents
      ? `${dollars(person.budgetMinCents) || "$0"} – ${dollars(person.budgetMaxCents) || "…"}`
      : null;
  const avoidList = person.neverAgainItems ?? [];

  return (
    <aside className="flex flex-col gap-4.5 lg:sticky lg:top-[84px]">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-5">
        <h4 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7c85a0]">
          About {person.name}
        </h4>
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-[#2a1400]"
            style={{ background: "linear-gradient(135deg, #ffc24b, #ff8fa3)" }}
          >
            {initials(person.name)}
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[#eef2fa]">{person.name}</div>
            <div className="text-xs capitalize text-[#7c85a0]">{person.relationship}</div>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {budgetStr && (
            <div className="flex justify-between text-[12.5px]">
              <span className="text-[#7c85a0]">Budget</span>
              <span className="font-semibold text-[#eef2fa]">{budgetStr}</span>
            </div>
          )}
          {person.clothingSizeTop && (
            <div className="flex justify-between text-[12.5px]">
              <span className="text-[#7c85a0]">Top size</span>
              <span className="font-semibold text-[#eef2fa]">{person.clothingSizeTop}</span>
            </div>
          )}
          {person.favoriteBrands && (
            <div className="flex justify-between gap-3 text-[12.5px]">
              <span className="shrink-0 text-[#7c85a0]">Favorite brands</span>
              <span className="truncate text-right font-semibold text-[#eef2fa]">{person.favoriteBrands}</span>
            </div>
          )}
          {avoidList.length > 0 && (
            <div className="flex justify-between gap-3 text-[12.5px]">
              <span className="shrink-0 text-[#7c85a0]">Avoid</span>
              <span className="truncate text-right font-semibold text-[#eef2fa]">
                {avoidList.map((a) => a.description).join(", ")}
              </span>
            </div>
          )}
        </div>
        <Link
          href={`/people/${person.id}`}
          className="mt-3 inline-block text-xs hover:underline"
          style={{ color: CYAN }}
        >
          View full profile →
        </Link>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-5">
        <h4 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7c85a0]">
          Autopilot
        </h4>
        {autopilotRule?.isActive ? (
          <>
            <div className="mb-2.5 flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full"
                style={{ background: CYAN, boxShadow: `0 0 6px ${CYAN}` }}
              />
              <span className="text-[13px] font-semibold text-[#eef2fa]">On standby</span>
            </div>
            <p className="text-xs leading-relaxed text-[#7c85a0]">
              Will act automatically on {person.name}&rsquo;s next matching occasion under{" "}
              {dollars(autopilotRule.budgetMaxCents)}.
            </p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-[#7c85a0]">
            No autopilot rule set up for {person.name} yet.
          </p>
        )}
        <Link href="/autopilot" className="mt-3 inline-block text-xs hover:underline" style={{ color: CYAN }}>
          Manage rule →
        </Link>
      </div>

      {recentGifts.length > 0 && (
        <div className="rounded-[22px] border border-white/10 bg-white/[0.055] backdrop-blur-[22px] p-5">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7c85a0]">
            Recent Activity
          </h4>
          <div className="flex flex-col">
            {recentGifts.map((g, i) => (
              <div
                key={g.id}
                className={`flex justify-between gap-3 py-1.5 text-xs ${i > 0 ? "border-t border-white/10" : ""}`}
              >
                <span className="truncate text-[#b9c0d4]">{g.title}</span>
                <span className="shrink-0 text-[#7c85a0]">{timeAgo(g.givenAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
