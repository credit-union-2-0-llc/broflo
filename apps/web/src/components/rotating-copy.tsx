"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RotatingCopyProps {
  lines: readonly string[];
  intervalMs: number;
  className?: string;
}

export function RotatingCopy({ lines, intervalMs, className }: RotatingCopyProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % lines.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [lines.length, intervalMs]);

  return (
    <p className={cn("text-sm italic text-muted-foreground", className)} aria-live="polite">
      &ldquo;{lines[index]}&rdquo;
    </p>
  );
}
