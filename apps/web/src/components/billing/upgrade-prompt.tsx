"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { VOICE } from "@broflo/shared";

interface UpgradePromptProps {
  message?: string;
}

export function UpgradePrompt({ message }: UpgradePromptProps) {
  return (
    <div className="rounded-lg border border-amber-3 bg-amber-glow p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Sparkles className="h-5 w-5 text-amber shrink-0 mt-0.5 sm:mt-0" />
      <p className="text-sm flex-1">
        {message || VOICE.billing.upgradePrompt}
      </p>
      <Link
        href="/upgrade"
        className="inline-flex items-center justify-center rounded-lg h-7 px-2.5 text-[0.8rem] font-medium bg-amber hover:bg-amber-light text-white shrink-0 transition-colors"
      >
        {VOICE.billing.upgradeCta}
      </Link>
    </div>
  );
}
