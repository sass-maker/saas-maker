import { PageHeader } from '@/components/page-header';
import { SubscribersTableSkeleton } from '@/components/table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscribersLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading subscribers">
      <PageHeader
        title="Subscribers"
        description="Consented newsletter and waitlist sign-ups captured across products."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3" aria-hidden="true">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-8 w-20" />
        </div>
        <SubscribersTableSkeleton />
      </div>
    </div>
  );
}
