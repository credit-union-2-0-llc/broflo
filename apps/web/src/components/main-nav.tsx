"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LayoutDashboard, Users, Calendar, Package, User, Trophy, LogOut, Sparkles, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/people", label: "People", icon: Users },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/orders", label: "Orders", icon: Package },
] as const;

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MainNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const user = session?.user;

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Desktop: Top Nav Bar */}
      <nav
        className="hidden md:flex items-center justify-between h-14 border-b px-4 bg-background sticky top-0 z-50"
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            broflo.
          </Link>
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  isActive(tab.href)
                    ? "text-broflo-electric font-semibold bg-broflo-electric-subtle"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-current={isActive(tab.href) ? "page" : undefined}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <Trophy className="h-3.5 w-3.5 text-broflo-gold" />
            {user?.brofloScore ?? 0}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none">
              <Avatar className="h-8 w-8 cursor-pointer">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials(user?.name)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => window.location.href = "/profile"}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              {user?.subscriptionTier === "free" ? (
                <DropdownMenuItem
                  className="cursor-pointer text-broflo-electric"
                  onClick={() => window.location.href = "/upgrade"}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Upgrade
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => window.location.href = "/billing"}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Billing
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Mobile: Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 h-14 border-t bg-background z-50 safe-area-pb"
        aria-label="Main navigation"
        role="tablist"
      >
        <div className="flex items-center justify-around h-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 text-xs transition-colors",
                  active
                    ? "text-broflo-electric font-semibold"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </Link>
            );
          })}
          <Link
            href="/profile"
            role="tab"
            aria-current={isActive("/profile") ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 text-xs transition-colors",
              isActive("/profile")
                ? "text-broflo-electric font-semibold"
                : "text-muted-foreground"
            )}
          >
            <User className="h-5 w-5" />
            Profile
          </Link>
        </div>
      </nav>
    </>
  );
}
