import { createHash, randomUUID } from 'node:crypto';

export function createOutputProvenance(input) {
  const required = ['workspaceId', 'outputId', 'briefId', 'renderer', 'sourceAssets', 'review', 'disclosure'];
  for (const field of required) {
    if (input?.[field] === undefined || input[field] === null) throw new ProvenanceError(`${field} is required`);
  }
  if (!input.inputRightsAttestation?.accepted || !input.inputRightsAttestation?.acceptanceId) {
    throw new ProvenanceError('input-rights attestation is required');
  }
  if (!input.renderer.provider || !input.renderer.model || !input.renderer.version) {
    throw new ProvenanceError('renderer provider, model, and version are required');
  }
  if (!Array.isArray(input.sourceAssets) || input.sourceAssets.some((asset) => !asset.id || !asset.rightsBasis)) {
    throw new ProvenanceError('every source asset requires an id and rights basis');
  }
  if (input.actorUse && (!input.actorUse.licenceSnapshotId || !input.actorUse.actorStatus || !input.actorUse.twinStatus)) {
    throw new ProvenanceError('actor use requires an immutable licence snapshot and actor/twin status');
  }
  if (!input.review.briefAcceptanceId || !input.review.outputAcceptanceId) {
    throw new ProvenanceError('brief and output review approvals are required');
  }
  assertDisclosureDeliverable(input.disclosure);

  const record = {
    id: input.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    outputId: input.outputId,
    briefId: input.briefId,
    inputRightsAttestation: input.inputRightsAttestation,
    renderer: input.renderer,
    sourceAssets: input.sourceAssets,
    music: input.music ?? null,
    fonts: input.fonts ?? [],
    voice: input.voice ?? null,
    actorUse: input.actorUse ?? null,
    review: input.review,
    disclosure: input.disclosure,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    editedAt: input.editedAt ?? null,
  };
  return deepFreeze({ ...record, integrityHash: sha256(canonical(record)) });
}

export function assertDisclosureDeliverable(disclosure) {
  if (!disclosure?.decision || !disclosure?.policyVersion) throw new ProvenanceError('a versioned disclosure decision is required');
  if (disclosure.required === true && disclosure.applied !== true) {
    throw new DisclosureBlockedError(disclosure.reason ?? 'required synthetic-content disclosure is not applied');
  }
  if (disclosure.machineReadableRequired === true && !disclosure.machineReadableMetadata) {
    throw new DisclosureBlockedError('required machine-readable synthetic-content metadata is missing');
  }
  return disclosure;
}

export function verifyOutputProvenance(record) {
  const { integrityHash, ...payload } = record ?? {};
  return typeof integrityHash === 'string' && integrityHash === sha256(canonical(payload));
}

export class ProvenanceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProvenanceError';
    this.code = 'INVALID_PROVENANCE';
  }
}

export class DisclosureBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DisclosureBlockedError';
    this.code = 'DISCLOSURE_BLOCKED';
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
