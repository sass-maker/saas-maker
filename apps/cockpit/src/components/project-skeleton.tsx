import { Skeleton, SkeletonContainer } from '@saas-maker/ui/components/skeleton';
import { FeedbackTableSkeleton } from '@/components/table-skeleton';

// These cards and credentials differ from the library's generic card/detail blocks.
export function ProjectsSkeleton() {
  return (
    <SkeletonContainer className="grid gap-3" aria-label="loading projects">
      {[1, 2, 3].map((row) => (
        <div key={row} className="overflow-hidden rounded-xl border bg-card">
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="size-11 shrink-0" />
              <div className="min-w-0 space-y-1">
                <Skeleton className="h-6 w-40 max-w-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-64 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
          <div className="grid gap-2 border-t bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3].map((field) => (
              <Skeleton key={field} className="h-4 w-32" />
            ))}
          </div>
        </div>
      ))}
    </SkeletonContainer>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <SkeletonContainer className="space-y-6" aria-label="loading project">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-40" />
      </div>
      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-medium">project key</h2>
          <p className="text-sm text-muted-foreground">
            Publishable identifier for hosted widget submissions. It cannot read the inbox.
          </p>
          <div className="mt-2 flex items-start gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          <div>
            <h2 className="text-sm font-medium">agent tokens</h2>
            <p className="text-sm text-muted-foreground">
              Scoped Bearer tokens for the same JSON API. New tokens are read-only unless write
              access is enabled.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-9 w-56" />
            </div>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-8 w-56 max-w-full" />
        </div>
      </section>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
        <FeedbackTableSkeleton announce={false} />
      </div>
    </SkeletonContainer>
  );
}
