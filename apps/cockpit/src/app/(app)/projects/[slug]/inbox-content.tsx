'use client';

import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { useApiResource, useCockpitResources } from '@/components/cockpit-resources';
import { ResourceView } from '@/components/resource-view';
import { useSearchParams } from 'next/navigation';
import { FilterBar } from '@/components/filter-bar';
import { FeedbackTableSkeleton } from '@/components/table-skeleton';
import { FeedbackTable } from '@/components/feedback-table';
import type { FeedbackRecord, AnyFeedbackStatus } from '@saas-maker/contracts';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

interface InboxContentProps {
  projectId: string;
}

export function InboxContent({ projectId }: InboxContentProps) {
  const searchParams = useSearchParams();

  const typeFilter = searchParams.get('type') ?? 'all';
  const statusFilter = searchParams.get('status') ?? 'all';

  const params = new URLSearchParams({ project: projectId });
  if (typeFilter !== 'all') params.set('type', typeFilter);
  if (statusFilter !== 'all') params.set('status', statusFilter);
  const resource = useApiResource<{ data: FeedbackRecord[] }>(`/v1/feedback?${params}`, {
    isEmpty: (result) => (result.data ?? []).length === 0,
  });
  const { invalidate } = useCockpitResources();

  async function handleStatusChange(item: FeedbackRecord, status: AnyFeedbackStatus) {
    const token = await getClientToken();
    const updated = await apiFetchClient<FeedbackRecord>(`/v1/feedback/${item.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    resource.mutate((result) => ({
      data: (result?.data ?? []).map((candidate) =>
        candidate.id === item.id ? { ...candidate, ...updated } : candidate
      ),
    }));
    invalidate('/v1/feedback?');
  }

  return (
    <div className="space-y-4">
      <FilterBar />
      <ResourceView
        resource={resource}
        skeleton={<FeedbackTableSkeleton />}
        empty={
          <EmptyState
            title="no matching feedback"
            description="new submissions from the hosted widget appear here."
          />
        }
      >
        {(result) => (
          <FeedbackTable feedback={result.data ?? []} onStatusChange={handleStatusChange} />
        )}
      </ResourceView>
    </div>
  );
}
