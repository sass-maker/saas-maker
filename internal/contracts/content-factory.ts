/** Versioned, provider-neutral contracts for generation-only Content Factory handoffs. */

export const CONTENT_FACTORY_BRIEF_SCHEMA_VERSION = 1 as const;
export const CONTENT_FACTORY_MANIFEST_SCHEMA_VERSION = 1 as const;

export type ContentFactoryChannelIntent = 'instagram_reels' | 'youtube_shorts';
export type ContentFactoryFormat = 'vertical_video_9_16';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  stage: 'content' | 'distribution' | 'artifact_review';
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  evidence_ref: string | null;
}

export interface ContentFactoryBrief {
  schema_version: typeof CONTENT_FACTORY_BRIEF_SCHEMA_VERSION;
  brief_id: string;
  brief_version: number;
  project_id: string;
  campaign_id: string;
  experiment_id: string | null;
  input_hash: string;
  source: {
    kind: string;
    id: string;
    revision: string | null;
  };
  requested_formats: ContentFactoryFormat[];
  channel_intent: ContentFactoryChannelIntent[];
  content: {
    title: string;
    hook: string;
    body: string;
    call_to_action: string;
  };
  content_approval: ApprovalRecord & { stage: 'content' };
  submitted_at: string;
}

export type ContentFactoryQualityStatus = 'passed' | 'failed' | 'review';
export type ContentFactoryQualityCheckStatus = 'passed' | 'failed' | 'unavailable';

export interface ContentFactoryQualityEvidence {
  status: ContentFactoryQualityStatus;
  checks: Array<{
    id: string;
    status: ContentFactoryQualityCheckStatus;
    observed_at: string;
    evidence_ref: string | null;
    message: string | null;
  }>;
}

export interface ContentFactoryArtifactManifest {
  schema_version: typeof CONTENT_FACTORY_MANIFEST_SCHEMA_VERSION;
  manifest_id: string;
  generation_run_id: string;
  brief: {
    id: string;
    version: number;
  };
  project_id: string;
  campaign_id: string;
  experiment_id: string | null;
  input_hash: string;
  renderer: {
    id: string;
    version: string;
  };
  variants: Array<{
    id: string;
    format: ContentFactoryFormat;
    channel_intent: ContentFactoryChannelIntent[];
  }>;
  assets: Array<{
    id: string;
    variant_id: string;
    media_type: string;
    location: string;
    sha256: string;
    size_bytes: number;
  }>;
  quality: ContentFactoryQualityEvidence;
  provenance: Array<{
    kind: string;
    id: string;
    revision: string | null;
  }>;
  review: ApprovalRecord & { stage: 'artifact_review' };
  created_at: string;
}

export type ContractValidationResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

export function validateApprovedContentFactoryBrief(
  input: unknown
): ContractValidationResult<ContentFactoryBrief> {
  const issues: string[] = [];
  const brief = asRecord(input);

  if (!brief) return invalid('brief must be an object');
  if (brief.schema_version !== CONTENT_FACTORY_BRIEF_SCHEMA_VERSION) {
    issues.push('schema_version must be 1');
  }
  requireString(brief, 'brief_id', issues);
  requirePositiveInteger(brief, 'brief_version', issues);
  requireString(brief, 'project_id', issues);
  requireString(brief, 'campaign_id', issues);
  requireNullableString(brief, 'experiment_id', issues);
  requireSha256(brief, 'input_hash', issues);
  validateProvenance(brief.source, 'source', issues);
  requireEnumArray(brief.requested_formats, ['vertical_video_9_16'], 'requested_formats', issues);
  requireEnumArray(
    brief.channel_intent,
    ['instagram_reels', 'youtube_shorts'],
    'channel_intent',
    issues
  );
  const content = asRecord(brief.content);
  if (!content) {
    issues.push('content must be an object');
  } else {
    for (const field of ['title', 'hook', 'body', 'call_to_action']) {
      requireString(content, field, issues, `content.${field}`);
    }
  }
  validateApproval(brief.content_approval, 'content', 'content_approval', issues, true);
  requireIsoDate(brief, 'submitted_at', issues);

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: deepFreeze(structuredClone(input) as ContentFactoryBrief) };
}

export function validateContentFactoryArtifactManifest(
  input: unknown
): ContractValidationResult<ContentFactoryArtifactManifest> {
  const issues: string[] = [];
  const manifest = asRecord(input);

  if (!manifest) return invalid('manifest must be an object');
  if (manifest.schema_version !== CONTENT_FACTORY_MANIFEST_SCHEMA_VERSION) {
    issues.push('schema_version must be 1');
  }
  requireString(manifest, 'manifest_id', issues);
  requireString(manifest, 'generation_run_id', issues);
  requireString(manifest, 'project_id', issues);
  requireString(manifest, 'campaign_id', issues);
  requireNullableString(manifest, 'experiment_id', issues);
  requireSha256(manifest, 'input_hash', issues);
  requireIsoDate(manifest, 'created_at', issues);

  const brief = asRecord(manifest.brief);
  if (!brief) {
    issues.push('brief must be an object');
  } else {
    requireString(brief, 'id', issues, 'brief.id');
    requirePositiveInteger(brief, 'version', issues, 'brief.version');
  }

  const renderer = asRecord(manifest.renderer);
  if (!renderer) {
    issues.push('renderer must be an object');
  } else {
    requireString(renderer, 'id', issues, 'renderer.id');
    requireString(renderer, 'version', issues, 'renderer.version');
  }

  if (!Array.isArray(manifest.variants) || manifest.variants.length === 0) {
    issues.push('variants must contain at least one variant');
  } else {
    for (const [index, rawVariant] of manifest.variants.entries()) {
      const variant = asRecord(rawVariant);
      const prefix = `variants[${index}]`;
      if (!variant) {
        issues.push(`${prefix} must be an object`);
        continue;
      }
      requireString(variant, 'id', issues, `${prefix}.id`);
      if (variant.format !== 'vertical_video_9_16') {
        issues.push(`${prefix}.format must be vertical_video_9_16`);
      }
      requireEnumArray(
        variant.channel_intent,
        ['instagram_reels', 'youtube_shorts'],
        `${prefix}.channel_intent`,
        issues
      );
    }
  }

  if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
    issues.push('assets must contain at least one verified asset');
  } else {
    const variantIds = new Set(
      Array.isArray(manifest.variants)
        ? manifest.variants
            .map(asRecord)
            .filter((value): value is Record<string, unknown> => value !== null)
            .map((value) => value.id)
            .filter((value): value is string => typeof value === 'string')
        : []
    );
    for (const [index, rawAsset] of manifest.assets.entries()) {
      const asset = asRecord(rawAsset);
      const prefix = `assets[${index}]`;
      if (!asset) {
        issues.push(`${prefix} must be an object`);
        continue;
      }
      requireString(asset, 'id', issues, `${prefix}.id`);
      requireString(asset, 'variant_id', issues, `${prefix}.variant_id`);
      if (typeof asset.variant_id === 'string' && !variantIds.has(asset.variant_id)) {
        issues.push(`${prefix}.variant_id must reference a manifest variant`);
      }
      requireString(asset, 'media_type', issues, `${prefix}.media_type`);
      requireString(asset, 'location', issues, `${prefix}.location`);
      requireSha256(asset, 'sha256', issues, `${prefix}.sha256`);
      requireNonNegativeInteger(asset, 'size_bytes', issues, `${prefix}.size_bytes`);
    }
  }

  validateQuality(manifest.quality, issues);
  if (!Array.isArray(manifest.provenance) || manifest.provenance.length === 0) {
    issues.push('provenance must contain at least one source');
  } else {
    manifest.provenance.forEach((entry, index) =>
      validateProvenance(entry, `provenance[${index}]`, issues)
    );
  }
  validateApproval(manifest.review, 'artifact_review', 'review', issues, false);

  return issues.length > 0
    ? { ok: false, issues }
    : {
        ok: true,
        value: deepFreeze(structuredClone(input) as ContentFactoryArtifactManifest),
      };
}

export function isContentFactoryManifestDistributionReady(
  manifest: ContentFactoryArtifactManifest
): boolean {
  return (
    manifest.quality.status === 'passed' &&
    manifest.quality.checks.length > 0 &&
    manifest.quality.checks.every((check) => check.status === 'passed') &&
    manifest.review.status === 'approved' &&
    manifest.assets.length > 0
  );
}

function validateQuality(input: unknown, issues: string[]): void {
  const quality = asRecord(input);
  if (!quality) {
    issues.push('quality must be an object');
    return;
  }
  if (!['passed', 'failed', 'review'].includes(String(quality.status))) {
    issues.push('quality.status must be passed, failed, or review');
  }
  if (!Array.isArray(quality.checks) || quality.checks.length === 0) {
    issues.push('quality.checks must contain at least one check');
    return;
  }
  for (const [index, rawCheck] of quality.checks.entries()) {
    const check = asRecord(rawCheck);
    const prefix = `quality.checks[${index}]`;
    if (!check) {
      issues.push(`${prefix} must be an object`);
      continue;
    }
    requireString(check, 'id', issues, `${prefix}.id`);
    if (!['passed', 'failed', 'unavailable'].includes(String(check.status))) {
      issues.push(`${prefix}.status must be passed, failed, or unavailable`);
    }
    requireIsoDate(check, 'observed_at', issues, `${prefix}.observed_at`);
    requireNullableString(check, 'evidence_ref', issues, `${prefix}.evidence_ref`);
    requireNullableString(check, 'message', issues, `${prefix}.message`);
  }
}

function validateApproval(
  input: unknown,
  stage: ApprovalRecord['stage'],
  label: string,
  issues: string[],
  requireApproved: boolean
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
  requireNullableString(approval, 'decided_by', issues, `${label}.decided_by`);
  requireNullableIsoDate(approval, 'decided_at', issues, `${label}.decided_at`);
  requireNullableString(approval, 'evidence_ref', issues, `${label}.evidence_ref`);
  if (requireApproved && approval.status !== 'approved') {
    issues.push(`${label}.status must be approved before generation`);
  }
  if (
    approval.status === 'approved' &&
    (typeof approval.decided_by !== 'string' || !isIsoDate(approval.decided_at))
  ) {
    issues.push(`${label} approval requires decided_by and decided_at`);
  }
}

function validateProvenance(input: unknown, label: string, issues: string[]): void {
  const source = asRecord(input);
  if (!source) {
    issues.push(`${label} must be an object`);
    return;
  }
  requireString(source, 'kind', issues, `${label}.kind`);
  requireString(source, 'id', issues, `${label}.id`);
  requireNullableString(source, 'revision', issues, `${label}.revision`);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalid<T>(issue: string): ContractValidationResult<T> {
  return { ok: false, issues: [issue] };
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

function requireNullableString(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (value[key] !== null && typeof value[key] !== 'string') {
    issues.push(`${label} must be a string or null`);
  }
}

function requirePositiveInteger(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (!Number.isInteger(value[key]) || Number(value[key]) < 1) {
    issues.push(`${label} must be a positive integer`);
  }
}

function requireNonNegativeInteger(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (!Number.isInteger(value[key]) || Number(value[key]) < 0) {
    issues.push(`${label} must be a non-negative integer`);
  }
}

function requireSha256(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (typeof value[key] !== 'string' || !/^[a-f0-9]{64}$/i.test(value[key])) {
    issues.push(`${label} must be a hexadecimal SHA-256 digest`);
  }
}

function requireIsoDate(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (!isIsoDate(value[key])) issues.push(`${label} must be an ISO-8601 timestamp`);
}

function requireNullableIsoDate(
  value: Record<string, unknown>,
  key: string,
  issues: string[],
  label = key
): void {
  if (value[key] !== null && !isIsoDate(value[key])) {
    issues.push(`${label} must be an ISO-8601 timestamp or null`);
  }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
}

function requireEnumArray(
  value: unknown,
  allowed: string[],
  label: string,
  issues: string[]
): void {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || !allowed.includes(entry))
  ) {
    issues.push(`${label} must contain only: ${allowed.join(', ')}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}
