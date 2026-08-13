"use client";

import { useRouter } from "next/navigation";

/**
 * A same-page "Try Again" link's href points at the current route, which
 * Next.js's router treats as a no-op navigation — it never re-runs the
 * server component's data fetch. This forces an actual re-render.
 */
export function RetryButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className={className}
    >
      Try Again
    </button>
  );
}
