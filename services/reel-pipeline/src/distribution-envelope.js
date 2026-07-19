import { createHash } from 'node:crypto';

import { normalizeContentPackage } from './content-package.js';
import { normalizeDistributionRequest } from './distribution.js';

export const DISTRIBUTION_ENVELOPE_SCHEMA = 'fleet.distribution-envelope.v1';
const MARKER = 'fleet_distribution_v1:';

export function buildDistributionEnvelope(contentInput, options = {}) {
  const contentPackage = normalizeContentPackage(contentInput);
  const mediaReceipt = options.mediaReceipt ? normalizeMediaReceipt(options.mediaReceipt) : null;
  const distributionRequest = options.distributionRequest
    ? normalizeDistributionRequest(options.distributionRequest)
    : null;
  return normalizeDistributionEnvelope({
    schema: DISTRIBUTION_ENVELOPE_SCHEMA,
    contentPackage,
    mediaReceipt,
    distributionRequest,
    publicationReceipt: options.publicationReceipt ?? null,
    idempotencyKey: options.idempotencyKey ?? publicationKey(contentPackage, distributionRequest),
    attempts: options.attempts ?? {
      count: 0,
      state: 'idle',
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastError: null,
    },
  });
}

export function normalizeDistributionEnvelope(input) {
  if (input?.schema !== DISTRIBUTION_ENVELOPE_SCHEMA) throw new Error('unsupported distribution envelope schema');
  const contentPackage = normalizeContentPackage(input.contentPackage);
  const mediaReceipt = input.mediaReceipt ? normalizeMediaReceipt(input.mediaReceipt) : null;
  const distributionRequest = input.distributionRequest
    ? normalizeDistributionRequest(input.distributionRequest)
    : null;
  if (mediaReceipt && (mediaReceipt.packageId !== contentPackage.id || mediaReceipt.packageRevision !== contentPackage.revision)) {
    throw new Error('envelope media receipt does not match content package');
  }
  if (distributionRequest && (!mediaReceipt || distributionRequest.packageId !== contentPackage.id || distributionRequest.variantId !== mediaReceipt.variantId)) {
    throw new Error('envelope distribution request does not match package and media');
  }
  const attemptState = input.attempts?.state ?? 'idle';
  if (!['idle', 'inflight', 'retry_wait', 'failed', 'posted'].includes(attemptState)) throw new Error('invalid publication attempt state');
  return {
    schema: DISTRIBUTION_ENVELOPE_SCHEMA,
    contentPackage,
    mediaReceipt,
    distributionRequest,
    publicationReceipt: input.publicationReceipt ?? null,
    idempotencyKey: requiredString(input.idempotencyKey, 'idempotencyKey'),
    attempts: {
      count: nonNegativeInteger(input.attempts?.count ?? 0, 'attempts.count'),
      state: attemptState,
      lastAttemptAt: optionalIso(input.attempts?.lastAttemptAt, 'attempts.lastAttemptAt'),
      nextAttemptAt: optionalIso(input.attempts?.nextAttemptAt, 'attempts.nextAttemptAt'),
      lastError: typeof input.attempts?.lastError === 'string' ? input.attempts.lastError : null,
    },
  };
}

export function parseDistributionEnvelope(notes) {
  if (typeof notes !== 'string') return null;
  const line = notes.split(/\r?\n/).find((entry) => entry.startsWith(MARKER));
  if (!line) return null;
  try {
    const payload = JSON.parse(Buffer.from(line.slice(MARKER.length).trim(), 'base64url').toString('utf8'));
    return normalizeDistributionEnvelope(payload);
  } catch (error) {
    throw new Error(`invalid Fleet distribution envelope: ${error.message}`);
  }
}

export function upsertDistributionEnvelope(notes, envelopeInput) {
  const envelope = normalizeDistributionEnvelope(envelopeInput);
  const encoded = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  const retained = String(notes ?? '')
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(MARKER))
    .join('\n')
    .trim();
  return [retained, `${MARKER}${encoded}`].filter(Boolean).join('\n');
}

export function envelopeSummary(envelopeInput) {
  const envelope = normalizeDistributionEnvelope(envelopeInput);
  return {
    schema: envelope.schema,
    packageId: envelope.contentPackage.id,
    packageRevision: envelope.contentPackage.revision,
    brand: envelope.contentPackage.brand.slug,
    variantId: envelope.mediaReceipt?.variantId ?? null,
    channel: envelope.mediaReceipt?.channel ?? envelope.contentPackage.variants[0]?.channel ?? null,
    mediaStatus: envelope.mediaReceipt?.status ?? 'pending',
    distributionStatus: envelope.publicationReceipt?.status
      ?? envelope.distributionRequest?.approval?.status
      ?? 'pending',
    attemptState: envelope.attempts.state,
    attemptCount: envelope.attempts.count,
    nextAttemptAt: envelope.attempts.nextAttemptAt,
  };
}

export function approveEnvelopeDistribution(envelopeInput, options = {}) {
  const envelope = normalizeDistributionEnvelope(envelopeInput);
  if (!envelope.mediaReceipt || !envelope.distributionRequest) throw new Error('rendered media and a distribution request are required');
  if (!options.approvedBy) throw new Error('approvedBy is required');
  const approvedAt = new Date(options.approvedAt ?? new Date()).toISOString();
  const scheduledFor = options.scheduledFor ? new Date(options.scheduledFor).toISOString() : approvedAt;
  return normalizeDistributionEnvelope({
    ...envelope,
    distributionRequest: {
      ...envelope.distributionRequest,
      scheduledFor,
      approval: { status: 'approved', approvedAt, approvedBy: options.approvedBy },
    },
  });
}

export function rejectEnvelopeDistribution(envelopeInput) {
  const envelope = normalizeDistributionEnvelope(envelopeInput);
  if (!envelope.distributionRequest) throw new Error('distribution request is required');
  return normalizeDistributionEnvelope({
    ...envelope,
    distributionRequest: {
      ...envelope.distributionRequest,
      approval: { status: 'rejected', approvedAt: null, approvedBy: null },
    },
  });
}

function normalizeMediaReceipt(receipt) {
  if (receipt?.schema !== 'fleet.media-receipt.v1') throw new Error('invalid media receipt schema');
  if (receipt.status !== 'rendered') throw new Error('media receipt must be rendered');
  return structuredClone(receipt);
}

function publicationKey(contentPackage, request) {
  const raw = request
    ? `${request.packageId}:${request.packageRevision}:${request.variantId}:${request.channel}:${request.accountSlug ?? 'unmapped'}`
    : `${contentPackage.id}:${contentPackage.revision}:pending`;
  return createHash('sha256').update(raw).digest('hex');
}

function requiredString(value, field) { if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`); return value.trim(); }
function nonNegativeInteger(value, field) { const number = Number(value); if (!Number.isInteger(number) || number < 0) throw new Error(`${field} must be a non-negative integer`); return number; }
function optionalIso(value, field) { if (value === null || value === undefined || value === '') return null; if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO date`); return new Date(value).toISOString(); }
