"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import type { NotificationItem } from "@/lib/api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const accessToken = session?.accessToken;

  useEffect(() => {
    if (!accessToken) return;
    async function fetchUnread() {
      try {
        const res = await api.getUnreadCount(accessToken);
        setUnread(res.count);
      } catch {
        // silent
      }
    }
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && session?.accessToken) {
      api.listNotifications(session.accessToken, { limit: 10 })
        .then((res) => setNotifications(res.data))
        .catch(() => {});
    }
  }

  async function handleClick(notif: NotificationItem) {
    if (!session?.accessToken) return;
    if (!notif.isRead) {
      try {
        await api.markNotificationRead(session.accessToken, notif.id);
        setUnread((c) => Math.max(0, c - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n)),
        );
      } catch {
        // silent
      }
    }
    if (notif.linkUrl) {
      setOpen(false);
      router.push(notif.linkUrl);
    }
  }

  async function handleMarkAllRead() {
    if (!session?.accessToken) return;
    try {
      await api.markAllNotificationsRead(session.accessToken);
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // silent
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            className="relative inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors focus:outline-none"
            aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0.5 px-1.5 text-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleMarkAllRead();
              }}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          notifications.map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              className="flex flex-col items-start gap-0.5 px-3 py-2 cursor-pointer"
              onClick={() => handleClick(notif)}
            >
              <div className="flex items-center gap-2 w-full">
                {!notif.isRead && (
                  <span className="h-2 w-2 rounded-full bg-broflo-electric shrink-0" />
                )}
                <span className={`text-sm font-medium truncate ${notif.isRead ? "text-muted-foreground" : ""}`}>
                  {notif.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
              <span className="text-[10px] text-muted-foreground/60">{timeAgo(notif.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
