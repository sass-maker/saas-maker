import { readFileSync } from 'node:fs';

import type { ProviderReceipt } from '@saas-maker/contracts';
import { describe, expect, it } from 'vitest';

import type { MarketingDistributionSummary } from '../apps/cockpit/src/lib/marketing-distribution-envelope';
import {
  buildMarketingDistributionView,
  hydrateAnalyticsEvidence,
  hydrateProviderReceipt,
  type MarketingDistributionEvidence,
} from '../apps/cockpit/src/lib/marketing-distribution-view';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/cockpit-evidence-v1.json', 'utf8')
) as Record<string, MarketingDistributionEvidence>;

const now = new Date('2026-07-20T12:00:00.000Z');

function distribution(
  overrides: Partial<MarketingDistributionSummary> = {}
): MarketingDistributionSummary {
  return {
    packageId: 'package-fixture',
    packageRevision: 1,
    variantId: 'vertical-proof-v1',
    contentApprovalStatus: 'approved',
    mediaStatus: 'rendered',
    artifactVerificationStatus: 'verified',
    approvalStatus: 'approved',
    scheduledFor: '2026-07-20T10:00:00.000Z',
    attemptState: 'posted',
    attemptCount: 1,
    publicationStatus: 'published',
    ...overrides,
  };
}

function view(evidence: MarketingDistributionEvidence) {
  return buildMarketingDistributionView(
    {
      queueStatus: 'sent',
      channel: 'youtube_shorts',
      distribution: distribution(),
    },
    evidence,
    now
  );
}

describe('provider-neutral Cockpit distribution view', () => {
  it('shows every approval, artifact, delivery, and retry stage from normalized evidence', () => {
    const result = view(fixture.freshPublished);

    expect(result.stages.map((stage) => stage.key)).toEqual([
      'generation',
      'content_approval',
      'artifact_verification',
      'distribution_approval',
      'postiz_delivery',
      'retry_reconciliation',
    ]);
    expect(result.stages.find((stage) => stage.key === 'postiz_delivery')).toMatchObject({
      value: 'Published',
      tone: 'success',
    });
    expect(result.metrics).toEqual([
      { label: 'views', providerLabel: 'Views', value: 120 },
      { label: 'likes', providerLabel: 'Likes', value: 14 },
    ]);
    expect(result.freshness).toBe('fresh');
    expect(result.recommendation).toMatchObject({
      title: 'Use this as a measured baseline',
      evidenceCount: 2,
    });
  });

  it.each([
    'draft',
    'scheduled',
    'publishing',
    'published',
    'failed',
  ] as const)('renders the normalized Postiz %s state', (state) => {
    const evidence = structuredClone(fixture.freshPublished);
    const receipt = evidence.receipts[0] as ProviderReceipt;
    receipt.state = state;
    receipt.error =
      state === 'failed'
        ? { category: 'provider', code: 'FAILED', message: 'normalized fixture failure' }
        : null;

    const result = view(evidence);
    expect(result.deliveryState).toBe(state);
    expect(result.stages.find((stage) => stage.key === 'postiz_delivery')?.value).toBe(
      state[0].toUpperCase() + state.slice(1)
    );
  });

  it('renders unavailable Postiz evidence as unmeasured, never green', () => {
    const result = view(fixture.unavailable);
    const delivery = result.stages.find((stage) => stage.key === 'postiz_delivery');

    expect(result.freshness).toBe('unmeasured');
    expect(result.metrics).toEqual([]);
    expect(delivery).toMatchObject({ value: 'Published', tone: 'warning' });
    expect(result.recommendation.title).toBe('Wait for fresh outcome evidence');
  });

  it('keeps last-known values stale and does not render a stale publication green', () => {
    const result = view(fixture.stalePublished);

    expect(result.freshness).toBe('stale');
    expect(result.metrics[0]).toEqual({ label: 'views', providerLabel: 'Plays', value: 85 });
    expect(result.stages.find((stage) => stage.key === 'postiz_delivery')?.tone).toBe('warning');
    expect(result.recommendation.title).toBe('Wait for fresh outcome evidence');
  });

  it('exposes only classified failure data, not provider messages or identifiers', () => {
    const result = view(fixture.failedDelivery);
    const serialized = JSON.stringify(result);

    expect(result.failure).toEqual({ category: 'network', retryable: true });
    expect(result.stages.find((stage) => stage.key === 'postiz_delivery')?.tone).toBe('danger');
    expect(serialized).not.toContain('fixture-secret');
    expect(serialized).not.toContain('integration-fixture');
    expect(serialized).not.toContain('post-fixture');
  });

  it('hydrates the persisted allowlisted evidence without exposing provider identifiers', () => {
    const receipt = hydrateProviderReceipt({
      id: 'receipt-db',
      source: 'postiz',
      distribution_request_id: 'request-db',
      project_id: 'project-db',
      campaign_id: 'campaign-db',
      brief_id: 'brief-db',
      artifact_manifest_id: 'artifact-db',
      experiment_id: null,
      integration_id: 'integration-db',
      platform: 'youtube_shorts',
      provider_post_id: 'post-db',
      provider_release_id: 'release-db',
      release_status: 'published',
      observed_at: '2026-07-20T11:00:00.000Z',
    });
    const analytics = hydrateAnalyticsEvidence({
      id: 'analytics-db',
      source: 'postiz',
      distribution_request_id: 'request-db',
      project_id: 'project-db',
      campaign_id: 'campaign-db',
      brief_id: 'brief-db',
      artifact_manifest_id: 'artifact-db',
      experiment_id: null,
      integration_id: 'integration-db',
      platform: 'youtube_shorts',
      provider_post_id: 'post-db',
      observed_at: '2026-07-20T11:00:00.000Z',
      freshness: 'fresh',
      metrics_json: JSON.stringify([
        { provider_label: 'Views', normalized_label: 'views', value: 42 },
        { provider_label: 'Invalid', normalized_label: 'invalid', value: '42' },
      ]),
    });

    expect(receipt?.state).toBe('published');
    expect(analytics?.metrics).toEqual([
      {
        provider_label: 'Views',
        normalized_label: 'views',
        value: 42,
        period_start: null,
        period_end: null,
      },
    ]);
    const serialized = JSON.stringify(
      view({ receipts: receipt ? [receipt] : [], analytics: analytics ? [analytics] : [] })
    );
    expect(serialized).not.toContain('integration-db');
    expect(serialized).not.toContain('post-db');
    expect(serialized).not.toContain('release-db');
  });
});
