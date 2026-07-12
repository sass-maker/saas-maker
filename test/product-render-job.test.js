import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RenderJobError,
  completeRenderJob,
  createCustomerRenderJob,
  failRenderJob,
  heartbeatRenderJob,
  leaseRenderJob,
} from '../src/product/render-job.js';

const jobInput = {
  workspaceId: 'workspace-a', briefId: 'brief-a', briefStatus: 'accepted',
  creditHoldEntryId: 'hold-a', idempotencyKey: 'submit-a', maxAttempts: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
};

test('render enqueue requires an accepted brief and an authorised credit hold', () => {
  assert.throws(() => createCustomerRenderJob({ ...jobInput, briefStatus: 'draft' }), RenderJobError);
  assert.throws(() => createCustomerRenderJob({ ...jobInput, creditHoldEntryId: null }), RenderJobError);
  assert.equal(createCustomerRenderJob(jobInput).state, 'queued');
});

test('heartbeats extend only the active worker lease', () => {
  const leased = leaseRenderJob(createCustomerRenderJob(jobInput), {
    workerId: 'worker-a', leaseMs: 1_000, now: '2026-01-01T00:00:01.000Z',
  });
  assert.throws(() => heartbeatRenderJob(leased, {
    leaseToken: 'wrong', leaseMs: 1_000, now: '2026-01-01T00:00:01.500Z',
  }), RenderJobError);
  const heartbeat = heartbeatRenderJob(leased, {
    leaseToken: leased.attempts[0].leaseToken, leaseMs: 2_000, now: '2026-01-01T00:00:01.500Z',
  });
  assert.equal(heartbeat.attempts[0].leaseExpiresAt, '2026-01-01T00:00:03.500Z');
});

test('an expired lease is recoverable within the bounded retry count', () => {
  const first = leaseRenderJob(createCustomerRenderJob(jobInput), {
    workerId: 'worker-a', leaseMs: 1_000, now: '2026-01-01T00:00:01.000Z',
  });
  const second = leaseRenderJob(first, {
    workerId: 'worker-b', leaseMs: 1_000, now: '2026-01-01T00:00:02.000Z',
  });
  assert.equal(second.attempts[0].status, 'lease_expired');
  assert.equal(second.attempts[1].workerId, 'worker-b');
  const exhausted = leaseRenderJob(second, {
    workerId: 'worker-c', leaseMs: 1_000, now: '2026-01-01T00:00:03.000Z',
  });
  assert.equal(exhausted.state, 'terminal_failed');
});

test('duplicate completion callback returns the same ready job', () => {
  const leased = leaseRenderJob(createCustomerRenderJob(jobInput), {
    workerId: 'worker-a', leaseMs: 10_000, now: '2026-01-01T00:00:01.000Z',
  });
  const input = {
    leaseToken: leased.attempts[0].leaseToken, artifactId: 'artifact-a', completionKey: 'complete-a',
    now: '2026-01-01T00:00:02.000Z',
  };
  const ready = completeRenderJob(leased, input);
  assert.strictEqual(completeRenderJob(ready, input), ready);
  assert.equal(ready.state, 'ready');
});

test('retryable failures requeue, while the last failure becomes terminal', () => {
  const first = leaseRenderJob(createCustomerRenderJob(jobInput), {
    workerId: 'worker-a', leaseMs: 10_000, now: '2026-01-01T00:00:01.000Z',
  });
  const queued = failRenderJob(first, {
    leaseToken: first.attempts[0].leaseToken, errorClass: 'renderer_timeout', retryable: true,
    now: '2026-01-01T00:00:02.000Z',
  });
  assert.equal(queued.state, 'queued');
  const second = leaseRenderJob(queued, {
    workerId: 'worker-b', leaseMs: 10_000, now: '2026-01-01T00:00:03.000Z',
  });
  const terminal = failRenderJob(second, {
    leaseToken: second.attempts[1].leaseToken, errorClass: 'renderer_timeout', retryable: true,
    now: '2026-01-01T00:00:04.000Z',
  });
  assert.equal(terminal.state, 'terminal_failed');
  assert.equal(terminal.terminalReason, 'attempts_exhausted');
});
