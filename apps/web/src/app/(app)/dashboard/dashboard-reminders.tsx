"use client";

import type { Reminder } from "@/lib/api";
import { ReminderBannerList } from "@/components/reminder-banner";

export function DashboardReminders({ reminders }: { reminders: Reminder[] }) {
  return <ReminderBannerList reminders={reminders} />;
}
