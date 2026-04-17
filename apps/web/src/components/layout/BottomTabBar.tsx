"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  Trophy,
} from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Radar", icon: LayoutDashboard },
  { href: "/people", label: "Assets", icon: Users },
  { href: "/events", label: "Brain", icon: Calendar },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/profile", label: "Score", icon: Trophy },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-s1"
      style={{
        borderTop: "1px solid var(--border2)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Main navigation"
      role="tablist"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px]"
              style={{
                color: active ? "var(--amber)" : "var(--muted2)",
                fontFamily: "var(--font-mono)",
                fontSize: "8px",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
