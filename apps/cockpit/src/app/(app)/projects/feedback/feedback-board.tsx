'use client';

import type { AnyFeedbackStatus, FeedbackRecord, FeedbackType } from '@saas-maker/contracts';
import { useState } from 'react';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import {
  useApiResource,
  useCockpitResources,
  type ResourceSeed,
} from '@/components/cockpit-resources';
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
import Link from 'next/link';

type InboxRecord = FeedbackRecord & { project_name: string; project_slug: string };
export type FeedbackInboxData = { data: InboxRecord[] };
export type FeedbackBoardSeed = ResourceSeed<FeedbackInboxData>;
const DEFAULT_FEEDBACK_RESOURCE = '/v1/feedback?';

export function seedForFeedbackResource(path: string, seed: FeedbackBoardSeed): FeedbackBoardSeed {
  return path === DEFAULT_FEEDBACK_RESOURCE ? seed : {};
}

export function FeedbackEmptyState({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        title="No matching feedback"
        description="No submissions match these filters. Clear them to see the full inbox."
        primaryAction={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      title="No feedback yet"
      description="New submissions from the hosted widget will appear here. Set up a feedback project and install the widget to get started."
      primaryAction={
        <Button asChild variant="outline">
          <Link href="/projects">Set up a feedback project</Link>
        </Button>
      }
    />
  );
}

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

export function FeedbackBoard(seed: FeedbackBoardSeed = {}) {
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [status, setStatus] = useState<AnyFeedbackStatus | 'all'>('all');
  const query = new URLSearchParams();
  if (type !== 'all') query.set('type', type);
  if (status !== 'all') query.set('status', status);
  const path = `/v1/feedback?${query}`;
  const resource = useApiResource<FeedbackInboxData>(path, {
    ...seedForFeedbackResource(path, seed),
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
          <FeedbackEmptyState
            filtered={type !== 'all' || status !== 'all'}
            onClearFilters={() => {
              setType('all');
              setStatus('all');
            }}
          />
        }
      >
        {(result) => <FeedbackTable feedback={result.data ?? []} onStatusChange={updateStatus} />}
      </ResourceView>
    </div>
  );
}
