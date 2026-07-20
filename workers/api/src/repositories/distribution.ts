import type {
  AnalyticsEvidence,
  DistributionFreshness,
  DistributionRequest,
  ProviderReceipt,
} from '../../../../internal/contracts/distribution';

export type DeliveryMappingState =
  | 'reserved'
  | 'mapped'
  | 'ambiguous'
  | 'terminal'
  | 'replacement_approved';

export interface DeliveryMappingRecord {
  id: string;
  distribution_request_id: string;
  content_hash: string;
  integration_id: string;
  project_id: string;
  campaign_id: string;
  brief_id: string;
  artifact_manifest_id: string;
  experiment_id: string | null;
  platform: string;
  provider: 'postiz';
  provider_post_id: string | null;
  previous_provider_post_id: string | null;
  state: DeliveryMappingState;
  replacement_count: number;
  replacement_approved_by: string | null;
  replacement_approved_at: string | null;
  replacement_evidence_ref: string | null;
  last_reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReplacementApproval {
  status: 'approved';
  decided_by: string;
  decided_at: string;
  evidence_ref: string;
}

export interface MappingReservation {
  mapping: DeliveryMappingRecord;
  created: boolean;
}

export interface DeliveryMappingRepository {
  find(request: DistributionRequest): Promise<DeliveryMappingRecord | null>;
  reserve(request: DistributionRequest, platform: string): Promise<MappingReservation>;
  markMapped(mappingId: string, providerPostId: string): Promise<DeliveryMappingRecord>;
  markAmbiguous(mappingId: string): Promise<void>;
  recordReconciliation(mappingId: string, reconciledAt: string): Promise<void>;
  reserveReplacement(
    mappingId: string,
    approval: ReplacementApproval
  ): Promise<DeliveryMappingRecord | null>;
  isProviderPostMapped(providerPostId: string, exceptMappingId: string): Promise<boolean>;
}

export interface EvidenceCandidate extends DeliveryMappingRecord {
  provider_post_id: string;
}

export type NormalizedProviderReceipt = Omit<ProviderReceipt, 'provider_release_url' | 'error'> & {
  freshness: DistributionFreshness;
};

export interface DistributionEvidenceRepository {
  getCursor(source: 'postiz'): Promise<string | null>;
  listMappedDeliveries(input: {
    cursor: string | null;
    activeSince: string;
    limit: number;
  }): Promise<{ items: EvidenceCandidate[]; nextCursor: string | null }>;
  saveCursor(source: 'postiz', cursor: string | null, observedAt: string): Promise<void>;
  saveProviderReceipt(receipt: NormalizedProviderReceipt): Promise<void>;
  saveAnalyticsEvidence(evidence: AnalyticsEvidence): Promise<void>;
}

interface RepositoryOptions {
  now?: () => string;
  newId?: () => string;
}

export class D1DistributionRepository
  implements DeliveryMappingRepository, DistributionEvidenceRepository
{
  private readonly now: () => string;
  private readonly newId: () => string;

  constructor(
    private readonly db: D1Database,
    options: RepositoryOptions = {}
  ) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.newId = options.newId ?? (() => crypto.randomUUID());
  }

  async reserve(request: DistributionRequest, platform: string): Promise<MappingReservation> {
    const id = this.newId();
    const now = this.now();
    const result = await this.db
      .prepare(
        `INSERT INTO distribution_delivery_mappings (
          id, distribution_request_id, content_hash, integration_id, project_id, campaign_id,
          brief_id, artifact_manifest_id, experiment_id, platform, provider, state, created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'postiz', 'reserved', ?, ?)
        ON CONFLICT(distribution_request_id, content_hash, integration_id) DO NOTHING`
      )
      .bind(
        id,
        request.request_id,
        request.content_hash,
        request.integration_id,
        request.project_id,
        request.campaign_id,
        request.brief_id,
        request.artifact_manifest_id,
        request.experiment_id,
        platform,
        now,
        now
      )
      .run();
    const mapping = await this.findByKey(request);
    if (!mapping) throw new Error('Delivery mapping reservation was not persisted');
    return { mapping, created: Number(result.meta.changes ?? 0) > 0 };
  }

  async find(request: DistributionRequest): Promise<DeliveryMappingRecord | null> {
    return this.findByKey(request);
  }

  async markMapped(mappingId: string, providerPostId: string): Promise<DeliveryMappingRecord> {
    const now = this.now();
    await this.db
      .prepare(
        `UPDATE distribution_delivery_mappings
         SET provider_post_id = ?, state = 'mapped', updated_at = ?
         WHERE id = ? AND state IN ('reserved', 'ambiguous', 'replacement_approved')`
      )
      .bind(providerPostId, now, mappingId)
      .run();
    const mapping = await this.findById(mappingId);
    if (!mapping || mapping.provider_post_id !== providerPostId || mapping.state !== 'mapped') {
      throw new Error('Delivery mapping could not be completed');
    }
    return mapping;
  }

  async markAmbiguous(mappingId: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE distribution_delivery_mappings
         SET state = 'ambiguous', updated_at = ?
         WHERE id = ? AND state IN ('reserved', 'replacement_approved')`
      )
      .bind(this.now(), mappingId)
      .run();
  }

  async recordReconciliation(mappingId: string, reconciledAt: string): Promise<void> {
    await this.db
      .prepare(
        `UPDATE distribution_delivery_mappings
         SET last_reconciled_at = ?, updated_at = ?
         WHERE id = ? AND state = 'ambiguous'`
      )
      .bind(reconciledAt, this.now(), mappingId)
      .run();
  }

  async reserveReplacement(
    mappingId: string,
    approval: ReplacementApproval
  ): Promise<DeliveryMappingRecord | null> {
    const result = await this.db
      .prepare(
        `UPDATE distribution_delivery_mappings
         SET previous_provider_post_id = provider_post_id,
             provider_post_id = NULL,
             state = 'replacement_approved',
             replacement_count = replacement_count + 1,
             replacement_approved_by = ?,
             replacement_approved_at = ?,
             replacement_evidence_ref = ?,
             updated_at = ?
         WHERE id = ? AND state IN ('ambiguous', 'terminal')`
      )
      .bind(approval.decided_by, approval.decided_at, approval.evidence_ref, this.now(), mappingId)
      .run();
    if (Number(result.meta.changes ?? 0) === 0) return null;
    return this.findById(mappingId);
  }

  async isProviderPostMapped(providerPostId: string, exceptMappingId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        `SELECT id FROM distribution_delivery_mappings
         WHERE provider = 'postiz' AND provider_post_id = ? AND id <> ? LIMIT 1`
      )
      .bind(providerPostId, exceptMappingId)
      .first();
    return row !== null;
  }

  async getCursor(source: 'postiz'): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT cursor FROM distribution_sync_cursors WHERE source = ?')
      .bind(source)
      .first<{ cursor: string | null }>();
    return row?.cursor ?? null;
  }

  async listMappedDeliveries(input: {
    cursor: string | null;
    activeSince: string;
    limit: number;
  }): Promise<{ items: EvidenceCandidate[]; nextCursor: string | null }> {
    const cursor = decodeCursor(input.cursor);
    const query = cursor
      ? `SELECT * FROM distribution_delivery_mappings
         WHERE state = 'mapped' AND provider_post_id IS NOT NULL AND updated_at >= ?
           AND (updated_at > ? OR (updated_at = ? AND id > ?))
         ORDER BY updated_at ASC, id ASC LIMIT ?`
      : `SELECT * FROM distribution_delivery_mappings
         WHERE state = 'mapped' AND provider_post_id IS NOT NULL AND updated_at >= ?
         ORDER BY updated_at ASC, id ASC LIMIT ?`;
    const statement = cursor
      ? this.db
          .prepare(query)
          .bind(input.activeSince, cursor.updatedAt, cursor.updatedAt, cursor.id, input.limit)
      : this.db.prepare(query).bind(input.activeSince, input.limit);
    const { results } = await statement.all<DeliveryMappingRecord>();
    const items = results.filter(
      (mapping): mapping is EvidenceCandidate => typeof mapping.provider_post_id === 'string'
    );
    const last = items.at(-1);
    return {
      items,
      nextCursor: last ? encodeEvidenceCursor(last.updated_at, last.id) : null,
    };
  }

  async saveCursor(source: 'postiz', cursor: string | null, observedAt: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO distribution_sync_cursors (source, cursor, observed_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(source) DO UPDATE SET
           cursor = excluded.cursor,
           observed_at = excluded.observed_at,
           updated_at = excluded.updated_at`
      )
      .bind(source, cursor, observedAt, this.now())
      .run();
  }

  async saveProviderReceipt(receipt: NormalizedProviderReceipt): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO distribution_provider_receipts (
          id, distribution_request_id, project_id, campaign_id, brief_id, artifact_manifest_id,
          experiment_id, integration_id, platform, provider_post_id, provider_release_id,
          release_status, source, observed_at, freshness
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        receipt.receipt_id,
        receipt.distribution_request_id,
        receipt.project_id,
        receipt.campaign_id,
        receipt.brief_id,
        receipt.artifact_manifest_id,
        receipt.experiment_id,
        receipt.integration_id,
        receipt.platform,
        receipt.provider_post_id,
        receipt.provider_release_id,
        receipt.state,
        receipt.source,
        receipt.observed_at,
        receipt.freshness
      )
      .run();
  }

  async saveAnalyticsEvidence(evidence: AnalyticsEvidence): Promise<void> {
    const allowlistedMetrics = evidence.metrics.map((metric) => ({
      provider_label: metric.provider_label,
      normalized_label: metric.normalized_label,
      value: metric.value,
    }));
    await this.db
      .prepare(
        `INSERT INTO distribution_analytics_evidence (
          id, distribution_request_id, project_id, campaign_id, brief_id, artifact_manifest_id,
          experiment_id, integration_id, platform, provider_post_id, source, observed_at,
          freshness, metrics_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        evidence.evidence_id,
        evidence.distribution_request_id,
        evidence.project_id,
        evidence.campaign_id,
        evidence.brief_id,
        evidence.artifact_manifest_id,
        evidence.experiment_id,
        evidence.integration_id,
        evidence.platform,
        evidence.provider_post_id,
        evidence.source,
        evidence.observed_at,
        evidence.freshness,
        JSON.stringify(allowlistedMetrics)
      )
      .run();
  }

  private async findByKey(request: DistributionRequest): Promise<DeliveryMappingRecord | null> {
    return this.db
      .prepare(
        `SELECT * FROM distribution_delivery_mappings
         WHERE distribution_request_id = ? AND content_hash = ? AND integration_id = ?`
      )
      .bind(request.request_id, request.content_hash, request.integration_id)
      .first<DeliveryMappingRecord>();
  }

  private async findById(mappingId: string): Promise<DeliveryMappingRecord | null> {
    return this.db
      .prepare('SELECT * FROM distribution_delivery_mappings WHERE id = ?')
      .bind(mappingId)
      .first<DeliveryMappingRecord>();
  }
}

export function encodeEvidenceCursor(updatedAt: string, id: string): string {
  return JSON.stringify([updatedAt, id]);
}

function decodeCursor(value: string | null): { updatedAt: string; id: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      !Number.isNaN(Date.parse(parsed[0]))
    ) {
      return { updatedAt: parsed[0], id: parsed[1] };
    }
  } catch {
    // Invalid cursors fail closed rather than silently restarting a scan.
  }
  throw new Error('Invalid distribution evidence cursor');
}
