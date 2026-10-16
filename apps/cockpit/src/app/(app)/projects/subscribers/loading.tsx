import { PageHeader } from '@/components/page-header';
import { SubscribersTableSkeleton } from '@/components/table-skeleton';
import { Skeleton } from '@saas-maker/ui/components/skeleton';

export default function SubscribersLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeader
        title="Subscribers"
        description="Consented newsletter and waitlist sign-ups captured across products."
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-[180px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-8 w-20" />
        </div>
        <SubscribersTableSkeleton />
      </div>
    </div>
  );
}
