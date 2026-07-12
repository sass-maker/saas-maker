import {
  completeRenderJob,
  createCustomerRenderJob,
  failRenderJob,
  leaseRenderJob,
} from './render-job.js';
import { createProductEvent } from './observability.js';

export class CommercialRenderCoordinator {
  #ledger;
  #jobs = new Map();
  #submissionKeys = new Map();
  #observe;

  constructor({ ledger, jobs = [], observe = () => {} }) {
    if (!ledger) throw new TypeError('credit ledger is required');
    if (typeof observe !== 'function') throw new TypeError('observe must be a function');
    this.#ledger = ledger;
    this.#observe = observe;
    for (const job of jobs) {
      this.#jobs.set(job.id, structuredClone(job));
      this.#submissionKeys.set(job.idempotencyKey, job.id);
    }
  }

  submit({ brief, account, idempotencyKey, maxAttempts, createdAt }) {
    if (brief?.status !== 'accepted' || !brief.workspaceId || !brief.id || !Number.isSafeInteger(brief.quotedCredits)) {
      throw new CommercialRenderError('an accepted quoted brief is required');
    }
    if (account?.status !== 'active' || account.workspaceId !== brief.workspaceId) {
      throw new CommercialRenderError('an active workspace credit account is required');
    }
    if (!idempotencyKey) throw new CommercialRenderError('submission idempotency key is required');
    const existingId = this.#submissionKeys.get(idempotencyKey);
    if (existingId) {
      const existing = this.#jobs.get(existingId);
      if (existing.briefId !== brief.id || existing.workspaceId !== brief.workspaceId) {
        throw new CommercialRenderError('submission idempotency key was reused');
      }
      return clone(existing);
    }
    const hold = this.#ledger.hold({
      accountId: account.id,
      workspaceId: brief.workspaceId,
      amount: brief.quotedCredits,
      idempotencyKey: `${idempotencyKey}:hold`,
      metadata: { briefId: brief.id },
    });
    const job = createCustomerRenderJob({
      workspaceId: brief.workspaceId,
      briefId: brief.id,
      briefStatus: brief.status,
      creditHoldEntryId: hold.id,
      idempotencyKey,
      maxAttempts,
      createdAt,
    });
    const commercial = { ...job, accountId: account.id, quotedCredits: brief.quotedCredits };
    this.#save(commercial);
    this.#submissionKeys.set(idempotencyKey, commercial.id);
    this.#emit({ event: 'commercial_render.queued', workspaceId: commercial.workspaceId, jobId: commercial.id, state: commercial.state, occurredAt: commercial.createdAt });
    return clone(commercial);
  }

  lease(jobId, input) {
    return this.#update(jobId, (job) => leaseRenderJob(job, input));
  }

  complete(jobId, input) {
    const job = this.#require(jobId);
    const ready = completeRenderJob(job, input);
    this.#ledger.capture({
      accountId: job.accountId,
      workspaceId: job.workspaceId,
      amount: job.quotedCredits,
      referenceEntryId: job.creditHoldEntryId,
      idempotencyKey: `${job.id}:capture`,
      metadata: { artifactId: input.artifactId },
    });
    this.#save(ready);
    this.#emit({ event: 'commercial_render.ready', workspaceId: ready.workspaceId, jobId: ready.id, outputId: input.artifactId, state: ready.state, occurredAt: input.now ?? new Date().toISOString() });
    return clone(ready);
  }

  fail(jobId, input) {
    const job = this.#require(jobId);
    const failureKey = input?.failureKey ?? `${input?.leaseToken}:${input?.errorClass}`;
    if (job.failureKeys?.includes(failureKey)) return clone(job);
    const failed = { ...failRenderJob(job, input), failureKeys: [...(job.failureKeys ?? []), failureKey] };
    if (failed.state === 'terminal_failed') {
      this.#ledger.release({
        accountId: job.accountId,
        workspaceId: job.workspaceId,
        amount: job.quotedCredits,
        referenceEntryId: job.creditHoldEntryId,
        idempotencyKey: `${job.id}:release`,
        metadata: { terminalReason: failed.terminalReason },
      });
    }
    this.#save(failed);
    this.#emit({ event: 'commercial_render.failed', workspaceId: failed.workspaceId, jobId: failed.id, state: failed.state,
      errorClass: input.errorClass, retryCount: failed.attempts.length, occurredAt: input.now ?? new Date().toISOString() });
    return clone(failed);
  }

  get(jobId) {
    return clone(this.#require(jobId));
  }

  #update(jobId, update) {
    const next = { ...update(this.#require(jobId)), accountId: this.#require(jobId).accountId, quotedCredits: this.#require(jobId).quotedCredits };
    this.#save(next);
    return clone(next);
  }

  #require(jobId) {
    const job = this.#jobs.get(jobId);
    if (!job) throw new CommercialRenderError('render job not found');
    return job;
  }

  #save(job) {
    this.#jobs.set(job.id, structuredClone(job));
  }

  #emit(input) {
    this.#observe(createProductEvent(input));
  }
}

export class CommercialRenderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CommercialRenderError';
    this.code = 'COMMERCIAL_RENDER_CONFLICT';
  }
}

function clone(value) {
  return structuredClone(value);
}
