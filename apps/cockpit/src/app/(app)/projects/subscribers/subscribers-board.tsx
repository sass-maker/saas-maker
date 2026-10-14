'use client';

import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@saas-maker/ui/components/empty-state';
import { Skeleton } from '@saas-maker/ui/components/skeleton';
import type { ResourceResult } from '@saas-maker/ui/lib/use-resource';
import { useApiResource, useProjectsResource } from '@/components/cockpit-resources';
import { LoadError, ResourceView } from '@/components/resource-view';
import { visibleDashboardProjects } from '@/lib/dashboard-projects';
import { subscribersTableShape, SubscribersTableSkeleton } from '@/components/table-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetchClient, getClientToken } from '@/lib/api-client';

type SubscriptionKind = 'newsletter' | 'waitlist';

interface SubscriptionRecord {
  id: string;
  kind: SubscriptionKind;
  email: string;
  source: string | null;
  state: string;
  consent_version: string | null;
  consented_at: string | null;
  created_at: string;
  // unsubscribe_token is intentionally never rendered or logged.
}

interface SubscriptionsResponse {
  data: SubscriptionRecord[];
  next_cursor: string | null;
}

interface ProjectOption {
  name: string;
  slug: string;
}

const KIND_STYLES: Record<SubscriptionKind, { label: string; variant: 'default' | 'secondary' }> = {
  newsletter: { label: 'Newsletter', variant: 'default' },
  waitlist: { label: 'Waitlist', variant: 'secondary' },
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SubscribersBoard() {
  const resource = useProjectsResource();
  return (
    <ResourceView
      resource={resource}
      skeleton={
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-9 w-[180px]" />
            <Skeleton className="h-9 w-[160px]" />
            <Skeleton className="h-8 w-20" />
          </div>
          <SubscribersTableSkeleton />
        </div>
      }
      empty={
        <EmptyState
          title="no feedback projects are available"
          description="create a project before collecting subscribers."
        />
      }
    >
      {(result) => <SubscribersContent projects={visibleDashboardProjects(result.data ?? [])} />}
    </ResourceView>
  );
}

function SubscribersContent({ projects }: { projects: ProjectOption[] }) {
  const [projectFilter, setProject] = useState('');
  const project = projectFilter || projects[0]?.slug || '';
  const [kind, setKind] = useState<SubscriptionKind | 'all'>('all');
  const query = new URLSearchParams({ project });
  if (kind !== 'all') query.set('kind', kind);
  const path = `/v1/subscriptions?${query}`;
  const resource = useApiResource<SubscriptionsResponse>(path, {
    isEmpty: (result) => (result.data ?? []).length === 0,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={project} onValueChange={setProject} disabled={projects.length === 0}>
          <SelectTrigger className="w-[180px]" aria-label="Filter subscribers by project">
            <SelectValue placeholder="Project">
              {projects.find((option) => option.slug === project)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {projects.map((option) => (
              <SelectItem key={option.slug} value={option.slug}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={(value) => setKind(value as SubscriptionKind | 'all')}>
          <SelectTrigger className="w-[160px]" aria-label="Filter subscribers by kind">
            <SelectValue placeholder="Kind">
              {kind === 'all' ? 'All kinds' : KIND_STYLES[kind].label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="newsletter">Newsletter</SelectItem>
            <SelectItem value="waitlist">Waitlist</SelectItem>
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
        skeleton={<SubscribersTableSkeleton />}
        empty={
          <EmptyState
            title="no subscribers yet"
            description="consented sign-ups from the widget appear here."
          />
        }
      >
        {(result) => <SubscriberTable key={path} path={path} result={result} resource={resource} />}
      </ResourceView>
    </div>
  );
}

function SubscriberTable({
  path,
  result,
  resource,
}: {
  path: string;
  result: SubscriptionsResponse;
  resource: ResourceResult<SubscriptionsResponse>;
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const subscribers = result.data ?? [];
  const nextCursor = result.next_cursor;

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const request = new AbortController();
    controller.current = request;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await apiFetchClient<SubscriptionsResponse>(
        `${path}&cursor=${encodeURIComponent(nextCursor)}`,
        await getClientToken(request.signal),
        { signal: request.signal }
      );
      resource.mutate((current) => ({
        data: [...(current?.data ?? []), ...(page.data ?? [])],
        next_cursor: page.next_cursor ?? null,
      }));
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause : new Error('request failed'));
    } finally {
      if (!request.signal.aborted) setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className={`min-h-[242px] overflow-x-auto rounded-md border ${subscribersTableShape}`}>
        <Table containerLabel="Subscribers table">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead className="w-[120px]">Kind</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
              <TableHead className="w-[120px]">State</TableHead>
              <TableHead className="hidden md:table-cell w-[140px]">Consented</TableHead>
              <TableHead className="hidden md:table-cell w-[140px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map((item) => {
              const kindStyle = KIND_STYLES[item.kind] ?? {
                label: item.kind,
                variant: 'outline' as const,
              };
              return (
                <TableRow key={item.id}>
                  <TableCell className="break-all whitespace-normal font-medium">
                    {item.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={kindStyle.variant}>{kindStyle.label}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell break-all whitespace-normal text-muted-foreground">
                    {item.source || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.state}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(item.consented_at)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {formatDate(item.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {error && <LoadError retry={loadMore} />}
      {nextCursor && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore || resource.isRevalidating}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
