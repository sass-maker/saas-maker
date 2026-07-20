'use client';

import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Megaphone,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  buildMarketingOpsSummary,
  isMissedMarketingPost,
  matchesMarketingOpsFilter,
  type MarketingOpsFilter,
  parseMarketingMetrics,
  parsePostingFailure,
} from '@/lib/marketing-queue-ops';
import type {
  DistributionViewTone,
  MarketingDistributionView,
} from '@/lib/marketing-distribution-view';
import type {
  MarketingPostChannel,
  MarketingPostRow,
  MarketingPostStatus,
} from '@/lib/marketing-queue-store';

const STATUSES: MarketingPostStatus[] = ['generated', 'accepted', 'rejected', 'sent'];
const CHANNELS: MarketingPostChannel[] = [
  'instagram_reels',
  'youtube_shorts',
  'blog',
  'email',
  'producthunt',
  'x',
  'reddit',
  'other',
];

const STATUS_LABEL: Record<MarketingPostStatus, string> = {
  generated: 'Generated',
  accepted: 'Accepted',
  rejected: 'Rejected',
  sent: 'Sent',
};

const STATUS_CLASS: Record<MarketingPostStatus, string> = {
  generated: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  accepted: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  sent: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
};

const DISTRIBUTION_TONE_CLASS: Record<DistributionViewTone, string> = {
  neutral: 'border-border bg-muted/30 text-muted-foreground',
  info: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  danger: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
};

const OPS_FILTERS: Array<{ value: MarketingOpsFilter; label: string }> = [
  { value: 'all', label: 'All ops' },
  { value: 'missed', label: 'Missed' },
  { value: 'errors', label: 'Errors' },
  { value: 'metrics_pending', label: 'Metrics pending' },
  { value: 'metrics_synced', label: 'Metrics synced' },
];

function postText(post: MarketingPostRow) {
  return [post.hook, post.body, post.cta].filter(Boolean).join('\n\n');
}

function exportMarkdown(posts: MarketingPostRow[]) {
  return posts
    .map((post) =>
      [
        `## ${post.title}`,
        '',
        `- Project: ${post.project_slug ?? 'Unassigned'}`,
        `- Channel: ${post.channel}`,
        `- Status: ${post.status}`,
        post.source_id
          ? `- Source: ${post.source_type}:${post.source_id}`
          : `- Source: ${post.source_type}`,
        '',
        postText(post),
        '',
      ].join('\n')
    )
    .join('\n---\n');
}

function exportCsv(posts: MarketingPostRow[]) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['project', 'channel', 'status', 'title', 'hook', 'body', 'cta', 'source_type', 'source_id'],
    ...posts.map((post) => [
      post.project_slug,
      post.channel,
      post.status,
      post.title,
      post.hook,
      post.body,
      post.cta,
      post.source_type,
      post.source_id,
    ]),
  ];
  return rows.map((row) => row.map(escape).join(',')).join('\n');
}

export function MarketingQueueClient({ initialPosts }: { initialPosts: MarketingPostRow[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [statusFilter, setStatusFilter] = useState<MarketingPostStatus | 'all'>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState<MarketingPostChannel | 'all'>('all');
  const [opsFilter, setOpsFilter] = useState<MarketingOpsFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_slug: '',
    channel: 'instagram_reels' as MarketingPostChannel,
    title: '',
    hook: '',
    body: '',
    cta: '',
  });
  const [scheduleById, setScheduleById] = useState<Record<string, string>>({});

  const projectOptions = useMemo(
    () => Array.from(new Set(posts.map((post) => post.project_slug).filter(Boolean))) as string[],
    [posts]
  );
  const filteredPosts = posts.filter(
    (post) =>
      (statusFilter === 'all' || post.status === statusFilter) &&
      (projectFilter === 'all' || post.project_slug === projectFilter) &&
      (channelFilter === 'all' || post.channel === channelFilter) &&
      matchesMarketingOpsFilter(post, opsFilter)
  );
  const generatedCount = posts.filter((post) => post.status === 'generated').length;
  const acceptedCount = posts.filter((post) => post.status === 'accepted').length;
  const rejectedCount = posts.filter((post) => post.status === 'rejected').length;
  const sentCount = posts.filter((post) => post.status === 'sent').length;
  const distributionReviewCount = posts.filter(
    (post) => post.distribution?.approvalStatus === 'proposed'
  ).length;
  const opsSummary = useMemo(() => buildMarketingOpsSummary(posts), [posts]);
  const topMetrics = useMemo(
    () =>
      [...opsSummary.metricsReady]
        .sort((a, b) => (b.snapshot.metrics.views ?? 0) - (a.snapshot.metrics.views ?? 0))
        .slice(0, 3),
    [opsSummary.metricsReady]
  );
  const distributionViews = posts.flatMap((post) =>
    post.distributionView ? [{ post, view: post.distributionView }] : []
  );
  const evidenceCounts = {
    fresh: distributionViews.filter(({ view }) => view.freshness === 'fresh').length,
    stale: distributionViews.filter(({ view }) => view.freshness === 'stale').length,
    failed: distributionViews.filter(({ view }) => view.freshness === 'failed').length,
    unmeasured: distributionViews.filter(({ view }) => view.freshness === 'unmeasured').length,
  };
  const recommendations = Array.from(
    new Map(
      distributionViews.map(({ view }) => [view.recommendation.title, view.recommendation])
    ).values()
  ).slice(0, 3);

  async function refresh() {
    const res = await fetch('/api/marketing/queue');
    if (!res.ok) throw new Error(await res.text());
    const payload = (await res.json()) as { data: MarketingPostRow[] };
    setPosts(payload.data);
  }

  async function updatePost(id: string, patch: Partial<MarketingPostRow>) {
    const res = await fetch(`/api/marketing/queue/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setMessage('Could not update marketing post');
      return;
    }
    const payload = (await res.json()) as { data: MarketingPostRow };
    setPosts((prev) => prev.map((post) => (post.id === id ? payload.data : post)));
  }

  async function createPost() {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage('Title and body are required.');
      return;
    }
    const res = await fetch('/api/marketing/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        project_slug: form.project_slug || null,
        source_type: 'manual',
      }),
    });
    if (!res.ok) {
      setMessage('Could not create marketing idea');
      return;
    }
    const payload = (await res.json()) as { data: MarketingPostRow };
    setPosts((prev) => [payload.data, ...prev]);
    setForm({
      project_slug: '',
      channel: 'instagram_reels',
      title: '',
      hook: '',
      body: '',
      cta: '',
    });
    setMessage('Idea created.');
  }

  async function deletePost(id: string) {
    const res = await fetch(`/api/marketing/queue/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('Could not delete marketing post');
      return;
    }
    setPosts((prev) => prev.filter((post) => post.id !== id));
  }

  async function generateFromChangelog() {
    setMessage('Generating ideas from recent changelog entries…');
    const res = await fetch('/api/marketing/queue/generate-from-changelog', { method: 'POST' });
    if (!res.ok) {
      setMessage('Could not generate changelog ideas. Check migration/table state.');
      return;
    }
    const payload = (await res.json()) as {
      data: { created: MarketingPostRow[]; skipped: number; scanned: number };
    };
    await refresh();
    setMessage(
      `Generated ${payload.data.created.length} ideas from ${payload.data.scanned} changelog entries. Skipped ${payload.data.skipped} duplicates.`
    );
  }

  async function copyPost(post: MarketingPostRow) {
    await navigator.clipboard.writeText(postText(post));
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function copyExport(format: 'markdown' | 'csv') {
    const text = format === 'markdown' ? exportMarkdown(filteredPosts) : exportCsv(filteredPosts);
    await navigator.clipboard.writeText(text);
    setMessage(`Copied ${filteredPosts.length} ${format.toUpperCase()} rows.`);
  }

  async function markSent() {
    const ids = filteredPosts
      .filter((post) => post.status === 'accepted' && !post.distribution)
      .map((post) => post.id);
    await Promise.all(
      ids.map((id) =>
        updatePost(id, {
          status: 'sent',
          posted_at: new Date().toISOString(),
        } as Partial<MarketingPostRow>)
      )
    );
    setMessage(`Marked ${ids.length} accepted posts as sent.`);
  }

  async function decideDistribution(post: MarketingPostRow, action: 'approve' | 'reject') {
    const localSchedule = scheduleById[post.id];
    const scheduledFor = localSchedule
      ? new Date(localSchedule).toISOString()
      : new Date().toISOString();
    const res = await fetch(`/api/marketing/queue/${post.id}/distribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        ...(action === 'approve' ? { scheduled_for: scheduledFor } : {}),
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(payload?.error ?? 'Could not update posting approval');
      return;
    }
    const payload = (await res.json()) as { data: MarketingPostRow };
    setPosts((prev) => prev.map((entry) => (entry.id === post.id ? payload.data : entry)));
    setMessage(
      action === 'approve' ? 'Posting approved and scheduled.' : 'Posting request rejected.'
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Total</p>
          <p className="text-3xl font-semibold">{posts.length}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Generated</p>
          <p className="text-3xl font-semibold">{generatedCount}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Accepted</p>
          <p className="text-3xl font-semibold text-emerald-300">{acceptedCount}</p>
        </Card>
        <Card className="gap-1 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Rejected / Sent</p>
          <p className="text-3xl font-semibold">
            <span className="text-rose-300">{rejectedCount}</span> /{' '}
            <span className="text-violet-300">{sentCount}</span>
          </p>
        </Card>
        <Card className="gap-2 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Safe mode</p>
          <p className="text-sm text-muted-foreground">
            Two approvals. {distributionReviewCount} rendered post
            {distributionReviewCount === 1 ? '' : 's'} waiting for release approval.
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setOpsFilter('missed')}
          className="text-left"
          aria-label="Filter missed ready posts"
        >
          <Card className="h-full gap-2 p-4 transition-colors hover:border-amber-500/50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Clock className="h-4 w-4" />
              Missed ready
            </div>
            <p className="text-3xl font-semibold text-amber-300">{opsSummary.missedPosts.length}</p>
            <p className="text-sm text-muted-foreground">
              Overdue accepted reels with rendered assets.
            </p>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => setOpsFilter('errors')}
          className="text-left"
          aria-label="Filter posting errors"
        >
          <Card className="h-full gap-2 p-4 transition-colors hover:border-rose-500/50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Posting errors
            </div>
            <p className="text-3xl font-semibold text-rose-300">
              {opsSummary.postingFailures.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Review reconnect, asset, and caption failures.
            </p>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => setOpsFilter('metrics_synced')}
          className="text-left"
          aria-label="Filter posts with synced metrics"
        >
          <Card className="h-full gap-2 p-4 transition-colors hover:border-cyan-500/50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Metrics synced
            </div>
            <p className="text-3xl font-semibold text-cyan-300">{opsSummary.metricsReady.length}</p>
            <p className="text-sm text-muted-foreground">
              {opsSummary.totals.views.toLocaleString()} views ·{' '}
              {opsSummary.totals.likes.toLocaleString()} likes
            </p>
          </Card>
        </button>
        <button
          type="button"
          onClick={() => setOpsFilter('metrics_pending')}
          className="text-left"
          aria-label="Filter posts pending metrics"
        >
          <Card className="h-full gap-2 p-4 transition-colors hover:border-violet-500/50">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Metrics pending
            </div>
            <p className="text-3xl font-semibold text-violet-300">
              {opsSummary.metricsPending.length}
            </p>
            <p className="text-sm text-muted-foreground">
              Sent posts with release IDs but no synced metrics.
            </p>
          </Card>
        </button>
      </div>

      {distributionViews.length > 0 && (
        <Card className="gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <BarChart3 className="h-4 w-4 text-cyan-300" />
                Distribution outcomes
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Provider-neutral Postiz delivery and analytics evidence. Recommendations are
                advisory and never create product tasks.
              </p>
            </div>
            <Badge variant="outline" className="border-border bg-muted/30 text-muted-foreground">
              24h freshness policy
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <OutcomeCount label="Fresh" count={evidenceCounts.fresh} tone="success" />
            <OutcomeCount label="Stale" count={evidenceCounts.stale} tone="warning" />
            <OutcomeCount label="Sync failed" count={evidenceCounts.failed} tone="danger" />
            <OutcomeCount label="Unmeasured" count={evidenceCounts.unmeasured} tone="neutral" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {recommendations.map((recommendation) => (
              <div key={recommendation.title} className="rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-medium">{recommendation.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {recommendation.detail}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {recommendation.evidenceCount === 0
                    ? 'No normalized evidence attached.'
                    : `Based on ${recommendation.evidenceCount} normalized evidence record${recommendation.evidenceCount === 1 ? '' : 's'}.`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(opsSummary.missedPosts.length > 0 ||
        opsSummary.postingFailures.length > 0 ||
        topMetrics.length > 0) && (
        <Card className="gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Posting ops</h2>
              <p className="text-sm text-muted-foreground">
                Missed posts, classified publish failures, and normalized platform metrics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-300"
              >
                {opsSummary.missedPosts.length} missed
              </Badge>
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300">
                {opsSummary.postingFailures.length} errors
              </Badge>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <OpsList
              title="Missed posts"
              empty="No overdue accepted reels."
              items={opsSummary.missedPosts.slice(0, 4).map((post) => ({
                id: post.id,
                title: post.title,
                detail: `${post.project_slug ?? 'Unassigned'} · ${post.channel} · ${formatDateTime(post.scheduled_for)}`,
              }))}
            />
            <OpsList
              title="Posting failures"
              empty="No posting failures in notes."
              items={opsSummary.postingFailures.slice(0, 4).map(({ post, failure }) => ({
                id: post.id,
                title: post.title,
                detail: `${failure.category ?? 'unknown'} · ${failure.retryable ? 'bounded retry eligible' : 'operator review required'}`,
              }))}
            />
            <OpsList
              title="Top metrics"
              empty="No synced metrics yet."
              items={topMetrics.map(({ post, snapshot }) => ({
                id: post.id,
                title: post.title,
                detail: `${(snapshot.metrics.views ?? 0).toLocaleString()} views · ${(snapshot.metrics.likes ?? 0).toLocaleString()} likes`,
              }))}
            />
          </div>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="gap-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as MarketingPostStatus | 'all')}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All projects</SelectItem>
                    {projectOptions.map((project) => (
                      <SelectItem key={project} value={project}>
                        {project}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Channel</Label>
                <Select
                  value={channelFilter}
                  onValueChange={(value) => setChannelFilter(value as MarketingPostChannel | 'all')}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ops</Label>
                <Select
                  value={opsFilter}
                  onValueChange={(value) => setOpsFilter(value as MarketingOpsFilter)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPS_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyExport('markdown')}>
                  <Download className="h-4 w-4" />
                  Copy MD
                </Button>
                <Button variant="outline" onClick={() => copyExport('csv')}>
                  <Download className="h-4 w-4" />
                  Copy CSV
                </Button>
                <Button
                  onClick={markSent}
                  disabled={
                    !filteredPosts.some((post) => post.status === 'accepted' && !post.distribution)
                  }
                >
                  <Send className="h-4 w-4" />
                  Mark sent
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <Card className="items-center gap-3 p-10 text-center">
                <Megaphone className="h-8 w-8 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold">No marketing ideas match this filter</h2>
                  <p className="text-sm text-muted-foreground">
                    Generate from changelog, let agents add ideas, or create one manually.
                  </p>
                </div>
              </Card>
            ) : (
              filteredPosts.map((post) => (
                <Card key={post.id} className="gap-4 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={STATUS_CLASS[post.status]}>
                          {STATUS_LABEL[post.status]}
                        </Badge>
                        <Badge variant="outline">{post.channel}</Badge>
                        {post.project_slug && (
                          <Badge variant="secondary">{post.project_slug}</Badge>
                        )}
                        {post.source_id && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {post.source_type}:{post.source_id.slice(0, 8)}
                          </span>
                        )}
                        {isMissedPost(post) && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-300"
                          >
                            Missed
                          </Badge>
                        )}
                        {hasPostingFailure(post) && (
                          <Badge
                            variant="outline"
                            className="border-rose-500/40 bg-rose-500/10 text-rose-300"
                          >
                            Post error
                          </Badge>
                        )}
                        {hasMetrics(post) && (
                          <Badge
                            variant="outline"
                            className="border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                          >
                            Metrics
                          </Badge>
                        )}
                        {post.distribution && (
                          <Badge
                            variant="outline"
                            className={
                              post.distribution.mediaStatus === 'rendered'
                                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                : ''
                            }
                          >
                            Media {post.distribution.mediaStatus}
                          </Badge>
                        )}
                        {post.distribution?.approvalStatus === 'approved' && (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          >
                            Posting approved
                          </Badge>
                        )}
                      </div>
                      <h2 className="truncate text-base font-semibold">{post.title}</h2>
                      {post.hook && (
                        <p className="text-sm font-medium text-foreground">{post.hook}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {post.status === 'generated' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updatePost(post.id, { status: 'accepted' })}
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePost(post.id, { status: 'rejected' })}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </>
                      )}
                      {post.status === 'accepted' && !post.distribution && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updatePost(post.id, {
                              status: 'sent',
                              posted_at: new Date().toISOString(),
                            } as Partial<MarketingPostRow>)
                          }
                        >
                          <Send className="h-4 w-4" />
                          Sent
                        </Button>
                      )}
                      {post.status === 'accepted' &&
                        post.distribution?.approvalStatus === 'proposed' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="datetime-local"
                              aria-label={`Schedule ${post.title}`}
                              className="h-8 w-48"
                              value={scheduleById[post.id] ?? ''}
                              onChange={(event) =>
                                setScheduleById((prev) => ({
                                  ...prev,
                                  [post.id]: event.target.value,
                                }))
                              }
                            />
                            <Button size="sm" onClick={() => decideDistribution(post, 'approve')}>
                              <CalendarClock className="h-4 w-4" />
                              Approve & schedule
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decideDistribution(post, 'reject')}
                            >
                              <X className="h-4 w-4" />
                              Reject posting
                            </Button>
                          </div>
                        )}
                      <Button size="sm" variant="outline" onClick={() => copyPost(post)}>
                        {copiedId === post.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        Copy
                      </Button>
                      {!post.distribution && (
                        <Select
                          value={post.status}
                          onValueChange={(value) =>
                            updatePost(post.id, { status: value as MarketingPostStatus })
                          }
                        >
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_LABEL[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {post.task_id && (
                        <Button asChild size="icon-sm" variant="ghost">
                          <a href={`/tasks/${post.task_id}`} aria-label="Open task">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => deletePost(post.id)}
                        aria-label="Delete idea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                    {postText(post)}
                  </pre>
                  {post.distributionView && <DistributionStatePanel view={post.distributionView} />}
                  {hasMetrics(post) && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {metricLine(post, 'views')}
                      {metricLine(post, 'likes')}
                      {metricLine(post, 'comments')}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                Generate from changelog
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Creates Instagram Reel and YouTube Short ideas from recent feature, fix, and
                improvement entries. Duplicates are skipped.
              </p>
            </div>
            <Button onClick={generateFromChangelog}>Generate ideas</Button>
          </Card>

          <Card className="gap-4 p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Plus className="h-4 w-4 text-cyan-300" />
                Manual idea
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this for launch ideas that do not come from a changelog entry.
              </p>
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-1">
                  <Label>Project</Label>
                  <Input
                    value={form.project_slug}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, project_slug: event.target.value }))
                    }
                    placeholder="linkchat"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Channel</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, channel: value as MarketingPostChannel }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((channel) => (
                        <SelectItem key={channel} value={channel}>
                          {channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Launch post for Linkchat"
                />
              </div>
              <div className="space-y-1">
                <Label>Hook</Label>
                <Input
                  value={form.hook}
                  onChange={(event) => setForm((prev) => ({ ...prev, hook: event.target.value }))}
                  placeholder="Your link-in-bio should answer questions."
                />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea
                  value={form.body}
                  onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
                  placeholder="Write the post body..."
                  className="min-h-32"
                />
              </div>
              <div className="space-y-1">
                <Label>CTA</Label>
                <Input
                  value={form.cta}
                  onChange={(event) => setForm((prev) => ({ ...prev, cta: event.target.value }))}
                  placeholder="Try it and send feedback."
                />
              </div>
              <Button onClick={createPost} className="w-full">
                Create idea
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function OutcomeCount({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: DistributionViewTone;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${DISTRIBUTION_TONE_CLASS[tone]}`}>
      <p className="text-xs uppercase tracking-widest">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{count}</p>
    </div>
  );
}

function DistributionStatePanel({ view }: { view: MarketingDistributionView }) {
  const freshnessTone: DistributionViewTone =
    view.freshness === 'fresh'
      ? 'success'
      : view.freshness === 'failed'
        ? 'danger'
        : view.freshness === 'stale'
          ? 'warning'
          : 'neutral';

  return (
    <section
      className="space-y-3 rounded-lg border bg-muted/15 p-3"
      aria-label="Distribution state"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <RefreshCcw className="h-4 w-4 text-cyan-300" />
          Distribution pipeline
        </h3>
        <Badge variant="outline" className={DISTRIBUTION_TONE_CLASS[freshnessTone]}>
          Analytics {view.freshness}
        </Badge>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {view.stages.map((stage) => (
          <div
            key={stage.key}
            className={`rounded-md border p-2 ${DISTRIBUTION_TONE_CLASS[stage.tone]}`}
          >
            <dt className="text-[11px] uppercase tracking-wider opacity-80">{stage.label}</dt>
            <dd className="mt-1 text-sm font-medium">{stage.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-3 border-t pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{view.platform}</span>
            <span aria-hidden="true">·</span>
            <span>{view.deliveryState}</span>
            <span aria-hidden="true">·</span>
            <span>
              {view.freshnessObservedAt
                ? `observed ${formatDateTime(view.freshnessObservedAt)}`
                : 'analytics not measured'}
            </span>
          </div>
          {view.metrics.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {view.metrics.map((metric) => (
                <span
                  key={`${metric.providerLabel}:${metric.label}`}
                  className="rounded-md border bg-background/50 px-2 py-1 text-xs"
                  title={
                    metric.label === metric.providerLabel
                      ? metric.providerLabel
                      : `Provider label: ${metric.providerLabel}`
                  }
                >
                  {metric.label}: {metric.value.toLocaleString()}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No allowlisted platform metrics are available.
            </p>
          )}
          {view.failure && (
            <p className="mt-2 text-xs text-rose-300">
              {view.failure.category} failure ·{' '}
              {view.failure.retryable ? 'bounded retry eligible' : 'operator review required'}
            </p>
          )}
        </div>
        <div className="rounded-md border bg-background/40 p-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Recommendation</p>
          <p className="mt-1 text-sm font-medium">{view.recommendation.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {view.recommendation.detail}
          </p>
        </div>
      </div>
    </section>
  );
}

function OpsList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; detail: string }>;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isMissedPost(post: MarketingPostRow) {
  return isMissedMarketingPost(post);
}

function hasPostingFailure(post: MarketingPostRow) {
  return Boolean(post.distributionView?.failure ?? parsePostingFailure(post.notes));
}

function hasMetrics(post: MarketingPostRow) {
  if (post.distributionView?.metrics.length) return true;
  const snapshot = parseMarketingMetrics(post.notes);
  return Boolean(snapshot.syncedAt && Object.keys(snapshot.metrics).length > 0);
}

function metricLine(post: MarketingPostRow, key: string) {
  const normalized = post.distributionView?.metrics.find((metric) => metric.label === key);
  if (normalized) {
    return (
      <span key={key} className="rounded-md border bg-muted/30 px-2 py-1">
        {key}: {normalized.value.toLocaleString()}
      </span>
    );
  }
  const value = parseMarketingMetrics(post.notes).metrics[key];
  if (value === undefined || value === null) return null;
  return (
    <span key={key} className="rounded-md border bg-muted/30 px-2 py-1">
      {key}: {value.toLocaleString()}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return 'unscheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
