import type { MarketingPostRow } from './marketing-queue-store';

const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);
const METRIC_PREFIX = 'metric_';

export type MarketingMetricsSnapshot = {
  provider: string | null;
  externalId: string | null;
  syncedAt: string | null;
  metrics: Record<string, number | null>;
};

export type MarketingPostingFailure = {
  category: string | null;
  retryable: boolean | null;
  message: string | null;
};

export type MarketingOpsSummary = {
  missedPosts: MarketingPostRow[];
  postingFailures: Array<{ post: MarketingPostRow; failure: MarketingPostingFailure }>;
  metricsReady: Array<{ post: MarketingPostRow; snapshot: MarketingMetricsSnapshot }>;
  metricsPending: MarketingPostRow[];
  totals: {
    views: number;
    likes: number;
    comments: number;
  };
};

export type MarketingOpsFilter = 'all' | 'missed' | 'errors' | 'metrics_pending' | 'metrics_synced';

export function marketingNoteValue(notes: string | null | undefined, key: string) {
  const prefix = `${key}:`;
  return (
    noteLines(notes)
      .map((line) => line.trim())
      .filter((line) => line.startsWith(prefix))
      .map((line) => line.slice(prefix.length).trim())
      .filter(Boolean)
      .at(-1) ?? null
  );
}

export function parseMarketingMetrics(notes: string | null | undefined): MarketingMetricsSnapshot {
  const metrics: Record<string, number | null> = {};
  for (const line of noteLines(notes)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(METRIC_PREFIX)) continue;
    const separator = trimmed.indexOf(':');
    if (separator === -1) continue;
    const key = trimmed.slice(METRIC_PREFIX.length, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key) continue;
    if (!rawValue || rawValue === 'null') {
      metrics[key] = null;
      continue;
    }
    const parsed = Number(rawValue);
    metrics[key] = Number.isFinite(parsed) ? parsed : null;
  }
  return {
    provider: marketingNoteValue(notes, 'metrics_provider'),
    externalId: marketingNoteValue(notes, 'metrics_external_id'),
    syncedAt: marketingNoteValue(notes, 'metrics_synced_at'),
    metrics,
  };
}

function noteLines(notes: string | null | undefined) {
  return notes?.split(/\n|\\n/) ?? [];
}

export function parsePostingFailure(
  notes: string | null | undefined
): MarketingPostingFailure | null {
  if (marketingNoteValue(notes, 'posting_status') !== 'error') return null;
  const retryable = marketingNoteValue(notes, 'posting_error_retryable');
  return {
    category: marketingNoteValue(notes, 'posting_error_category'),
    retryable: retryable ? retryable === 'true' : null,
    message: marketingNoteValue(notes, 'posting_error'),
  };
}

export function hasPublishReleaseId(post: MarketingPostRow) {
  if (post.distributionView?.deliveryState === 'published') return true;
  const provider = marketingNoteValue(post.notes, 'posting_provider');
  const externalId = marketingNoteValue(post.notes, 'external_id');
  return Boolean(externalId && (provider === 'youtube' || provider === 'instagram'));
}

export function isMissedMarketingPost(post: MarketingPostRow, now = new Date()) {
  if (post.status !== 'accepted') return false;
  if (!REEL_CHANNELS.has(post.channel)) return false;
  if (parsePostingFailure(post.notes)) return false;
  if (post.posted_at) return false;
  if (!post.asset_url && !post.result_url) return false;
  if (!post.scheduled_for) return false;
  if (post.distribution && post.distribution.approvalStatus !== 'approved') return false;
  if (post.distribution?.attemptState === 'inflight') return false;
  const scheduledFor = new Date(post.scheduled_for);
  if (Number.isNaN(scheduledFor.getTime())) return false;
  return scheduledFor <= now;
}

export function buildMarketingOpsSummary(
  posts: MarketingPostRow[],
  now = new Date()
): MarketingOpsSummary {
  const postingFailures: MarketingOpsSummary['postingFailures'] = [];
  const metricsReady: MarketingOpsSummary['metricsReady'] = [];
  const metricsPending: MarketingPostRow[] = [];

  for (const post of posts) {
    const failure = post.distributionView?.failure
      ? {
          category: post.distributionView.failure.category,
          retryable: post.distributionView.failure.retryable,
          message: null,
        }
      : parsePostingFailure(post.notes);
    if (failure) postingFailures.push({ post, failure });

    if (post.status !== 'sent') continue;
    if (post.distributionView?.metrics.length) {
      metricsReady.push({
        post,
        snapshot: {
          provider: post.distributionView.platform,
          externalId: null,
          syncedAt: post.distributionView.freshnessObservedAt,
          metrics: Object.fromEntries(
            post.distributionView.metrics.map((metric) => [metric.label, metric.value])
          ),
        },
      });
      continue;
    }
    const snapshot = parseMarketingMetrics(post.notes);
    if (snapshot.syncedAt && Object.keys(snapshot.metrics).length > 0) {
      metricsReady.push({ post, snapshot });
    } else if (hasPublishReleaseId(post)) {
      metricsPending.push(post);
    }
  }

  return {
    missedPosts: posts.filter((post) => isMissedMarketingPost(post, now)),
    postingFailures,
    metricsReady,
    metricsPending,
    totals: {
      views: sumMetric(metricsReady, 'views'),
      likes: sumMetric(metricsReady, 'likes'),
      comments: sumMetric(metricsReady, 'comments'),
    },
  };
}

export function matchesMarketingOpsFilter(
  post: MarketingPostRow,
  filter: MarketingOpsFilter,
  now = new Date()
) {
  if (filter === 'all') return true;
  if (filter === 'missed') return isMissedMarketingPost(post, now);
  if (filter === 'errors') {
    return Boolean(post.distributionView?.failure ?? parsePostingFailure(post.notes));
  }
  if (filter === 'metrics_pending') {
    return post.status === 'sent' && hasPublishReleaseId(post) && !hasSyncedMetrics(post);
  }
  if (filter === 'metrics_synced') return hasSyncedMetrics(post);
  return true;
}

function hasSyncedMetrics(post: MarketingPostRow) {
  if (post.distributionView?.metrics.length) return true;
  const snapshot = parseMarketingMetrics(post.notes);
  return Boolean(snapshot.syncedAt && Object.keys(snapshot.metrics).length > 0);
}

function sumMetric(
  snapshots: MarketingOpsSummary['metricsReady'],
  key: 'views' | 'likes' | 'comments'
) {
  return snapshots.reduce((total, entry) => total + (entry.snapshot.metrics[key] ?? 0), 0);
}
