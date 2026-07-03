import { describe, expect, it } from 'vitest';

import {
  buildMarketingOpsSummary,
  isMissedMarketingPost,
  matchesMarketingOpsFilter,
  parseMarketingMetrics,
  parsePostingFailure,
} from '../apps/cockpit/src/lib/marketing-queue-ops';
import type { MarketingPostRow } from '../apps/cockpit/src/lib/marketing-queue-store';

function post(overrides: Partial<MarketingPostRow> = {}): MarketingPostRow {
  return {
    id: 'post-1',
    owner_id: 'owner-1',
    project_slug: 'reel-pipeline',
    channel: 'youtube_shorts',
    status: 'accepted',
    title: 'Short',
    hook: null,
    body: 'Body',
    cta: null,
    asset_url: 'https://assets.example.test/reel.mp4',
    source_type: 'manual',
    source_id: null,
    task_id: null,
    changelog_entry_id: null,
    scheduled_for: '2026-07-01T10:00:00Z',
    exported_at: null,
    posted_at: null,
    result_url: 'https://assets.example.test/reel.mp4',
    notes: null,
    created_at: '2026-07-01T09:00:00Z',
    updated_at: '2026-07-01T09:00:00Z',
    ...overrides,
  };
}

describe('cockpit marketing ops helpers', () => {
  it('detects accepted rendered reel posts missed by the scheduler', () => {
    const now = new Date('2026-07-01T11:00:00Z');

    expect(isMissedMarketingPost(post(), now)).toBe(true);
    expect(isMissedMarketingPost(post({ scheduled_for: '2026-07-01T12:00:00Z' }), now)).toBe(false);
    expect(isMissedMarketingPost(post({ posted_at: '2026-07-01T10:30:00Z' }), now)).toBe(false);
    expect(isMissedMarketingPost(post({ channel: 'blog' }), now)).toBe(false);
  });

  it('parses reel-pipeline posting failure notes', () => {
    const failure = parsePostingFailure(
      [
        'Posting gate handled by reel-pipeline.',
        'posting_status: error',
        'posting_error_category: needs_reconnect',
        'posting_error_retryable: false',
        'posting_error: OAuth token expired',
      ].join('\n')
    );

    expect(failure).toEqual({
      category: 'needs_reconnect',
      retryable: false,
      message: 'OAuth token expired',
    });
  });

  it('also parses notes that contain escaped newline text', () => {
    const failure = parsePostingFailure(
      'posting_status: error\\nposting_error_category: bad_asset\\nposting_error_retryable: false'
    );
    const metrics = parseMarketingMetrics(
      'metrics_synced_at: 2026-07-01T12:00:00Z\\nmetric_views: 10'
    );

    expect(failure?.category).toBe('bad_asset');
    expect(metrics.metrics.views).toBe(10);
  });

  it('parses and aggregates metrics notes', () => {
    const snapshot = parseMarketingMetrics(
      [
        'metrics_provider: youtube',
        'metrics_external_id: video-1',
        'metrics_synced_at: 2026-07-01T12:00:00Z',
        'metric_views: 100',
        'metric_likes: 12',
        'metric_comments: null',
      ].join('\n')
    );

    expect(snapshot.provider).toBe('youtube');
    expect(snapshot.metrics).toEqual({ views: 100, likes: 12, comments: null });

    const summary = buildMarketingOpsSummary(
      [
        post(),
        post({
          id: 'sent-with-metrics',
          status: 'sent',
          posted_at: '2026-07-01T10:30:00Z',
          notes: [
            'posting_provider: youtube',
            'external_id: video-1',
            'metrics_synced_at: 2026-07-01T12:00:00Z',
            'metric_views: 100',
            'metric_likes: 12',
            'metric_comments: 3',
          ].join('\n'),
        }),
        post({
          id: 'sent-pending',
          status: 'sent',
          posted_at: '2026-07-01T10:30:00Z',
          notes: ['posting_provider: instagram', 'external_id: media-1'].join('\n'),
        }),
      ],
      new Date('2026-07-01T11:00:00Z')
    );

    expect(summary.missedPosts.map((entry) => entry.id)).toEqual(['post-1']);
    expect(summary.metricsReady).toHaveLength(1);
    expect(summary.metricsPending.map((entry) => entry.id)).toEqual(['sent-pending']);
    expect(summary.totals).toEqual({ views: 100, likes: 12, comments: 3 });
  });

  it('matches explicit operator filters', () => {
    const now = new Date('2026-07-01T11:00:00Z');
    const missed = post();
    const error = post({
      id: 'error',
      notes: 'posting_status: error\nposting_error_category: bad_asset',
    });
    const synced = post({
      id: 'synced',
      status: 'sent',
      posted_at: '2026-07-01T10:30:00Z',
      notes:
        'posting_provider: youtube\nexternal_id: video-1\nmetrics_synced_at: 2026-07-01T12:00:00Z\nmetric_views: 10',
    });
    const pending = post({
      id: 'pending',
      status: 'sent',
      posted_at: '2026-07-01T10:30:00Z',
      notes: 'posting_provider: instagram\nexternal_id: media-1',
    });

    expect(matchesMarketingOpsFilter(missed, 'missed', now)).toBe(true);
    expect(matchesMarketingOpsFilter(error, 'missed', now)).toBe(false);
    expect(matchesMarketingOpsFilter(error, 'errors', now)).toBe(true);
    expect(matchesMarketingOpsFilter(synced, 'metrics_synced', now)).toBe(true);
    expect(matchesMarketingOpsFilter(pending, 'metrics_pending', now)).toBe(true);
    expect(matchesMarketingOpsFilter(missed, 'metrics_pending', now)).toBe(false);
  });
});
