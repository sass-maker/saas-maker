import assert from 'node:assert/strict';
import test from 'node:test';

import { CommercialRenderCoordinator, CommercialRenderError } from '../src/product/commercial-render.js';
import { CreditLedger, InsufficientCreditsError, createCreditAccount } from '../src/product/credit-ledger.js';

const brief = { id: 'brief-a', workspaceId: 'workspace-a', status: 'accepted', quotedCredits: 4 };

function setup(balance = 10) {
  const ledger = new CreditLedger();
  const account = createCreditAccount({ id: 'account-a', workspaceId: brief.workspaceId, createdAt: '2026-01-01T00:00:00.000Z' });
  if (balance) ledger.grant({ accountId: account.id, workspaceId: account.workspaceId, amount: balance, idempotencyKey: 'grant-a' });
  return { account, ledger, coordinator: new CommercialRenderCoordinator({ ledger }) };
}

test('commercial submission atomically holds credits and is idempotent', () => {
  const { account, ledger, coordinator } = setup();
  const input = { brief, account, idempotencyKey: 'submission-a', createdAt: '2026-01-01T00:00:00.000Z' };
  const first = coordinator.submit(input);
  const duplicate = coordinator.submit(input);
  assert.equal(duplicate.id, first.id);
  assert.deepEqual(ledger.balance(account.id), { available: 6, held: 4, captured: 0 });
  assert.equal(ledger.entries().filter((entry) => entry.operation === 'hold').length, 1);
  assert.throws(() => coordinator.submit({ ...input, brief: { ...brief, id: 'brief-b' } }), CommercialRenderError);
});

test('successful commercial render captures exactly once under duplicate callbacks', () => {
  const { account, ledger, coordinator } = setup();
  const job = coordinator.submit({ brief, account, idempotencyKey: 'submission-success' });
  const leased = coordinator.lease(job.id, { workerId: 'worker-a', leaseMs: 10_000, now: '2026-01-01T00:00:01.000Z' });
  const completion = { leaseToken: leased.attempts[0].leaseToken, artifactId: 'artifact-a', completionKey: 'completion-a', now: '2026-01-01T00:00:02.000Z' };
  coordinator.complete(job.id, completion);
  coordinator.complete(job.id, completion);
  assert.deepEqual(ledger.balance(account.id), { available: 6, held: 0, captured: 4 });
  assert.equal(ledger.entries().filter((entry) => entry.operation === 'capture').length, 1);
});

test('terminal failure releases exactly once and retryable failure keeps the hold', () => {
  const { account, ledger, coordinator } = setup();
  const job = coordinator.submit({ brief, account, idempotencyKey: 'submission-failure', maxAttempts: 2 });
  const first = coordinator.lease(job.id, { workerId: 'worker-a', leaseMs: 10_000, now: '2026-01-01T00:00:01.000Z' });
  const retry = { leaseToken: first.attempts[0].leaseToken, errorClass: 'timeout', retryable: true, failureKey: 'failure-1', now: '2026-01-01T00:00:02.000Z' };
  assert.equal(coordinator.fail(job.id, retry).state, 'queued');
  assert.equal(coordinator.fail(job.id, retry).state, 'queued');
  assert.equal(ledger.balance(account.id).held, 4);
  const second = coordinator.lease(job.id, { workerId: 'worker-b', leaseMs: 10_000, now: '2026-01-01T00:00:03.000Z' });
  const terminal = { leaseToken: second.attempts[1].leaseToken, errorClass: 'timeout', retryable: true, failureKey: 'failure-2', now: '2026-01-01T00:00:04.000Z' };
  assert.equal(coordinator.fail(job.id, terminal).state, 'terminal_failed');
  assert.equal(coordinator.fail(job.id, terminal).state, 'terminal_failed');
  assert.deepEqual(ledger.balance(account.id), { available: 10, held: 0, captured: 0 });
  assert.equal(ledger.entries().filter((entry) => entry.operation === 'release').length, 1);
});

test('draft, cross-tenant account, and insufficient credits fail before enqueue', () => {
  const { account, coordinator } = setup(0);
  assert.throws(() => coordinator.submit({ brief, account, idempotencyKey: 'no-funds' }), InsufficientCreditsError);
  assert.throws(() => coordinator.submit({ brief: { ...brief, status: 'draft' }, account, idempotencyKey: 'draft' }), CommercialRenderError);
  assert.throws(() => coordinator.submit({ brief, account: { ...account, workspaceId: 'workspace-b' }, idempotencyKey: 'cross' }), CommercialRenderError);
});

test('commercial render transitions emit redacted structured events at real call sites', () => {
  const ledger = new CreditLedger();
  const account = createCreditAccount({ id: 'account-observe', workspaceId: brief.workspaceId });
  ledger.grant({ accountId: account.id, workspaceId: account.workspaceId, amount: 10, idempotencyKey: 'grant-observe' });
  const events = [];
  const coordinator = new CommercialRenderCoordinator({ ledger, observe: (event) => events.push(event) });
  const job = coordinator.submit({ brief, account, idempotencyKey: 'submission-observe', createdAt: '2026-01-01T00:00:00.000Z' });
  const leased = coordinator.lease(job.id, { workerId: 'worker-a', leaseMs: 10_000, now: '2026-01-01T00:00:01.000Z' });
  coordinator.fail(job.id, { leaseToken: leased.attempts[0].leaseToken, errorClass: 'renderer_timeout', retryable: false, now: '2026-01-01T00:00:02.000Z' });
  assert.deepEqual(events.map((event) => event.event), ['commercial_render.queued', 'commercial_render.failed']);
  assert.equal(events.some((event) => Object.hasOwn(event, 'brief') || Object.hasOwn(event, 'token')), false);
});
