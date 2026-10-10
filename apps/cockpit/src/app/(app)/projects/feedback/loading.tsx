import { PageHeader } from '@/components/page-header';
import { FeedbackTableSkeleton } from '@/components/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function FeedbackLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading feedback inbox">
      <PageHeader
        title="Feedback inbox"
        description="Review customer requests across products using the SaaS Maker feedback package."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-8 w-20" />
        </div>
        <FeedbackTableSkeleton />
      </div>
    </div>
  );
}
