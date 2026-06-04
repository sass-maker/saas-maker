import { describe, expect, it } from 'vitest';
import { buildDryRunTaskPayloads, buildFeedbackDigest, type FeedbackDigestSignal } from '../feedback-digest.js';

const signals: FeedbackDigestSignal[] = [
  {
    id: 's1',
    project_id: 'reader',
    source_type: 'feedback',
    source_id: 'fb_login_1',
    occurred_at: '2026-06-03T10:00:00Z',
    channel: 'in_app',
    title: 'Login broken',
    body: 'OAuth login failed on mobile Safari.',
    type: 'bug',
  },
  {
    id: 's2',
    project_id: 'reader',
    source_type: 'app_store_review',
    source_id: 'ios_44',
    occurred_at: '2026-06-03T11:00:00Z',
    channel: 'app_store',
    title: 'Cannot sign in',
    body: 'I cannot sign in after the update.',
    rating: 1,
  },
  {
    id: 's3',
    project_id: 'reader',
    source_type: 'testimonial',
    source_id: 'test_7',
    occurred_at: '2026-06-03T12:00:00Z',
    channel: 'public_page',
    body: 'Reader is useful and fast for long research PDFs.',
    rating: 5,
  },
];

describe('Feedback Digest prototype', () => {
  it('clusters fixture signals without losing source evidence', () => {
    const digest = buildFeedbackDigest({
      projectId: 'reader',
      window: { start: '2026-06-03T00:00:00Z', end: '2026-06-04T00:00:00Z' },
      signals,
    });

    expect(digest.stats.signal_count).toBe(3);
    expect(digest.clusters.find((cluster) => cluster.label === 'Login and account access')?.evidence)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ source_type: 'feedback', source_id: 'fb_login_1' }),
      ]));
    expect(digest.suggested_tasks[0]).toMatchObject({ draft_only: true, priority: 'high' });
  });

  it('builds dry-run task payloads only from actionable clusters', () => {
    const digest = buildFeedbackDigest({
      projectId: 'reader',
      window: { start: '2026-06-03T00:00:00Z', end: '2026-06-04T00:00:00Z' },
      signals,
    });

    expect(buildDryRunTaskPayloads(digest)).toEqual([
      expect.objectContaining({
        project_slug: 'reader',
        task_type: 'bug',
        draft_only: true,
      }),
    ]);
  });
});
