import { Card, Skeleton } from "@/components/shared/kit";

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

/** Same footprint as the student summary card (three numbers). */
export function SummarySkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-3 divide-x divide-outline-variant/40 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-col items-center gap-2 px-2 py-4 md:py-6">
          <Skeleton className="h-8 w-10" />
          <Skeleton className="h-4 w-20 max-w-full" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Same footprint as a row of three StatCards. */
export function StatsSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 md:p-6">
          <Skeleton className="size-11" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** List rows inside an existing card. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
