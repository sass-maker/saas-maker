import { createHash } from 'node:crypto';

import { contentVariantKey } from './significant-content-handoff.js';

export const SIGNIFICANT_RECEIPT_SCHEMA = 'significant-content-receipt/v1';
export const SIGNIFICANT_STATUS_SCHEMA = 'significant-content-status/v1';
export const SIGNIFICANT_PERFORMANCE_SCHEMA = 'significant-content-performance/v1';
export const SIGNIFICANT_FOLLOW_UP_SCHEMA = 'significant-content-follow-up/v1';
const STAGES = new Set(['render', 'upload', 'metrics']);

export function buildRenderReceipt(input, options) {
  return buildSignificantContentReceipt({ ...input, stage: 'render' }, options);
}

export function buildUploadReceipt(input, options) {
  return buildSignificantContentReceipt({ ...input, stage: 'upload' }, options);
}

export function buildMetricsReceipt(input, options) {
  return buildSignificantContentReceipt({ ...input, stage: 'metrics' }, options);
}

export function buildSignificantContentReceipt(input, options = {}) {
  objectOrThrow(input, 'receipt input');
  const stage = stringOrThrow(input.stage, 'stage');
  if (!STAGES.has(stage)) throw new Error(`unsupported receipt stage: ${stage}`);
  const packageId = stringOrThrow(input.packageId, 'packageId');
  const packageRevision = positiveInteger(input.packageRevision, 'packageRevision');
  const variantId = stringOrThrow(input.variantId, 'variantId');
  const provider = stringOrThrow(input.provider, 'provider');
  const occurredAt = isoOrThrow(input.occurredAt ?? options.now?.().toISOString(), 'occurredAt');
  const externalId = optionalString(input.externalId) ?? null;
  const externalUrl = input.externalUrl ? absoluteUrlOrThrow(input.externalUrl, 'externalUrl') : null;
  const metrics = stage === 'metrics' ? normalizeMetrics(input.metrics) : null;
  if (stage === 'upload' && (!externalId || !externalUrl)) {
    throw new Error('upload receipt requires externalId and externalUrl');
  }
  if (stage === 'metrics' && !externalId) throw new Error('metrics receipt requires externalId');
  const attributionKey = contentVariantKey(packageId, packageRevision, variantId);
  const status = normalizeStatus(input.status, stage);
  const evidenceWindow = stage === 'metrics' ? normalizeEvidenceWindow(input.evidenceWindow, occurredAt) : null;
  const details = normalizeDetails(input.details);
  const identity = stableJson({ stage, attributionKey, provider, status, externalId, externalUrl, occurredAt, metrics, evidenceWindow, details });
  return deepFreeze({
    schema: SIGNIFICANT_RECEIPT_SCHEMA,
    receiptId: `scr_${createHash('sha256').update(identity).digest('hex')}`,
    stage,
    packageId,
    packageRevision,
    variantId,
    attributionKey,
    provider,
    status,
    externalId,
    externalUrl,
    occurredAt,
    metrics,
    evidenceWindow,
    details,
  });
}

export function normalizeSignificantContentReceipt(input) {
  objectOrThrow(input, 'receipt');
  if (input.schema !== SIGNIFICANT_RECEIPT_SCHEMA) {
    throw new Error(`unsupported Significant Content receipt schema: ${input.schema ?? 'missing'}`);
  }
  const rebuilt = buildSignificantContentReceipt(input);
  if (input.receiptId && input.receiptId !== rebuilt.receiptId) throw new Error('receiptId does not match receipt payload');
  return rebuilt;
}

export function significantContentStatus({ ideas = [], receipts = [], packageId, packageRevision } = {}) {
  const imported = ideas.filter((idea) => idea.contentSource?.schema === 'significant-content-reels/v1')
    .filter((idea) => !packageId || idea.contentSource.packageId === packageId)
    .filter((idea) => !packageRevision || idea.contentSource.packageRevision === Number(packageRevision));
  const normalizedReceipts = uniqueReceipts(receipts);
  const knownKeys = new Set(imported.map((idea) => idea.contentSource.idempotencyKey));
  const conflicts = [];
  for (const receipt of normalizedReceipts) {
    if (!knownKeys.has(receipt.attributionKey)) {
      conflicts.push({ type: 'unknown_attribution', receiptId: receipt.receiptId, attributionKey: receipt.attributionKey });
    }
  }
  const variants = imported.map((idea) => {
    const variantReceipts = normalizedReceipts.filter((receipt) => receipt.attributionKey === idea.contentSource.idempotencyKey);
    for (const stage of STAGES) {
      const ids = new Set(variantReceipts.filter((receipt) => receipt.stage === stage).map((receipt) => receipt.externalId).filter(Boolean));
      if (ids.size > 1) conflicts.push({ type: 'conflicting_external_ids', attributionKey: idea.contentSource.idempotencyKey, stage, externalIds: [...ids] });
    }
    const stages = Object.fromEntries([...STAGES].map((stage) => [stage, variantReceipts.filter((receipt) => receipt.stage === stage)]));
    const rendered = idea.status === 'rendered' || idea.status === 'posted' || stages.render.length > 0;
    const uploaded = stages.upload.length > 0;
    const measured = stages.metrics.length > 0;
    const missingReceipts = [
      ...((rendered || uploaded || measured) && !stages.render.length ? ['render'] : []),
      ...((rendered || measured) && !uploaded ? ['upload'] : []),
      ...(uploaded && !measured ? ['metrics'] : []),
    ];
    return {
      ideaId: idea.id,
      packageId: idea.contentSource.packageId,
      packageRevision: idea.contentSource.packageRevision,
      variantId: idea.contentSource.variantId,
      attributionKey: idea.contentSource.idempotencyKey,
      ideaStatus: idea.status,
      stages: { imported: true, rendered, uploaded, measured },
      receiptIds: variantReceipts.map((receipt) => receipt.receiptId),
      missingReceipts,
      nextAction: nextAction({ rendered, uploaded, measured, idea, missingReceipts }),
    };
  });
  return {
    schema: SIGNIFICANT_STATUS_SCHEMA,
    packageId: packageId ?? null,
    packageRevision: packageRevision ? Number(packageRevision) : null,
    importedVariants: variants.length,
    variants,
    conflicts,
    ok: conflicts.length === 0,
  };
}

export function buildVariantPerformanceReport(receipts, options = {}) {
  const metricsReceipts = uniqueReceipts(receipts).filter((receipt) => receipt.stage === 'metrics');
  const groups = new Map();
  for (const receipt of metricsReceipts) {
    const key = `${receipt.packageId}:${receipt.packageRevision}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(receipt);
  }
  const packages = [...groups.entries()].map(([key, group]) => {
    const [packageId, revisionText] = splitPackageKey(key);
    const variants = group.map((receipt) => performanceEntry(receipt));
    const comparable = variants.filter((variant) => variant.comparable);
    const ranked = [...comparable].sort(comparePerformance);
    return {
      packageId,
      packageRevision: Number(revisionText),
      variants,
      comparableVariantIds: ranked.map((variant) => variant.variantId),
      leader: ranked[0] ? {
        variantId: ranked[0].variantId,
        provider: ranked[0].provider,
        externalId: ranked[0].externalId,
        evidenceWindow: ranked[0].evidenceWindow,
      } : null,
      missingOrIncomparable: variants.filter((variant) => !variant.comparable).map((variant) => ({
        variantId: variant.variantId,
        missing: variant.missing,
      })),
    };
  });
  return deepFreeze({
    schema: SIGNIFICANT_PERFORMANCE_SCHEMA,
    generatedAt: isoOrThrow(options.generatedAt ?? options.now?.().toISOString() ?? new Date().toISOString(), 'generatedAt'),
    packages,
  });
}

export function buildFollowUpBrief({ report, ideas = [], packageId, packageRevision, generatedAt } = {}) {
  if (report?.schema !== SIGNIFICANT_PERFORMANCE_SCHEMA) throw new Error('performance report is required');
  const packageReport = report.packages.find((entry) => (
    entry.packageId === packageId && entry.packageRevision === Number(packageRevision)
  ));
  if (!packageReport) throw new Error(`performance package not found: ${packageId} revision ${packageRevision}`);
  const leader = packageReport.variants.find((variant) => variant.variantId === packageReport.leader?.variantId);
  const ranked = packageReport.variants.filter((variant) => variant.comparable).sort(comparePerformance);
  const loser = ranked.at(-1);
  const ideaByVariant = new Map(ideas
    .filter((idea) => idea.contentSource?.packageId === packageId && idea.contentSource?.packageRevision === Number(packageRevision))
    .map((idea) => [idea.contentSource.variantId, idea]));
  const leaderIdea = ideaByVariant.get(leader?.variantId);
  const loserIdea = ideaByVariant.get(loser?.variantId);
  return deepFreeze({
    schema: SIGNIFICANT_FOLLOW_UP_SCHEMA,
    state: 'draft',
    approval: { status: 'draft', approvedAt: null, approvedBy: null },
    source: { packageId, packageRevision: Number(packageRevision), performanceReportSchema: report.schema },
    winningPattern: leader ? {
      variantId: leader.variantId,
      format: leaderIdea?.approvedVariant?.format ?? null,
      hook: leaderIdea?.approvedVariant?.hook ?? null,
      hypothesis: leaderIdea?.approvedVariant?.hypothesis ?? null,
      metrics: leader.metrics,
      evidenceWindow: leader.evidenceWindow,
    } : null,
    losingPattern: loser && loser.variantId !== leader?.variantId ? {
      variantId: loser.variantId,
      format: loserIdea?.approvedVariant?.format ?? null,
      hook: loserIdea?.approvedVariant?.hook ?? null,
      hypothesis: loserIdea?.approvedVariant?.hypothesis ?? null,
      metrics: loser.metrics,
      evidenceWindow: loser.evidenceWindow,
    } : null,
    audienceSignal: leader
      ? `Observed ${leader.metrics.views} views with ${formatPercent(leader.metrics.engagementRate)} engagement${leader.metrics.retentionRate === null ? '' : ` and ${formatPercent(leader.metrics.retentionRate)} retention`}.`
      : 'No comparable winning signal is available yet.',
    suggestedQuestions: [
      'Which promise in the leading hook most directly matched the audience need?',
      'Which source-backed example could deepen the winning payoff?',
      'What did the weaker variant make harder to understand or act on?',
    ],
    generatedAt: isoOrThrow(generatedAt ?? new Date().toISOString(), 'generatedAt'),
    constraints: {
      createsDraftOnly: true,
      mutatesPublishedClaims: false,
      mutatesVariantApproval: false,
      publishesContent: false,
    },
  });
}

function performanceEntry(receipt) {
  const metrics = receipt.metrics;
  const missing = [];
  if (metrics.views === null) missing.push('views');
  if (metrics.retentionRate === null && metrics.watchTimeSeconds === null && metrics.averageViewDurationSeconds === null) missing.push('retention_or_watch_time');
  if (metrics.engagementRate === null) missing.push('engagement');
  return {
    variantId: receipt.variantId,
    provider: receipt.provider,
    externalId: receipt.externalId,
    receiptId: receipt.receiptId,
    metrics,
    evidenceWindow: receipt.evidenceWindow,
    comparable: missing.length === 0,
    missing,
  };
}

function comparePerformance(a, b) {
  return (b.metrics.views ?? -1) - (a.metrics.views ?? -1)
    || (b.metrics.retentionRate ?? -1) - (a.metrics.retentionRate ?? -1)
    || (b.metrics.engagementRate ?? -1) - (a.metrics.engagementRate ?? -1)
    || a.variantId.localeCompare(b.variantId);
}

function normalizeMetrics(input) {
  objectOrThrow(input, 'metrics');
  const views = nullableNonNegative(input.views, 'metrics.views');
  const likes = nullableNonNegative(input.likes, 'metrics.likes');
  const comments = nullableNonNegative(input.comments, 'metrics.comments');
  const shares = nullableNonNegative(input.shares, 'metrics.shares');
  const saves = nullableNonNegative(input.saves, 'metrics.saves');
  const engagementRate = input.engagementRate === undefined || input.engagementRate === null
    ? (views > 0 && [likes, comments, shares, saves].some((value) => value !== null)
      ? [likes, comments, shares, saves].reduce((sum, value) => sum + (value ?? 0), 0) / views
      : null)
    : ratio(input.engagementRate, 'metrics.engagementRate');
  return {
    views,
    watchTimeSeconds: nullableNonNegative(input.watchTimeSeconds, 'metrics.watchTimeSeconds'),
    averageViewDurationSeconds: nullableNonNegative(input.averageViewDurationSeconds, 'metrics.averageViewDurationSeconds'),
    retentionRate: input.retentionRate === undefined || input.retentionRate === null ? null : ratio(input.retentionRate, 'metrics.retentionRate'),
    likes,
    comments,
    shares,
    saves,
    engagementRate,
  };
}

function normalizeEvidenceWindow(input, occurredAt) {
  if (!input) return { start: null, end: occurredAt };
  objectOrThrow(input, 'evidenceWindow');
  const start = input.start ? isoOrThrow(input.start, 'evidenceWindow.start') : null;
  const end = isoOrThrow(input.end ?? occurredAt, 'evidenceWindow.end');
  if (start && start > end) throw new Error('evidenceWindow.start must not be after end');
  return { start, end };
}

function normalizeStatus(status, stage) {
  const value = optionalString(status) ?? ({ render: 'completed', upload: 'published', metrics: 'collected' })[stage];
  const allowed = { render: ['completed'], upload: ['published', 'scheduled'], metrics: ['collected'] }[stage];
  if (!allowed.includes(value)) throw new Error(`unsupported ${stage} receipt status: ${value}`);
  return value;
}

function normalizeDetails(input) {
  if (input === undefined || input === null) return null;
  objectOrThrow(input, 'details');
  return structuredClone(input);
}

function nextAction({ rendered, uploaded, measured, missingReceipts }) {
  if (missingReceipts.includes('render') && (uploaded || measured)) {
    return { action: 'supply_render_receipt', command: 'npm run significant-content -- receipt --stage render ...', authority: 'receipt export only; do not re-render blindly' };
  }
  if (missingReceipts.includes('upload') && measured) {
    return { action: 'supply_upload_receipt', command: 'npm run significant-content -- receipt --stage upload ...', authority: 'use existing provider evidence; do not upload again' };
  }
  if (!rendered) return { action: 'render', command: 'npm run factory -- produce --count 1', authority: 'draft/render only' };
  if (!uploaded) return { action: 'review_and_post', command: null, authority: 'human review plus existing accepted-post and provider preflight required' };
  if (!measured) return { action: 'collect_metrics', command: 'npm run significant-content -- receipt --stage metrics ...', authority: 'read metrics; do not publish' };
  return { action: 'report', command: 'npm run significant-content -- report ...', authority: 'draft feedback only' };
}

function splitPackageKey(key) {
  const match = key.match(/^(.*):(\d+)$/);
  return match ? [match[1], match[2]] : [key, '0'];
}
function uniqueReceipts(receipts) {
  const byId = new Map();
  for (const input of receipts) {
    const receipt = normalizeSignificantContentReceipt(input);
    byId.set(receipt.receiptId, receipt);
  }
  return [...byId.values()];
}
function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function objectOrThrow(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}
function stringOrThrow(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}
function optionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${field} must be a positive integer`);
  return number;
}
function isoOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${field} must be an ISO date`);
  return new Date(text).toISOString();
}
function absoluteUrlOrThrow(value, field) {
  const text = stringOrThrow(value, field);
  let url;
  try { url = new URL(text); } catch { throw new Error(`${field} must be an absolute URL`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`${field} must use http or https`);
  return url.toString();
}
function nullableNonNegative(value, field) {
  if (value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a non-negative number`);
  return number;
}
function ratio(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new Error(`${field} must be between 0 and 1`);
  return number;
}
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
