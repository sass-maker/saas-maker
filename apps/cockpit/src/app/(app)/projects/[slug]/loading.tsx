import { FeedbackTableSkeleton } from '@/components/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading project">
      <div aria-hidden="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-40" />
      </div>
      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-medium">Project key</h2>
          <p className="text-sm text-muted-foreground">
            Publishable identifier for hosted widget submissions. It cannot read the inbox.
          </p>
          <div className="mt-2 flex items-start gap-2" aria-hidden="true">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          <div>
            <h2 className="text-sm font-medium">Agent tokens</h2>
            <p className="text-sm text-muted-foreground">
              Scoped Bearer tokens for the same JSON API. New tokens are read-only unless write
              access is enabled.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3" aria-hidden="true">
            <div className="space-y-1">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-9 w-56" />
            </div>
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="h-5 w-56 max-w-full" aria-hidden="true" />
        </div>
      </section>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3" aria-hidden="true">
          <Skeleton className="h-9 w-[140px]" />
          <Skeleton className="h-9 w-[160px]" />
        </div>
        <FeedbackTableSkeleton />
      </div>
    </div>
  );
}
