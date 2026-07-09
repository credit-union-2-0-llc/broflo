import { Skeleton } from "@/components/ui/skeleton";

// Generic fallback shown instantly on navigation while a page's server
// component fetches its data — without this, Next.js has nothing to render
// until the fetch resolves, so every navigation feels frozen rather than
// responsive. Routes with a more specific loading.tsx override this one.
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
