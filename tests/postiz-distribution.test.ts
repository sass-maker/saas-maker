import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import type { ContentFactoryArtifactManifest } from '../internal/contracts/content-factory';
import type { AnalyticsEvidence, DistributionRequest } from '../internal/contracts/distribution';
import {
  FakePostizHarness,
  PostizDistributionOrchestrator,
  PostizEvidenceSynchronizer,
} from '../workers/api/src/adapters/postiz';
import type {
  HostLeaseEvidence,
  PostizGateway,
  PostizMediaReference,
} from '../workers/api/src/adapters/postiz';
import {
  encodeEvidenceCursor,
  type DeliveryMappingRecord,
  type DeliveryMappingRepository,
  type DistributionEvidenceRepository,
  type EvidenceCandidate,
  type MappingReservation,
  type NormalizedProviderReceipt,
  type ReplacementApproval,
} from '../workers/api/src/repositories/distribution';

const distributionFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/distribution-v1.json', 'utf8')
) as {
  instagramDraft: DistributionRequest;
  youtubeSchedule: DistributionRequest;
  media: PostizMediaReference[];
};
const contentFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/content-factory-v1.json', 'utf8')
) as { approvedManifest: ContentFactoryArtifactManifest };
const fakeFixture = JSON.parse(
  readFileSync('tests/fixtures/postiz/fake-postiz-v1.json', 'utf8')
) as unknown;

const now = '2026-07-20T12:00:00.000Z';
const healthyLease: HostLeaseEvidence = {
  host_id: 'foundry-host-001',
  owned: true,
  healthy: true,
  observed_at: now,
  expires_at: '2026-07-22T12:00:00.000Z',
};

describe('Postiz delivery persistence and fail-closed orchestration', () => {
  it('defines a durable unique mapping and attribution-only evidence tables', () => {
    const migration = readFileSync('workers/api/migrations/0024_postiz_distribution.sql', 'utf8');
    expect(migration).toContain('UNIQUE(distribution_request_id, content_hash, integration_id)');
    expect(migration).toContain('CREATE TABLE distribution_provider_receipts');
    expect(migration).toContain('CREATE TABLE distribution_analytics_evidence');
    expect(migration).not.toMatch(/access.?token|direct.?message|comment.?body/i);
  });

  it('creates a draft once, persists its mapping, and reuses it across an unhealthy failover', async () => {
    const repository = new MemoryDistributionRepository();
    const gateway = new FakePostizHarness(fakeFixture);
    const create = vi.spyOn(gateway, 'createPost');
    const orchestrator = new PostizDistributionOrchestrator(gateway, repository, () => now);
    const input = deliveryInput(distributionFixture.instagramDraft);

    const created = await orchestrator.deliver(input);
    expect(created.outcome).toBe('created');
    expect(created.mapping.provider_post_id).toBe('fake-post-2');

    const reused = await orchestrator.deliver({
      ...input,
      hostLease: { ...healthyLease, healthy: false, expires_at: now },
    });
    expect(reused).toMatchObject({ outcome: 'reused', mapping: created.mapping });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('blocks approval, artifact, and host-lease failures before Postiz create', async () => {
    const cases: Array<{ input: ReturnType<typeof deliveryInput>; code: string }> = [];
    const unapproved = structuredClone(distributionFixture.youtubeSchedule);
    unapproved.distribution_approval.status = 'pending';
    unapproved.distribution_approval.decided_by = null;
    unapproved.distribution_approval.decided_at = null;
    unapproved.distribution_approval.evidence_ref = null;
    cases.push({ input: deliveryInput(unapproved), code: 'DISTRIBUTION_REQUEST_REJECTED' });

    const unverifiedArtifact = structuredClone(contentFixture.approvedManifest);
    unverifiedArtifact.review.status = 'pending';
    unverifiedArtifact.review.decided_by = null;
    unverifiedArtifact.review.decided_at = null;
    cases.push({
      input: {
        ...deliveryInput(distributionFixture.youtubeSchedule),
        artifact: unverifiedArtifact,
      },
      code: 'ARTIFACT_NOT_VERIFIED',
    });
    cases.push({
      input: {
        ...deliveryInput(distributionFixture.youtubeSchedule),
        hostLease: { ...healthyLease, healthy: false },
      },
      code: 'HOST_LEASE_UNHEALTHY',
    });

    for (const testCase of cases) {
      const gateway = new FakePostizHarness(fakeFixture);
      const create = vi.spyOn(gateway, 'createPost');
      const orchestrator = new PostizDistributionOrchestrator(
        gateway,
        new MemoryDistributionRepository(),
        () => now
      );
      await expect(orchestrator.deliver(testCase.input)).rejects.toMatchObject({
        code: testCase.code,
      });
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('reconciles an ambiguous create before retrying and does not duplicate it', async () => {
    const repository = new MemoryDistributionRepository();
    const fake = new FakePostizHarness(fakeFixture);
    let createCalls = 0;
    const gateway = wrapGateway(fake, async (payload) => {
      createCalls += 1;
      const receipt = await fake.createPost(payload);
      throw new Error(`response lost after ${receipt[0]?.postId}`);
    });
    const orchestrator = new PostizDistributionOrchestrator(gateway, repository, () => now);
    const input = deliveryInput(distributionFixture.instagramDraft);

    await expect(orchestrator.deliver(input)).rejects.toThrow('response lost');
    const reconciled = await orchestrator.deliver(input);
    expect(reconciled).toMatchObject({
      outcome: 'reconciled',
      mapping: { provider_post_id: 'fake-post-2' },
    });
    expect(createCalls).toBe(1);
  });

  it('requires approval recorded after reconciliation before an explicit replacement', async () => {
    const repository = new MemoryDistributionRepository();
    const fake = new FakePostizHarness(fakeFixture);
    let ambiguous = true;
    let createCalls = 0;
    const gateway = wrapGateway(fake, async (payload) => {
      createCalls += 1;
      if (ambiguous) throw new Error('connection closed before receipt');
      return fake.createPost(payload);
    });
    const orchestrator = new PostizDistributionOrchestrator(gateway, repository, () => now);
    const input = deliveryInput(distributionFixture.youtubeSchedule);

    await expect(orchestrator.deliver(input)).rejects.toThrow('connection closed');
    await expect(orchestrator.deliver(input)).rejects.toMatchObject({
      code: 'REPLACEMENT_APPROVAL_REQUIRED',
    });
    expect(createCalls).toBe(1);

    ambiguous = false;
    const replacementApproval: ReplacementApproval = {
      status: 'approved',
      decided_by: 'owner-001',
      decided_at: '2026-07-20T12:01:00.000Z',
      evidence_ref: 'approval://replacement/001',
    };
    const replaced = await orchestrator.deliver({ ...input, replacementApproval });
    expect(replaced.outcome).toBe('replaced');
    expect(replaced.mapping.provider_post_id).toBe('fake-post-2');
    expect(repository.mappings[0]).toMatchObject({
      replacement_count: 1,
      replacement_approved_by: 'owner-001',
    });
    expect(createCalls).toBe(2);
  });
});

describe('bounded Postiz evidence synchronization', () => {
  it('honors item and time bounds and persists allowlisted evidence with full attribution', async () => {
    const repository = new MemoryDistributionRepository();
    await repository.seedMapped(distributionFixture.instagramDraft, 'instagram', 'fake-post-1');
    await repository.seedMapped(distributionFixture.youtubeSchedule, 'youtube', 'missing-post');
    const ticks = [0, 0, 0, 10];
    const synchronizer = new PostizEvidenceSynchronizer(
      new FakePostizHarness(fakeFixture),
      repository,
      {
        itemLimit: 2,
        timeLimitMs: 5,
        now: () => new Date(now),
        monotonicNow: () => ticks.shift() ?? 10,
        newId: incrementingIds(),
      }
    );

    const sync = await synchronizer.sync();
    expect(sync).toMatchObject({
      attempted: 1,
      receipts_persisted: 1,
      evidence_persisted: 1,
      bounded: true,
      truncated: true,
    });
    expect(sync.next_cursor).not.toBeNull();
    expect(repository.receipts[0]).toMatchObject({
      distribution_request_id: 'distribution-instagram-001',
      project_id: 'high-signal',
      campaign_id: 'campaign-launch-proof',
      brief_id: 'brief-high-signal-001',
      artifact_manifest_id: 'manifest-high-signal-001',
      integration_id: 'integration-instagram-001',
      experiment_id: 'experiment-hook-a',
      provider_post_id: 'fake-post-1',
      freshness: 'fresh',
    });
    expect(repository.analytics[0]).toMatchObject({
      project_id: 'high-signal',
      campaign_id: 'campaign-launch-proof',
      metrics: [{ provider_label: 'Views', normalized_label: 'views', value: 85 }],
    });
    expect(repository.receipts[0]).not.toHaveProperty('provider_release_url');
    expect(repository.receipts[0]).not.toHaveProperty('error');
  });

  it('rejects unbounded sync configuration', () => {
    const repository = new MemoryDistributionRepository();
    expect(
      () =>
        new PostizEvidenceSynchronizer(new FakePostizHarness(fakeFixture), repository, {
          itemLimit: 101,
        })
    ).toThrow('itemLimit must be an integer from 1 to 100');
    expect(
      () =>
        new PostizEvidenceSynchronizer(new FakePostizHarness(fakeFixture), repository, {
          timeLimitMs: 60_001,
        })
    ).toThrow('timeLimitMs must be an integer from 1 to 60000');
  });
});

function deliveryInput(request: DistributionRequest) {
  return {
    request: structuredClone(request),
    artifact: structuredClone(contentFixture.approvedManifest),
    media: structuredClone(distributionFixture.media),
    hostLease: { ...healthyLease },
  };
}

function wrapGateway(
  fake: FakePostizHarness,
  createPost: PostizGateway['createPost']
): PostizGateway {
  return {
    health: () => fake.health(),
    listIntegrations: () => fake.listIntegrations(),
    createPost,
    listPosts: (query) => fake.listPosts(query),
    changePostStatus: (postId, status) => fake.changePostStatus(postId, status),
    getPostAnalytics: (postId, days) => fake.getPostAnalytics(postId, days),
    getPlatformAnalytics: (integrationId, days) => fake.getPlatformAnalytics(integrationId, days),
  };
}

class MemoryDistributionRepository
  implements DeliveryMappingRepository, DistributionEvidenceRepository
{
  mappings: DeliveryMappingRecord[] = [];
  receipts: NormalizedProviderReceipt[] = [];
  analytics: AnalyticsEvidence[] = [];
  cursor: string | null = null;
  private sequence = 0;

  async find(request: DistributionRequest): Promise<DeliveryMappingRecord | null> {
    return (
      this.mappings.find(
        (mapping) =>
          mapping.distribution_request_id === request.request_id &&
          mapping.content_hash === request.content_hash &&
          mapping.integration_id === request.integration_id
      ) ?? null
    );
  }

  async reserve(request: DistributionRequest, platform: string): Promise<MappingReservation> {
    const existing = await this.find(request);
    if (existing) return { mapping: existing, created: false };
    const mapping: DeliveryMappingRecord = {
      id: `mapping-${++this.sequence}`,
      distribution_request_id: request.request_id,
      content_hash: request.content_hash,
      integration_id: request.integration_id,
      project_id: request.project_id,
      campaign_id: request.campaign_id,
      brief_id: request.brief_id,
      artifact_manifest_id: request.artifact_manifest_id,
      experiment_id: request.experiment_id,
      platform,
      provider: 'postiz',
      provider_post_id: null,
      previous_provider_post_id: null,
      state: 'reserved',
      replacement_count: 0,
      replacement_approved_by: null,
      replacement_approved_at: null,
      replacement_evidence_ref: null,
      last_reconciled_at: null,
      created_at: '2026-07-20T10:00:00.000Z',
      updated_at: '2026-07-20T10:00:00.000Z',
    };
    this.mappings.push(mapping);
    return { mapping, created: true };
  }

  async markMapped(mappingId: string, providerPostId: string): Promise<DeliveryMappingRecord> {
    const mapping = this.required(mappingId);
    mapping.provider_post_id = providerPostId;
    mapping.state = 'mapped';
    mapping.updated_at = now;
    return mapping;
  }

  async markAmbiguous(mappingId: string): Promise<void> {
    const mapping = this.required(mappingId);
    mapping.state = 'ambiguous';
    mapping.updated_at = '2026-07-20T10:01:00.000Z';
  }

  async recordReconciliation(mappingId: string, reconciledAt: string): Promise<void> {
    this.required(mappingId).last_reconciled_at = reconciledAt;
  }

  async reserveReplacement(
    mappingId: string,
    approval: ReplacementApproval
  ): Promise<DeliveryMappingRecord | null> {
    const mapping = this.required(mappingId);
    if (mapping.state !== 'ambiguous' && mapping.state !== 'terminal') return null;
    mapping.previous_provider_post_id = mapping.provider_post_id;
    mapping.provider_post_id = null;
    mapping.state = 'replacement_approved';
    mapping.replacement_count += 1;
    mapping.replacement_approved_by = approval.decided_by;
    mapping.replacement_approved_at = approval.decided_at;
    mapping.replacement_evidence_ref = approval.evidence_ref;
    return mapping;
  }

  async isProviderPostMapped(providerPostId: string, exceptMappingId: string): Promise<boolean> {
    return this.mappings.some(
      (mapping) => mapping.id !== exceptMappingId && mapping.provider_post_id === providerPostId
    );
  }

  async getCursor(): Promise<string | null> {
    return this.cursor;
  }

  async listMappedDeliveries(input: {
    cursor: string | null;
    activeSince: string;
    limit: number;
  }): Promise<{ items: EvidenceCandidate[]; nextCursor: string | null }> {
    const after = input.cursor ? (JSON.parse(input.cursor) as [string, string]) : null;
    const items = this.mappings
      .filter(
        (mapping): mapping is EvidenceCandidate =>
          mapping.state === 'mapped' &&
          mapping.provider_post_id !== null &&
          mapping.updated_at >= input.activeSince &&
          (!after ||
            mapping.updated_at > after[0] ||
            (mapping.updated_at === after[0] && mapping.id > after[1]))
      )
      .sort((left, right) =>
        left.updated_at === right.updated_at
          ? left.id.localeCompare(right.id)
          : left.updated_at.localeCompare(right.updated_at)
      )
      .slice(0, input.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: last ? encodeEvidenceCursor(last.updated_at, last.id) : null,
    };
  }

  async saveCursor(_source: 'postiz', cursor: string | null): Promise<void> {
    this.cursor = cursor;
  }

  async saveProviderReceipt(receipt: NormalizedProviderReceipt): Promise<void> {
    this.receipts.push(structuredClone(receipt));
  }

  async saveAnalyticsEvidence(evidence: AnalyticsEvidence): Promise<void> {
    this.analytics.push(structuredClone(evidence));
  }

  async seedMapped(
    request: DistributionRequest,
    platform: string,
    providerPostId: string
  ): Promise<void> {
    const reservation = await this.reserve(request, platform);
    await this.markMapped(reservation.mapping.id, providerPostId);
  }

  private required(mappingId: string): DeliveryMappingRecord {
    const mapping = this.mappings.find((candidate) => candidate.id === mappingId);
    if (!mapping) throw new Error(`missing mapping ${mappingId}`);
    return mapping;
  }
}

function incrementingIds(): () => string {
  let id = 0;
  return () => `evidence-${++id}`;
}
