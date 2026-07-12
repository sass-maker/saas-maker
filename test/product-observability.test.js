import assert from 'node:assert/strict';
import test from 'node:test';

import { createProductEvent, productErrorEvent } from '../src/product/observability.js';

test('structured observability retains operational dimensions and drops sensitive content', () => {
  const event = createProductEvent({ event: 'render.failed', workspaceId: 'workspace-a', jobId: 'job-a', errorClass: 'timeout',
    token: 'secret', biometricInput: 'face bytes', script: 'customer copy', prompt: 'private prompt',
    occurredAt: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(event, { event: 'render.failed', workspaceId: 'workspace-a', jobId: 'job-a', errorClass: 'timeout', occurredAt: '2026-01-01T00:00:00.000Z' });
});

test('errors become classified events without messages or stacks', () => {
  const event = productErrorEvent({ event: 'billing.failed', workspaceId: 'workspace-a', error: Object.assign(new Error('contains customer content'), { code: 'PROVIDER_TIMEOUT' }), occurredAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(event.errorClass, 'PROVIDER_TIMEOUT');
  assert.equal(JSON.stringify(event).includes('customer content'), false);
});
