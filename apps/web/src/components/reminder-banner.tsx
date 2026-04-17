"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Reminder } from "@/lib/api";
import { VOICE } from "@broflo/shared";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, X, Gift, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

function reminderCopy(reminder: Reminder) {
  const name = reminder.event.person.name;
  if (reminder.leadDays === 30) return VOICE.alerts.thirtyDay(name);
  if (reminder.leadDays === 7) return VOICE.alerts.sevenDay(name);
  if (reminder.leadDays === 1) return VOICE.alerts.oneDay(name);
  return VOICE.alerts.missedEvent;
}

function reminderStyle(leadDays: number) {
  if (leadDays === 1)
    return {
      bg: "bg-red-dim border-l-4 border-red",
      icon: AlertCircle,
      iconClass: "text-red",
    };
  if (leadDays === 7)
    return {
      bg: "bg-amber-glow border-l-4 border-amber",
      icon: Bell,
      iconClass: "text-amber",
    };
  return {
    bg: "bg-amber-glow border-l-4 border-amber",
    icon: Bell,
    iconClass: "text-amber",
  };
}

export function ReminderBanner({ reminder }: { reminder: Reminder }) {
  const { data: session } = useSession();
  const router = useRouter();
  const style = reminderStyle(reminder.leadDays);
  const Icon = style.icon;

  async function handleDismiss() {
    if (!session) return;
    try {
      await api.dismissReminder(session.accessToken, reminder.id);
      router.refresh();
    } catch {
      toast.error("Failed to dismiss reminder.");
    }
  }

  return (
    <div
      className={cn("flex items-start gap-3 p-4 rounded-lg relative", style.bg)}
      role="alert"
      aria-live="polite"
    >
      <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", style.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{reminderCopy(reminder)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a href={`/events/${reminder.eventId}`}>
          <Button variant="default" size="sm" className="text-xs gap-1">
            {reminder.leadDays === 0 ? (
              <><ClipboardList className="h-3.5 w-3.5" /> Record Gift</>
            ) : (
              <><Gift className="h-3.5 w-3.5" /> Find Gifts</>
            )}
          </Button>
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDismiss}
          aria-label="Dismiss reminder"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ReminderBannerList({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) return null;
  return (
    <div className="space-y-2">
      {reminders.map((r) => (
        <ReminderBanner key={r.id} reminder={r} />
      ))}
    </div>
  );
}
