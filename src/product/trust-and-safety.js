import { createHash, randomUUID } from 'node:crypto';

const REPORT_TRANSITIONS = Object.freeze({
  open: new Set(['investigating', 'dismissed']),
  investigating: new Set(['actioned', 'dismissed']),
  actioned: new Set(['appealed', 'closed']),
  appealed: new Set(['actioned', 'dismissed']),
  dismissed: new Set(['closed']),
  closed: new Set(),
});

export function reviewClaims({ claims, evidence, policyVersion, reviewerId, reviewedAt = new Date().toISOString() }) {
  if (!Array.isArray(claims) || !Array.isArray(evidence) || !policyVersion || !reviewerId) {
    throw new TrustSafetyError('claims, evidence, policy version, and reviewer are required');
  }
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const decisions = claims.map((claim) => ({
    claimId: claim.id,
    status: claim.evidenceId && evidenceIds.has(claim.evidenceId) ? 'supported' : 'blocked',
    evidenceId: claim.evidenceId ?? null,
  }));
  return immutable({ id: randomUUID(), policyVersion, reviewerId, reviewedAt, decisions,
    accepted: decisions.every((decision) => decision.status === 'supported') });
}

export function createMisuseReport(input) {
  if (!input?.subjectType || !input.subjectId || !input.reporterId || !input.category || !input.descriptionHash || !validHash(input.descriptionHash)) {
    throw new TrustSafetyError('report subject, reporter, category, and content hash are required');
  }
  return immutable({
    id: input.id ?? randomUUID(), workspaceId: input.workspaceId ?? null,
    subjectType: input.subjectType, subjectId: input.subjectId, reporterId: input.reporterId,
    category: input.category, descriptionHash: input.descriptionHash, status: 'open',
    createdAt: input.createdAt ?? new Date().toISOString(), history: [],
  });
}

export function transitionMisuseReport(report, nextStatus, input = {}) {
  if (!REPORT_TRANSITIONS[report?.status]?.has(nextStatus) || !input.actorId || !input.reasonCode) {
    throw new TrustSafetyError(`invalid report transition: ${report?.status} -> ${nextStatus}`);
  }
  if (nextStatus === 'appealed' && !input.appealEvidenceHash) throw new TrustSafetyError('appeal evidence is required');
  const event = immutable({
    from: report.status, to: nextStatus, actorId: input.actorId, reasonCode: input.reasonCode,
    appealEvidenceHash: input.appealEvidenceHash ?? null, at: input.at ?? new Date().toISOString(),
  });
  return immutable({ ...report, status: nextStatus, history: [...report.history, event] });
}

export function createTakedown({ report, outputId, actorId, scope = 'delivery_and_publish', createdAt = new Date().toISOString() }) {
  if (report?.status !== 'actioned' || report.subjectId !== outputId || !actorId) {
    throw new TrustSafetyError('an actioned matching misuse report is required');
  }
  return immutable({ id: randomUUID(), reportId: report.id, outputId, actorId, scope, status: 'active', createdAt });
}

export function evaluateRepeatAbuse({ reports, subjectId, threshold = 3 }) {
  if (!subjectId || !Number.isSafeInteger(threshold) || threshold < 1) throw new TrustSafetyError('subject and positive threshold are required');
  const actioned = reports.filter((report) => report.subjectId === subjectId && ['actioned', 'appealed', 'closed'].includes(report.status)).length;
  return Object.freeze({ subjectId, actioned, threshold, restricted: actioned >= threshold });
}

export function createDataRightsJob(input) {
  if (!input?.workspaceId || !input.subjectId || !['export', 'delete'].includes(input.kind) || !input.policyVersion || !input.idempotencyKey) {
    throw new TrustSafetyError('workspace, subject, job kind, policy, and idempotency key are required');
  }
  return immutable({
    id: input.id ?? randomUUID(), workspaceId: input.workspaceId, subjectId: input.subjectId,
    kind: input.kind, policyVersion: input.policyVersion, status: 'queued',
    idempotencyKey: input.idempotencyKey, createdAt: input.createdAt ?? new Date().toISOString(),
    audit: [{ action: 'queued', at: input.createdAt ?? new Date().toISOString() }],
  });
}

export function completeDataRightsJob(job, { evidence, retainedRecords = [], completedAt = new Date().toISOString() }) {
  if (job?.status !== 'queued' || !evidence?.receiptId || !Array.isArray(retainedRecords) ||
      retainedRecords.some((record) => !record.type || !record.purpose || !record.deleteAfter)) {
    throw new TrustSafetyError('completion evidence and purpose-bound retained-record decisions are required');
  }
  return immutable({ ...job, status: 'completed', evidence, retainedRecords,
    audit: [...job.audit, { action: 'completed', receiptId: evidence.receiptId, at: completedAt }], completedAt });
}

export class TrustSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrustSafetyError';
    this.code = 'TRUST_SAFETY_CONFLICT';
  }
}

function validHash(value) {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function hashSensitiveReportText(value) {
  return createHash('sha256').update(value).digest('hex');
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

export { REPORT_TRANSITIONS };
