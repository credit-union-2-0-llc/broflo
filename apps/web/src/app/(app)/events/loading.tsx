import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <div className="flex flex-col gap-[18px]">
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
