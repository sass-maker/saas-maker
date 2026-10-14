'use client';

import type { AnyFeedbackStatus, FeedbackRecord, FeedbackType } from '@saas-maker/contracts';
import { useState } from 'react';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { useApiResource, useCockpitResources } from '@/components/cockpit-resources';
import { ResourceView } from '@/components/resource-view';
import { FeedbackTableSkeleton } from '@/components/table-skeleton';
import { FeedbackTable } from '@/components/feedback-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

type InboxRecord = FeedbackRecord & { project_name: string; project_slug: string };

export function FeedbackBoard() {
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [status, setStatus] = useState<AnyFeedbackStatus | 'all'>('all');
  const query = new URLSearchParams();
  if (type !== 'all') query.set('type', type);
  if (status !== 'all') query.set('status', status);
  const resource = useApiResource<{ data: InboxRecord[] }>(`/v1/feedback?${query}`, {
    isEmpty: (result) => (result.data ?? []).length === 0,
  });
  const { invalidate } = useCockpitResources();

  async function updateStatus(item: FeedbackRecord, nextStatus: AnyFeedbackStatus) {
    const token = await getClientToken();
    const updated = await apiFetchClient<FeedbackRecord>(`/v1/feedback/${item.id}`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    resource.mutate((result) => ({
      data: (result?.data ?? []).map((candidate) =>
        candidate.id === updated.id ? { ...candidate, status: updated.status } : candidate
      ),
    }));
    invalidate('/v1/feedback?');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={type} onValueChange={(value) => setType(value as FeedbackType | 'all')}>
          <SelectTrigger className="w-[160px]" aria-label="filter feedback by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bugs</SelectItem>
            <SelectItem value="feature">Features</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as AnyFeedbackStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]" aria-label="filter feedback by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
            <SelectItem value="on_roadmap">On roadmap</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          disabled={resource.status === 'loading' || resource.isRevalidating}
          onClick={() => void resource.retry()}
        >
          Refresh
        </Button>
      </div>

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
        {(result) => <FeedbackTable feedback={result.data ?? []} onStatusChange={updateStatus} />}
      </ResourceView>
    </div>
  );
}
