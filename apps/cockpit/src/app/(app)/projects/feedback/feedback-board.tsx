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

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'bug', label: 'Bugs' },
  { value: 'feature', label: 'Features' },
  { value: 'feedback', label: 'Feedback' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'on_roadmap', label: 'On roadmap' },
] as const;

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
            <SelectValue placeholder="Type">
              {TYPE_OPTIONS.find((option) => option.value === type)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as AnyFeedbackStatus | 'all')}
        >
          <SelectTrigger className="w-[180px]" aria-label="filter feedback by status">
            <SelectValue placeholder="Status">
              {STATUS_OPTIONS.find((option) => option.value === status)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
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
