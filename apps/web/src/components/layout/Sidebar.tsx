"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  Zap,
  Trophy,
  Settings,
  LogOut,
} from "lucide-react";

const sections = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Radar", icon: LayoutDashboard },
      { href: "/people", label: "Assets", icon: Users },
      { href: "/events", label: "Threat Board", icon: Calendar },
      { href: "/orders", label: "Orders", icon: Package },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/autopilot", label: "Autopilot", icon: Zap },
      { href: "/profile", label: "Score", icon: Trophy },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/billing", label: "Billing", icon: Settings },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="hidden md:flex flex-col bg-s1 overflow-y-auto"
      style={{ borderRight: "1px solid var(--border2)" }}
    >
      <nav className="flex-1 py-4">
        {sections.map((section) => (
          <div key={section.label}>
            <div
              className="xl:px-[18px] px-0 pt-4 pb-1.5 text-[8px] uppercase xl:block hidden"
              style={{
                color: "var(--muted)",
                letterSpacing: ".18em",
                fontFamily: "var(--font-mono)",
              }}
            >
              {section.label}
            </div>
            <div className="xl:hidden pt-3 first:pt-0" />
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="flex items-center xl:gap-2.5 gap-0 h-[38px] xl:px-[18px] px-0 xl:justify-start justify-center transition-all duration-[120ms]"
                  style={{
                    borderLeft: active
                      ? "2px solid var(--amber)"
                      : "2px solid transparent",
                    background: active ? "var(--amber-glow)" : undefined,
                    color: active ? "var(--amber)" : "var(--muted2)",
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "var(--s2)";
                      e.currentTarget.style.color = "var(--cream)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "";
                      e.currentTarget.style.color = "var(--muted2)";
                    }
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="xl:inline hidden">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Autopilot status footer */}
      <div
        className="mx-2.5 mb-3 px-2.5 py-[7px] xl:block hidden"
        style={{
          background: "var(--green-dim)",
          border: "1px solid rgba(34, 197, 94, 0.2)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="ap-dot" />
          <span
            className="text-[8px] uppercase"
            style={{
              color: "var(--green-bright)",
              letterSpacing: ".12em",
              fontFamily: "var(--font-mono)",
            }}
          >
            Autopilot armed
          </span>
        </div>
        <span
          className="text-[9px] mt-0.5 block"
          style={{
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Monitoring all assets
        </span>
      </div>
      {/* Icon-only autopilot indicator at lg */}
      <div
        className="xl:hidden flex justify-center mb-3"
      >
        <div className="ap-dot" />
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center xl:gap-2 gap-0 xl:px-[18px] px-0 xl:justify-start justify-center py-3 transition-colors duration-[120ms]"
        style={{
          color: "var(--muted)",
          fontSize: "11px",
          fontFamily: "var(--font-body)",
          borderTop: "1px solid var(--border)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--red)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--muted)";
        }}
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        <span className="xl:inline hidden">Sign out</span>
      </button>
    </aside>
  );
}
