"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { tierAtLeast, type SubscriptionTier } from "@broflo/shared";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Package,
  Zap,
  User,
  Settings,
  LogOut,
  Heart,
  Sparkles,
} from "lucide-react";

const sections = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/people", label: "People", icon: Users },
      { href: "/events", label: "Events", icon: Calendar },
      { href: "/orders", label: "Orders", icon: Package },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/autopilot", label: "Autopilot", icon: Zap, requiresTier: "pro" as SubscriptionTier },
      { href: "/profile", label: "Profile", icon: User },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/family", label: "Family", icon: Heart, requiresTier: "family" as SubscriptionTier },
      { href: "/billing", label: "Billing", icon: Settings },
      // Only the highest tier has nothing left to upgrade to.
      { href: "/upgrade", label: "Upgrade", icon: Sparkles, hideAtTier: "family" as SubscriptionTier },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const tier = session?.user?.subscriptionTier || "free";

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function isVisible(item: object) {
    const { requiresTier, hideAtTier } = item as {
      requiresTier?: SubscriptionTier;
      hideAtTier?: SubscriptionTier;
    };
    if (requiresTier && !tierAtLeast(tier, requiresTier)) return false;
    if (hideAtTier && tier === hideAtTier) return false;
    return true;
  }

  return (
    <aside className="hidden lg:flex flex-col border-r border-border bg-white/[0.02] backdrop-blur-xl overflow-y-auto">
      <nav className="flex-1 py-4 px-2">
        {sections.map((section) => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-1">
              <div className="xl:block hidden px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {section.label}
              </div>
              <div className="xl:hidden pt-3 first:pt-0" />
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center xl:gap-2.5 gap-0 h-9 xl:px-3 px-0 xl:justify-start justify-center rounded-full transition-colors ${
                      active
                        ? "bg-cyan-dim text-cyan"
                        : "text-muted-foreground hover:bg-white/[0.05] hover:text-cream"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="xl:inline hidden text-[13px] font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Autopilot status footer */}
      <div className="mx-3 mb-3 rounded-2xl border border-border bg-cyan-dim px-3 py-2.5 xl:block hidden">
        <div className="flex items-center gap-1.5">
          <div className="ap-dot" />
          <span className="text-[10px] uppercase tracking-[0.1em] text-cyan">Autopilot armed</span>
        </div>
        <span className="mt-0.5 block text-[10px] text-muted-foreground">Monitoring all assets</span>
      </div>
      <div className="xl:hidden flex justify-center mb-3">
        <div className="ap-dot" />
      </div>

      {/* Sign out */}
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center xl:gap-2 gap-0 xl:px-5 px-0 xl:justify-start justify-center py-3 text-muted-foreground border-t border-border transition-colors hover:text-coral"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        <span className="xl:inline hidden text-xs">Sign out</span>
      </button>
    </aside>
  );
}
