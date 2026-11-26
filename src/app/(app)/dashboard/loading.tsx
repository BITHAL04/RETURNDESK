import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="h-64 p-5 lg:col-span-3">
          <Skeleton className="h-full w-full" />
        </Card>
        <Card className="h-64 p-5 lg:col-span-2">
          <Skeleton className="h-full w-full" />
        </Card>
      </div>
    </div>
  );
}
