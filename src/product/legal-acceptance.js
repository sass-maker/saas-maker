import { createHash, randomUUID } from 'node:crypto';

const DOCUMENTS = new Set(['terms', 'privacy', 'actor-licence', 'input-rights']);

export function recordLegalAcceptance(input) {
  if (!input?.subjectId || !input.workspaceId || !DOCUMENTS.has(input.document) || !input.version || !validHash(input.contentHash) || !input.source) {
    throw new LegalAcceptanceError('subject, workspace, document, version, content hash, and source are required');
  }
  const acceptedAt = timestamp(input.acceptedAt);
  const record = {
    id: input.id ?? randomUUID(),
    subjectId: input.subjectId,
    workspaceId: input.workspaceId,
    document: input.document,
    version: input.version,
    contentHash: input.contentHash.toLowerCase(),
    source: input.source,
    acceptedAt,
  };
  return immutable({ ...record, integrityHash: sha256(canonical(record)) });
}

export function requireCurrentAcceptance({ acceptances, subjectId, workspaceId, document, version, contentHash }) {
  if (!Array.isArray(acceptances) || !subjectId || !workspaceId || !DOCUMENTS.has(document) || !version || !validHash(contentHash)) {
    throw new LegalAcceptanceError(`current ${document ?? 'document'} acceptance is required`);
  }
  const match = acceptances.find((acceptance) =>
    acceptance.subjectId === subjectId &&
    acceptance.workspaceId === workspaceId &&
    acceptance.document === document &&
    acceptance.version === version &&
    acceptance.contentHash === contentHash.toLowerCase() &&
    verifyLegalAcceptance(acceptance));
  if (!match) throw new LegalAcceptanceError(`current ${document} acceptance is required`);
  return match;
}

export function verifyLegalAcceptance(record) {
  const { integrityHash, ...payload } = record ?? {};
  return typeof integrityHash === 'string' && integrityHash === sha256(canonical(payload));
}

export class LegalAcceptanceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LegalAcceptanceError';
    this.code = 'LEGAL_ACCEPTANCE_REQUIRED';
  }
}

function timestamp(value) {
  const result = value ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(result))) throw new LegalAcceptanceError('valid acceptance timestamp is required');
  return result;
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function immutable(value) {
  return deepFreeze(structuredClone(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export { DOCUMENTS as LEGAL_DOCUMENTS };
