import type { ApprovalRecord, ContractValidationResult } from './content-factory';

/** Versioned, provider-neutral Foundry distribution and outcome-evidence contracts. */

export const DISTRIBUTION_SCHEMA_VERSION = 1 as const;

export type DistributionChannel = 'instagram_reels' | 'youtube_shorts';
export type DistributionIntent = 'draft' | 'schedule' | 'now';
export type DistributionAudience = 'public' | 'unlisted' | 'private';
export type DistributionFreshness = 'fresh' | 'stale' | 'failed' | 'unmeasured';

export interface DistributionRequest {
  schema_version: typeof DISTRIBUTION_SCHEMA_VERSION;
  request_id: string;
  project_id: string;
  campaign_id: string;
  brief_id: string;
  brief_version: number;
  artifact_manifest_id: string;
  experiment_id: string | null;
  content_hash: string;
  integration_id: string;
  channel: DistributionChannel;
  intent: DistributionIntent;
  scheduled_for: string | null;
  requested_at: string;
  audience: DistributionAudience;
  content: {
    title: string;
    caption: string;
    tags: string[];
  };
  assets: Array<{
    artifact_asset_id: string;
    media_type: string;
    location: string;
    sha256: string;
  }>;
  content_approval: ApprovalRecord & { stage: 'content' };
  distribution_approval: ApprovalRecord & { stage: 'distribution' };
}

export interface DeliveryMapping {
  schema_version: typeof DISTRIBUTION_SCHEMA_VERSION;
  mapping_id: string;
  distribution_request_id: string;
  content_hash: string;
  integration_id: string;
  provider: string;
  provider_post_id: string;
  state: 'mapped' | 'terminal' | 'replacement_approved';
  created_at: string;
  updated_at: string;
}

export interface ProviderReceipt {
  schema_version: typeof DISTRIBUTION_SCHEMA_VERSION;
  receipt_id: string;
  source: string;
  distribution_request_id: string;
  project_id: string;
  campaign_id: string;
  brief_id: string;
  artifact_manifest_id: string;
  experiment_id: string | null;
  integration_id: string;
  platform: string;
  provider_post_id: string;
  provider_release_id: string | null;
  provider_release_url: string | null;
  state: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'unknown';
  observed_at: string;
  error: {
    category: 'validation' | 'authentication' | 'throttling' | 'provider' | 'network' | 'unknown';
    code: string;
    message: string;
  } | null;
}

export interface AnalyticsEvidence {
  schema_version: typeof DISTRIBUTION_SCHEMA_VERSION;
  evidence_id: string;
  source: string;
  distribution_request_id: string;
  project_id: string;
  campaign_id: string;
  brief_id: string;
  artifact_manifest_id: string;
  experiment_id: string | null;
  integration_id: string;
  platform: string;
  provider_post_id: string;
  observed_at: string;
  freshness: DistributionFreshness;
  metrics: Array<{
    provider_label: string;
    normalized_label: string | null;
    value: number;
    period_start: string | null;
    period_end: string | null;
  }>;
}

export function validateDistributionRequest(
  input: unknown
): ContractValidationResult<DistributionRequest> {
  const issues: string[] = [];
  const request = asRecord(input);
  if (!request) return { ok: false, issues: ['distribution request must be an object'] };

  if (request.schema_version !== DISTRIBUTION_SCHEMA_VERSION) {
    issues.push('schema_version must be 1');
  }
  for (const key of [
    'request_id',
    'project_id',
    'campaign_id',
    'brief_id',
    'artifact_manifest_id',
    'integration_id',
  ]) {
    requireString(request, key, issues);
  }
  if (!Number.isInteger(request.brief_version) || Number(request.brief_version) < 1) {
    issues.push('brief_version must be a positive integer');
  }
  if (request.experiment_id !== null && typeof request.experiment_id !== 'string') {
    issues.push('experiment_id must be a string or null');
  }
  if (typeof request.content_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(request.content_hash)) {
    issues.push('content_hash must be a hexadecimal SHA-256 digest');
  }
  if (!['instagram_reels', 'youtube_shorts'].includes(String(request.channel))) {
    issues.push('channel must be instagram_reels or youtube_shorts');
  }
  if (!['draft', 'schedule', 'now'].includes(String(request.intent))) {
    issues.push('intent must be draft, schedule, or now');
  }
  if (!['public', 'unlisted', 'private'].includes(String(request.audience))) {
    issues.push('audience must be public, unlisted, or private');
  }
  if (!isIsoDate(request.requested_at)) issues.push('requested_at must be an ISO-8601 timestamp');
  if (request.intent === 'schedule' && !isIsoDate(request.scheduled_for)) {
    issues.push('scheduled_for is required for scheduled distribution');
  } else if (request.scheduled_for !== null && !isIsoDate(request.scheduled_for)) {
    issues.push('scheduled_for must be an ISO-8601 timestamp or null');
  }

  const content = asRecord(request.content);
  if (!content) {
    issues.push('content must be an object');
  } else {
    requireString(content, 'title', issues, 'content.title');
    requireString(content, 'caption', issues, 'content.caption');
    if (!Array.isArray(content.tags) || content.tags.some((tag) => typeof tag !== 'string')) {
      issues.push('content.tags must be an array of strings');
    }
  }

  if (!Array.isArray(request.assets) || request.assets.length === 0) {
    issues.push('assets must contain at least one artifact');
  } else {
    for (const [index, rawAsset] of request.assets.entries()) {
      const asset = asRecord(rawAsset);
      if (!asset) {
        issues.push(`assets[${index}] must be an object`);
        continue;
      }
      requireString(asset, 'artifact_asset_id', issues, `assets[${index}].artifact_asset_id`);
      requireString(asset, 'media_type', issues, `assets[${index}].media_type`);
      requireString(asset, 'location', issues, `assets[${index}].location`);
      if (typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(asset.sha256)) {
        issues.push(`assets[${index}].sha256 must be a hexadecimal SHA-256 digest`);
      }
    }
  }

  validateApproval(request.content_approval, 'content', 'content_approval', issues);
  validateApproval(request.distribution_approval, 'distribution', 'distribution_approval', issues);
  if (asRecord(request.content_approval)?.status !== 'approved') {
    issues.push('content_approval must be approved');
  }
  if (
    request.intent !== 'draft' &&
    asRecord(request.distribution_approval)?.status !== 'approved'
  ) {
    issues.push('distribution_approval must be approved for schedule or now');
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as DistributionRequest };
}

function validateApproval(
  input: unknown,
  stage: ApprovalRecord['stage'],
  label: string,
  issues: string[]
): void {
  const approval = asRecord(input);
  if (!approval) {
    issues.push(`${label} must be an object`);
    return;
  }
  if (approval.stage !== stage) issues.push(`${label}.stage must be ${stage}`);
  if (!['pending', 'approved', 'rejected'].includes(String(approval.status))) {
    issues.push(`${label}.status must be pending, approved, or rejected`);
  }
  if (approval.decided_by !== null && typeof approval.decided_by !== 'string') {
    issues.push(`${label}.decided_by must be a string or null`);
  }
  if (approval.decided_at !== null && !isIsoDate(approval.decided_at)) {
    issues.push(`${label}.decided_at must be an ISO-8601 timestamp or null`);
  }
  if (approval.evidence_ref !== null && typeof approval.evidence_ref !== 'string') {
    issues.push(`${label}.evidence_ref must be a string or null`);
  }
  if (
    approval.status === 'approved' &&
    (typeof approval.decided_by !== 'string' || !isIsoDate(approval.decided_at))
  ) {
    issues.push(`${label} approval requires decided_by and decided_at`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (typeof value[key] !== 'string' || value[key].trim() === '') {
    issues.push(`${label} must be a non-empty string`);
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}
