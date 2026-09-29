import { Card, Skeleton } from "@csmju2030/design-system";

/** Skeletons shaped like the real screens, so nothing jumps when data lands. */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <div className="flex flex-col gap-4" aria-hidden>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-label="กำลังโหลดข้อมูล">
      <PageHeaderSkeleton />
      <ListSkeleton />
    </div>
  );
}
