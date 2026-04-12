"use client";

import { useState, useEffect } from "react";

const CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useCancelCountdown(placedAt: string | null): {
  secondsLeft: number;
  canCancel: boolean;
  formatted: string;
} {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!placedAt) return 0;
    const elapsed = Date.now() - new Date(placedAt).getTime();
    return Math.max(0, Math.floor((CANCEL_WINDOW_MS - elapsed) / 1000));
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        const next = s - 1;
        if (next <= 0) {
          clearInterval(interval);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft > 0]); // re-attach only when crossing the 0 boundary

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const secs = secondsLeft % 60;
  const formatted =
    hours > 0
      ? `${hours}h ${minutes}m`
      : minutes > 0
        ? `${minutes}m ${secs}s`
        : `${secs}s`;

  return { secondsLeft, canCancel: secondsLeft > 0, formatted };
}
