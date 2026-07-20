import type {
  AnalyticsEvidence,
  DistributionFreshness,
  ProviderReceipt,
} from '@saas-maker/contracts';

import type { MarketingDistributionSummary } from './marketing-distribution-envelope';

export const DISTRIBUTION_EVIDENCE_FRESHNESS_HOURS = 24;

export type DistributionViewTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type DistributionPipelineStage = {
  key:
    | 'generation'
    | 'content_approval'
    | 'artifact_verification'
    | 'distribution_approval'
    | 'postiz_delivery'
    | 'retry_reconciliation';
  label: string;
  value: string;
  tone: DistributionViewTone;
};

export type DistributionMetricView = {
  label: string;
  providerLabel: string;
  value: number;
};

export type MarketingDistributionView = {
  stages: DistributionPipelineStage[];
  platform: string;
  deliveryState: ProviderReceipt['state'] | 'unmeasured';
  deliveryObservedAt: string | null;
  freshness: DistributionFreshness;
  freshnessObservedAt: string | null;
  metrics: DistributionMetricView[];
  failure: { category: string; retryable: boolean } | null;
  recommendation: {
    title: string;
    detail: string;
    evidenceCount: number;
  };
};

export type MarketingDistributionEvidence = {
  receipts: ProviderReceipt[];
  analytics: AnalyticsEvidence[];
};

export type MarketingDistributionViewInput = {
  queueStatus: 'generated' | 'accepted' | 'rejected' | 'sent';
  channel: string;
  distribution: MarketingDistributionSummary | null;
};

const RECEIPT_STATES = new Set<ProviderReceipt['state']>([
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'unknown',
]);
const EVIDENCE_FRESHNESS = new Set<DistributionFreshness>([
  'fresh',
  'stale',
  'failed',
  'unmeasured',
]);

export function hydrateProviderReceipt(row: Record<string, unknown>): ProviderReceipt | null {
  const state = stringValue(row.release_status);
  const required = requiredEvidenceFields(row);
  if (!required || !state || !RECEIPT_STATES.has(state as ProviderReceipt['state'])) return null;

  return {
    schema_version: 1,
    receipt_id: required.id,
    source: required.source,
    distribution_request_id: required.distributionRequestId,
    project_id: required.projectId,
    campaign_id: required.campaignId,
    brief_id: required.briefId,
    artifact_manifest_id: required.artifactManifestId,
    experiment_id: nullableString(row.experiment_id),
    integration_id: required.integrationId,
    platform: required.platform,
    provider_post_id: required.providerPostId,
    provider_release_id: nullableString(row.provider_release_id),
    provider_release_url: null,
    state: state as ProviderReceipt['state'],
    observed_at: required.observedAt,
    error: state === 'failed' ? { category: 'unknown', code: 'FAILED', message: '' } : null,
  };
}

export function hydrateAnalyticsEvidence(row: Record<string, unknown>): AnalyticsEvidence | null {
  const required = requiredEvidenceFields(row);
  const freshness = stringValue(row.freshness);
  if (!required || !freshness || !EVIDENCE_FRESHNESS.has(freshness as DistributionFreshness)) {
    return null;
  }

  return {
    schema_version: 1,
    evidence_id: required.id,
    source: required.source,
    distribution_request_id: required.distributionRequestId,
    project_id: required.projectId,
    campaign_id: required.campaignId,
    brief_id: required.briefId,
    artifact_manifest_id: required.artifactManifestId,
    experiment_id: nullableString(row.experiment_id),
    integration_id: required.integrationId,
    platform: required.platform,
    provider_post_id: required.providerPostId,
    observed_at: required.observedAt,
    freshness: freshness as DistributionFreshness,
    metrics: parseStoredMetrics(row.metrics_json),
  };
}

function requiredEvidenceFields(row: Record<string, unknown>) {
  const values = {
    id: stringValue(row.id),
    source: stringValue(row.source),
    distributionRequestId: stringValue(row.distribution_request_id),
    projectId: stringValue(row.project_id),
    campaignId: stringValue(row.campaign_id),
    briefId: stringValue(row.brief_id),
    artifactManifestId: stringValue(row.artifact_manifest_id),
    integrationId: stringValue(row.integration_id),
    platform: stringValue(row.platform),
    providerPostId: stringValue(row.provider_post_id),
    observedAt: stringValue(row.observed_at),
  };
  return Object.values(values).every(Boolean)
    ? (values as Record<keyof typeof values, string>)
    : null;
}

function parseStoredMetrics(raw: unknown): AnalyticsEvidence['metrics'] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const metric = entry as Record<string, unknown>;
      const providerLabel = stringValue(metric.provider_label);
      const value =
        typeof metric.value === 'number' && Number.isFinite(metric.value) ? metric.value : null;
      if (!providerLabel || value === null) return [];
      return [
        {
          provider_label: providerLabel,
          normalized_label: nullableString(metric.normalized_label),
          value,
          period_start: null,
          period_end: null,
        },
      ];
    });
  } catch {
    return [];
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : stringValue(value);
}

export function buildMarketingDistributionView(
  input: MarketingDistributionViewInput,
  evidence: MarketingDistributionEvidence = { receipts: [], analytics: [] },
  now = new Date()
): MarketingDistributionView {
  const latestReceipt = latestByObservedAt(evidence.receipts);
  const latestAnalytics = latestByObservedAt(evidence.analytics);
  const deliveryFreshness = latestReceipt
    ? freshnessFromObservedAt(latestReceipt.observed_at, now)
    : 'unmeasured';
  const analyticsFreshness = effectiveAnalyticsFreshness(latestAnalytics, now);
  const deliveryState = latestReceipt?.state ?? legacyDeliveryState(input.distribution);
  const failure = normalizedFailure(input, latestReceipt);
  const metrics = normalizedMetrics(latestAnalytics);

  return {
    stages: pipelineStages(input, deliveryState, deliveryFreshness, failure),
    platform: safePlatform(latestAnalytics?.platform ?? latestReceipt?.platform ?? input.channel),
    deliveryState,
    deliveryObservedAt: latestReceipt?.observed_at ?? null,
    freshness: analyticsFreshness,
    freshnessObservedAt: latestAnalytics?.observed_at ?? null,
    metrics,
    failure,
    recommendation: recommendationFor({
      freshness: analyticsFreshness,
      metrics,
      failure,
      evidenceCount: evidence.analytics.length + evidence.receipts.length,
    }),
  };
}

function pipelineStages(
  input: MarketingDistributionViewInput,
  deliveryState: MarketingDistributionView['deliveryState'],
  deliveryFreshness: DistributionFreshness,
  failure: MarketingDistributionView['failure']
): DistributionPipelineStage[] {
  const distribution = input.distribution;
  const contentApproval = distribution?.contentApprovalStatus ?? queueApproval(input.queueStatus);
  const artifactVerification = distribution?.artifactVerificationStatus ?? 'unmeasured';
  const distributionApproval = distribution?.approvalStatus ?? 'pending';

  return [
    stage('generation', 'Generation', 'Generated', 'success'),
    stage(
      'content_approval',
      'Content approval',
      titleCase(contentApproval),
      approvalTone(contentApproval)
    ),
    stage(
      'artifact_verification',
      'Artifact verification',
      artifactVerification === 'verified' ? 'Verified receipt' : 'Unmeasured',
      artifactVerification === 'verified' ? 'success' : 'neutral'
    ),
    stage(
      'distribution_approval',
      'Distribution approval',
      titleCase(distributionApproval),
      approvalTone(distributionApproval)
    ),
    stage(
      'postiz_delivery',
      'Postiz delivery',
      titleCase(deliveryState),
      deliveryTone(deliveryState, deliveryFreshness)
    ),
    stage(
      'retry_reconciliation',
      'Retry / reconciliation',
      retryLabel(distribution, failure),
      retryTone(distribution, failure)
    ),
  ];
}

function stage(
  key: DistributionPipelineStage['key'],
  label: string,
  value: string,
  tone: DistributionViewTone
): DistributionPipelineStage {
  return { key, label, value, tone };
}

function queueApproval(status: MarketingDistributionViewInput['queueStatus']) {
  if (status === 'accepted' || status === 'sent') return 'approved';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function approvalTone(status: string): DistributionViewTone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'proposed') return 'warning';
  return 'neutral';
}

function deliveryTone(
  state: MarketingDistributionView['deliveryState'],
  freshness: DistributionFreshness
): DistributionViewTone {
  if (state === 'failed') return 'danger';
  if (freshness !== 'fresh') return freshness === 'failed' ? 'danger' : 'warning';
  if (state === 'published') return 'success';
  if (state === 'draft' || state === 'scheduled' || state === 'publishing') return 'info';
  return 'neutral';
}

function retryLabel(
  distribution: MarketingDistributionSummary | null,
  failure: MarketingDistributionView['failure']
) {
  if (failure && distribution?.attemptState === 'retry_wait') {
    return `Retry ${distribution.attemptCount} queued`;
  }
  if (failure) return failure.retryable ? 'Reconciliation needed' : 'Review required';
  if (distribution?.attemptState === 'inflight') return 'Reconciling';
  if (distribution?.attemptState === 'retry_wait')
    return `Retry ${distribution.attemptCount} queued`;
  if (distribution?.attemptState === 'failed') return 'Review required';
  if (distribution?.attemptCount)
    return `${distribution.attemptCount} attempt${distribution.attemptCount === 1 ? '' : 's'}`;
  return 'Idle';
}

function retryTone(
  distribution: MarketingDistributionSummary | null,
  failure: MarketingDistributionView['failure']
): DistributionViewTone {
  if (failure && !failure.retryable) return 'danger';
  if (failure || distribution?.attemptState === 'retry_wait') return 'warning';
  if (distribution?.attemptState === 'inflight') return 'info';
  if (distribution?.attemptState === 'failed') return 'danger';
  return 'neutral';
}

function legacyDeliveryState(
  distribution: MarketingDistributionSummary | null
): MarketingDistributionView['deliveryState'] {
  const status = distribution?.publicationStatus?.toLowerCase();
  if (status === 'draft') return 'draft';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'publishing') return 'publishing';
  if (status === 'published' || status === 'posted') return 'published';
  if (status === 'failed' || distribution?.attemptState === 'failed') return 'failed';
  return 'unmeasured';
}

function normalizedFailure(
  input: MarketingDistributionViewInput,
  receipt: ProviderReceipt | null
): MarketingDistributionView['failure'] {
  if (receipt?.state === 'failed') {
    return {
      category: receipt.error?.category ?? 'unknown',
      retryable: isRetryableCategory(receipt.error?.category),
    };
  }
  if (input.distribution?.attemptState === 'failed') {
    return { category: 'distribution', retryable: false };
  }
  if (input.distribution?.attemptState === 'retry_wait') {
    return { category: 'transient', retryable: true };
  }
  return null;
}

function normalizedMetrics(evidence: AnalyticsEvidence | null): DistributionMetricView[] {
  if (!evidence) return [];
  return evidence.metrics.map((metric) => ({
    label: metric.normalized_label ?? metric.provider_label,
    providerLabel: metric.provider_label,
    value: metric.value,
  }));
}

function recommendationFor(input: {
  freshness: DistributionFreshness;
  metrics: DistributionMetricView[];
  failure: MarketingDistributionView['failure'];
  evidenceCount: number;
}): MarketingDistributionView['recommendation'] {
  if (input.failure) {
    return {
      title: 'Reconcile delivery before retrying',
      detail: input.failure.retryable
        ? 'Confirm normalized provider state before the bounded retry runs.'
        : 'Resolve the classified failure and require explicit review before replacement.',
      evidenceCount: input.evidenceCount,
    };
  }
  if (input.freshness !== 'fresh') {
    return {
      title: 'Wait for fresh outcome evidence',
      detail: 'Do not change product work or creative direction from stale or missing analytics.',
      evidenceCount: input.evidenceCount,
    };
  }
  if (input.metrics.length === 0) {
    return {
      title: 'Keep the result unmeasured',
      detail: 'Fresh synchronization returned no allowlisted platform metrics to compare.',
      evidenceCount: input.evidenceCount,
    };
  }
  const leadingMetric = [...input.metrics].sort((a, b) => b.value - a.value)[0];
  return {
    title: 'Use this as a measured baseline',
    detail: `${leadingMetric.label} is ${leadingMetric.value.toLocaleString()}; compare it with another approved experiment before changing direction.`,
    evidenceCount: input.evidenceCount,
  };
}

function effectiveAnalyticsFreshness(
  evidence: AnalyticsEvidence | null,
  now: Date
): DistributionFreshness {
  if (!evidence) return 'unmeasured';
  if (evidence.freshness !== 'fresh') return evidence.freshness;
  return freshnessFromObservedAt(evidence.observed_at, now);
}

function freshnessFromObservedAt(observedAt: string, now: Date): DistributionFreshness {
  const observed = Date.parse(observedAt);
  if (!Number.isFinite(observed)) return 'failed';
  const age = now.getTime() - observed;
  return age <= DISTRIBUTION_EVIDENCE_FRESHNESS_HOURS * 60 * 60 * 1000 && age >= 0
    ? 'fresh'
    : 'stale';
}

function latestByObservedAt<T extends { observed_at: string }>(items: T[]): T | null {
  return (
    [...items].sort(
      (left, right) => Date.parse(right.observed_at) - Date.parse(left.observed_at)
    )[0] ?? null
  );
}

function isRetryableCategory(
  category: NonNullable<ProviderReceipt['error']>['category'] | undefined
) {
  return category === 'throttling' || category === 'provider' || category === 'network';
}

function safePlatform(platform: string) {
  if (platform === 'youtube_shorts' || platform === 'youtube') return 'YouTube Shorts';
  if (platform === 'instagram_reels' || platform === 'instagram') return 'Instagram Reels';
  return 'Unmeasured platform';
}

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());
}
