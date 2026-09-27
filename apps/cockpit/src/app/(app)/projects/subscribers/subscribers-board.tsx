'use client';

import { useCallback, useEffect, useState } from 'react';
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

interface SubscribersBoardProps {
  projects: ProjectOption[];
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

export function SubscribersBoard({ projects }: SubscribersBoardProps) {
  const [subscribers, setSubscribers] = useState<SubscriptionRecord[]>([]);
  const [project, setProject] = useState<string>(projects[0]?.slug ?? '');
  const [kind, setKind] = useState<SubscriptionKind | 'all'>('all');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const query = new URLSearchParams();
      query.set('project', project);
      if (kind !== 'all') query.set('kind', kind);
      if (cursor) query.set('cursor', cursor);
      return query;
    },
    [kind, project]
  );

  const load = useCallback(
    async (activeToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFetchClient<SubscriptionsResponse>(
          `/v1/subscriptions?${buildQuery().toString()}`,
          activeToken
        );
        setSubscribers(result.data ?? []);
        setNextCursor(result.next_cursor ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to load subscribers');
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    if (!project) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getClientToken()
      .then((activeToken) => {
        if (cancelled) return;
        setToken(activeToken);
        return load(activeToken);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to authenticate. Please sign in again.');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, project]);

  async function loadMore() {
    if (!token || !nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await apiFetchClient<SubscriptionsResponse>(
        `/v1/subscriptions?${buildQuery(nextCursor).toString()}`,
        token
      );
      setSubscribers((existing) => [...existing, ...(result.data ?? [])]);
      setNextCursor(result.next_cursor ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load more subscribers');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={project} onValueChange={setProject} disabled={projects.length === 0}>
          <SelectTrigger className="w-[180px]" aria-label="Filter subscribers by project">
            <SelectValue placeholder="Project" />
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
            <SelectValue placeholder="Kind" />
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
          disabled={!token || !project || loading}
          onClick={() => token && load(token)}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No feedback projects are available. Create a project before collecting subscribers.
        </p>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading subscribers…</p>
      ) : error && subscribers.length === 0 ? null : subscribers.length === 0 ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
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
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                  No subscribers yet. Consented sign-ups from the widget appear here.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <Table>
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
                      <TableCell className="font-medium">{item.email}</TableCell>
                      <TableCell>
                        <Badge variant={kindStyle.variant}>{kindStyle.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
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
          {nextCursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={!token || loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
