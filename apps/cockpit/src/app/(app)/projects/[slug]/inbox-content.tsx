'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const qs = params.toString();
      const token = await getClientToken();
      const data = await apiFetchClient<{ data: FeedbackRecord[] }>(
        `/v1/feedback?project=${encodeURIComponent(projectId)}${qs ? `&${qs}` : ''}`,
        token
      );
      setFeedback(data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [projectId, typeFilter, statusFilter]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  async function handleStatusChange(item: FeedbackRecord, status: AnyFeedbackStatus) {
    const token = await getClientToken();
    const updated = await apiFetchClient<FeedbackRecord>(`/v1/feedback/${item.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setFeedback((prev) => prev.map((f) => (f.id === item.id ? { ...f, ...updated } : f)));
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <FilterBar />
        <FeedbackTableSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <FilterBar />
        <div className="text-destructive text-center py-8">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar />
      <FeedbackTable feedback={feedback} onStatusChange={handleStatusChange} />
    </div>
  );
}
