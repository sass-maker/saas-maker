'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'feedback', label: 'Feedback' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'on_roadmap', label: 'On Roadmap' },
] as const;

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = searchParams.get('type') ?? 'all';
  const status = searchParams.get('status') ?? 'all';

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={type} onValueChange={(v) => updateParam('type', v)}>
        <SelectTrigger className="w-[140px]">
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

      <Select value={status} onValueChange={(v) => updateParam('status', v)}>
        <SelectTrigger className="w-[160px]">
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
    </div>
  );
}
