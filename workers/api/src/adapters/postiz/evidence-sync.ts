import type {
  AnalyticsEvidence,
  DistributionFreshness,
  ProviderReceipt,
} from '../../../../../internal/contracts/distribution';
import {
  encodeEvidenceCursor,
  type DistributionEvidenceRepository,
  type EvidenceCandidate,
  type NormalizedProviderReceipt,
} from '../../repositories/distribution';
import type { PostizAnalyticsMetric, PostizGateway, PostizPostRecord } from './types';

export interface PostizEvidenceSyncOptions {
  itemLimit?: number;
  timeLimitMs?: number;
  activeDays?: number;
  analyticsDays?: number;
  now?: () => Date;
  monotonicNow?: () => number;
  newId?: () => string;
}

export interface PostizEvidenceSyncResult {
  source: 'postiz';
  observed_at: string;
  attempted: number;
  receipts_persisted: number;
  evidence_persisted: number;
  next_cursor: string | null;
  bounded: true;
  truncated: boolean;
}

export class PostizEvidenceSynchronizer {
  private readonly itemLimit: number;
  private readonly timeLimitMs: number;
  private readonly activeDays: number;
  private readonly analyticsDays: number;
  private readonly now: () => Date;
  private readonly monotonicNow: () => number;
  private readonly newId: () => string;

  constructor(
    private readonly gateway: PostizGateway,
    private readonly evidence: DistributionEvidenceRepository,
    options: PostizEvidenceSyncOptions = {}
  ) {
    this.itemLimit = boundedInteger(options.itemLimit ?? 25, 1, 100, 'itemLimit');
    this.timeLimitMs = boundedInteger(options.timeLimitMs ?? 5_000, 1, 60_000, 'timeLimitMs');
    this.activeDays = boundedInteger(options.activeDays ?? 30, 1, 365, 'activeDays');
    this.analyticsDays = boundedInteger(options.analyticsDays ?? 30, 1, 365, 'analyticsDays');
    this.now = options.now ?? (() => new Date());
    this.monotonicNow = options.monotonicNow ?? (() => performance.now());
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  async sync(): Promise<PostizEvidenceSyncResult> {
    const startedAt = this.monotonicNow();
    const observedAt = this.now().toISOString();
    const activeSince = new Date(
      Date.parse(observedAt) - this.activeDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const cursor = await this.evidence.getCursor('postiz');
    const page = await this.evidence.listMappedDeliveries({
      cursor,
      activeSince,
      limit: this.itemLimit,
    });

    if (page.items.length === 0) {
      await this.evidence.saveCursor('postiz', null, observedAt);
      return result(observedAt, 0, 0, 0, null, false);
    }

    let posts: Map<string, PostizPostRecord> | null = null;
    try {
      const listed = await this.gateway.listPosts({ startDate: activeSince, endDate: observedAt });
      const knownIds = new Set(page.items.map((candidate) => candidate.provider_post_id));
      posts = new Map(
        listed
          .filter((post) => knownIds.has(post.id))
          .map((post) => [post.id, normalizePost(post)] as const)
      );
    } catch {
      // Per-item failed evidence below records availability without persisting provider errors.
    }

    let attempted = 0;
    let receiptsPersisted = 0;
    let evidencePersisted = 0;
    let lastCursor = cursor;
    for (const candidate of page.items) {
      if (this.elapsed(startedAt)) break;
      attempted += 1;
      const post = posts?.get(candidate.provider_post_id) ?? null;
      const freshness: DistributionFreshness =
        posts === null ? 'failed' : post ? 'fresh' : 'unmeasured';
      await this.evidence.saveProviderReceipt(this.receipt(candidate, post, observedAt, freshness));
      receiptsPersisted += 1;

      if (freshness !== 'fresh' || !post || this.elapsed(startedAt)) {
        await this.evidence.saveAnalyticsEvidence(
          this.analyticsEvidence(candidate, observedAt, freshness, [])
        );
        evidencePersisted += 1;
      } else {
        try {
          const metrics = await this.gateway.getPostAnalytics(
            candidate.provider_post_id,
            this.analyticsDays
          );
          await this.evidence.saveAnalyticsEvidence(
            this.analyticsEvidence(candidate, observedAt, 'fresh', normalizeMetrics(metrics))
          );
        } catch {
          await this.evidence.saveAnalyticsEvidence(
            this.analyticsEvidence(candidate, observedAt, 'failed', [])
          );
        }
        evidencePersisted += 1;
      }
      lastCursor = encodeEvidenceCursor(candidate.updated_at, candidate.id);
    }

    const truncated = attempted < page.items.length || page.items.length === this.itemLimit;
    const nextCursor = attempted === page.items.length ? page.nextCursor : lastCursor;
    await this.evidence.saveCursor('postiz', nextCursor, observedAt);
    return result(
      observedAt,
      attempted,
      receiptsPersisted,
      evidencePersisted,
      nextCursor,
      truncated
    );
  }

  private elapsed(startedAt: number): boolean {
    return this.monotonicNow() - startedAt >= this.timeLimitMs;
  }

  private receipt(
    candidate: EvidenceCandidate,
    post: PostizPostRecord | null,
    observedAt: string,
    freshness: DistributionFreshness
  ): NormalizedProviderReceipt {
    const receipt: Omit<ProviderReceipt, 'provider_release_url' | 'error'> = {
      schema_version: 1,
      receipt_id: this.newId(),
      source: 'postiz',
      distribution_request_id: candidate.distribution_request_id,
      project_id: candidate.project_id,
      campaign_id: candidate.campaign_id,
      brief_id: candidate.brief_id,
      artifact_manifest_id: candidate.artifact_manifest_id,
      experiment_id: candidate.experiment_id,
      integration_id: candidate.integration_id,
      platform: post?.integration.providerIdentifier ?? candidate.platform,
      provider_post_id: candidate.provider_post_id,
      provider_release_id: post?.releaseId ?? null,
      state: normalizeState(post?.state),
      observed_at: observedAt,
    };
    return { ...receipt, freshness };
  }

  private analyticsEvidence(
    candidate: EvidenceCandidate,
    observedAt: string,
    freshness: DistributionFreshness,
    metrics: AnalyticsEvidence['metrics']
  ): AnalyticsEvidence {
    return {
      schema_version: 1,
      evidence_id: this.newId(),
      source: 'postiz',
      distribution_request_id: candidate.distribution_request_id,
      project_id: candidate.project_id,
      campaign_id: candidate.campaign_id,
      brief_id: candidate.brief_id,
      artifact_manifest_id: candidate.artifact_manifest_id,
      experiment_id: candidate.experiment_id,
      integration_id: candidate.integration_id,
      platform: candidate.platform,
      provider_post_id: candidate.provider_post_id,
      observed_at: observedAt,
      freshness,
      metrics,
    };
  }
}

function normalizePost(post: PostizPostRecord): PostizPostRecord {
  return {
    id: post.id,
    publishDate: post.publishDate,
    releaseURL: null,
    releaseId: post.releaseId,
    state: post.state,
    integration: {
      id: post.integration.id,
      providerIdentifier: post.integration.providerIdentifier,
      name: '',
    },
  };
}

function normalizeMetrics(metrics: PostizAnalyticsMetric[]): AnalyticsEvidence['metrics'] {
  const normalized: AnalyticsEvidence['metrics'] = [];
  for (const metric of metrics) {
    const providerLabel = metric.label.trim().slice(0, 100);
    const point = metric.data.at(-1);
    const value = point ? Number(point.total) : Number.NaN;
    if (!providerLabel || !Number.isFinite(value)) continue;
    normalized.push({
      provider_label: providerLabel,
      normalized_label: NORMALIZED_LABELS[providerLabel.toLowerCase()] ?? null,
      value,
      period_start: point?.date ?? null,
      period_end: point?.date ?? null,
    });
  }
  return normalized;
}

const NORMALIZED_LABELS: Readonly<Record<string, string>> = {
  views: 'views',
  impressions: 'impressions',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  saves: 'saves',
  clicks: 'clicks',
};

function normalizeState(state: string | null | undefined): ProviderReceipt['state'] {
  switch (state?.toUpperCase()) {
    case 'DRAFT':
      return 'draft';
    case 'QUEUE':
    case 'SCHEDULED':
      return 'scheduled';
    case 'PUBLISHING':
      return 'publishing';
    case 'PUBLISHED':
      return 'published';
    case 'FAILED':
    case 'ERROR':
      return 'failed';
    default:
      return 'unknown';
  }
}

function boundedInteger(value: number, min: number, max: number, name: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function result(
  observedAt: string,
  attempted: number,
  receiptsPersisted: number,
  evidencePersisted: number,
  nextCursor: string | null,
  truncated: boolean
): PostizEvidenceSyncResult {
  return {
    source: 'postiz',
    observed_at: observedAt,
    attempted,
    receipts_persisted: receiptsPersisted,
    evidence_persisted: evidencePersisted,
    next_cursor: nextCursor,
    bounded: true,
    truncated,
  };
}
