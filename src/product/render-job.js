import { randomUUID } from 'node:crypto';

export function createCustomerRenderJob(input) {
  if (!input?.workspaceId || !input.briefId || !input.creditHoldEntryId || !input.idempotencyKey) {
    throw new RenderJobError('workspace, accepted brief, credit hold, and idempotency key are required');
  }
  if (input.briefStatus !== 'accepted') throw new RenderJobError('brief must be accepted before render enqueue');
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new RenderJobError('maxAttempts must be between 1 and 10');
  return immutable({
    id: input.id ?? randomUUID(),
    workspaceId: input.workspaceId,
    briefId: input.briefId,
    creditHoldEntryId: input.creditHoldEntryId,
    idempotencyKey: input.idempotencyKey,
    state: 'queued',
    maxAttempts,
    attempts: [],
    artifactId: null,
    completionKey: null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function leaseRenderJob(job, input) {
  const now = timestamp(input?.now);
  const activeAttempt = job.attempts.at(-1);
  const leaseExpired = job.state === 'rendering' && Date.parse(activeAttempt?.leaseExpiresAt ?? '') <= Date.parse(now);
  if (job.state !== 'queued' && !leaseExpired) throw new RenderJobError('job is not available for lease');
  if (job.attempts.length >= job.maxAttempts) return terminal(job, now, 'attempts_exhausted');
  if (!input?.workerId || !Number.isSafeInteger(input.leaseMs) || input.leaseMs < 1) {
    throw new RenderJobError('workerId and positive leaseMs are required');
  }
  const attempt = {
    id: randomUUID(),
    number: job.attempts.length + 1,
    workerId: input.workerId,
    leaseToken: randomUUID(),
    leasedAt: now,
    heartbeatAt: now,
    leaseExpiresAt: new Date(Date.parse(now) + input.leaseMs).toISOString(),
    status: 'running',
  };
  const attempts = leaseExpired
    ? [...job.attempts.slice(0, -1), { ...activeAttempt, status: 'lease_expired', finishedAt: now }, attempt]
    : [...job.attempts, attempt];
  return immutable({ ...job, state: 'rendering', attempts, updatedAt: now });
}

export function heartbeatRenderJob(job, input) {
  const now = timestamp(input?.now);
  const attempt = requireActiveLease(job, input?.leaseToken, now);
  if (!Number.isSafeInteger(input.leaseMs) || input.leaseMs < 1) throw new RenderJobError('positive leaseMs is required');
  return replaceAttempt(job, {
    ...attempt,
    heartbeatAt: now,
    leaseExpiresAt: new Date(Date.parse(now) + input.leaseMs).toISOString(),
  }, now);
}

export function completeRenderJob(job, input) {
  if (job.state === 'ready' && job.completionKey === input?.completionKey) return job;
  const now = timestamp(input?.now);
  const attempt = requireActiveLease(job, input?.leaseToken, now);
  if (!input?.artifactId || !input.completionKey) throw new RenderJobError('artifactId and completionKey are required');
  const completed = replaceAttempt(job, { ...attempt, status: 'succeeded', finishedAt: now }, now);
  return immutable({ ...completed, state: 'ready', artifactId: input.artifactId, completionKey: input.completionKey, updatedAt: now });
}

export function failRenderJob(job, input) {
  const now = timestamp(input?.now);
  const attempt = requireActiveLease(job, input?.leaseToken, now);
  if (!input?.errorClass) throw new RenderJobError('a non-sensitive error classification is required');
  const failed = replaceAttempt(job, { ...attempt, status: 'failed', errorClass: input.errorClass, finishedAt: now }, now);
  if (input.retryable === true && failed.attempts.length < failed.maxAttempts) {
    return immutable({ ...failed, state: 'queued', updatedAt: now });
  }
  return terminal(failed, now, input.retryable === true ? 'attempts_exhausted' : input.errorClass);
}

function requireActiveLease(job, leaseToken, now) {
  const attempt = job?.attempts?.at(-1);
  if (job?.state !== 'rendering' || !leaseToken || attempt?.leaseToken !== leaseToken || attempt.status !== 'running') {
    throw new RenderJobError('active worker lease is required');
  }
  if (Date.parse(attempt.leaseExpiresAt) <= Date.parse(now)) throw new RenderJobError('worker lease expired');
  return attempt;
}

function replaceAttempt(job, attempt, now) {
  return immutable({ ...job, attempts: [...job.attempts.slice(0, -1), attempt], updatedAt: now });
}

function terminal(job, now, reason) {
  return immutable({ ...job, state: 'terminal_failed', terminalReason: reason, updatedAt: now });
}

function timestamp(value) {
  const result = value ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(result))) throw new RenderJobError('valid timestamp is required');
  return result;
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

export class RenderJobError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RenderJobError';
    this.code = 'RENDER_JOB_CONFLICT';
  }
}
