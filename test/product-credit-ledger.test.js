import assert from 'node:assert/strict';
import test from 'node:test';

import { CreditLedger, InsufficientCreditsError, LedgerConflictError } from '../src/product/credit-ledger.js';

const base = { accountId: 'credits-a', workspaceId: 'workspace-a' };

test('credit hold is captured once under duplicate completion callbacks', () => {
  const ledger = new CreditLedger();
  ledger.grant({ ...base, amount: 10, idempotencyKey: 'purchase:1' });
  const hold = ledger.hold({ ...base, amount: 4, idempotencyKey: 'render:1:hold' });
  const input = { ...base, amount: 4, referenceEntryId: hold.id, idempotencyKey: 'render:1:capture' };
  const first = ledger.capture(input);
  const duplicate = ledger.capture(input);

  assert.equal(first.id, duplicate.id);
  assert.deepEqual(ledger.balance(base.accountId), { available: 6, held: 0, captured: 4 });
  assert.equal(ledger.entries().filter((entry) => entry.operation === 'capture').length, 1);
});

test('terminal technical failure releases a hold exactly once', () => {
  const ledger = new CreditLedger();
  ledger.grant({ ...base, amount: 5, idempotencyKey: 'purchase:2' });
  const hold = ledger.hold({ ...base, amount: 5, idempotencyKey: 'render:2:hold' });
  const release = { ...base, amount: 5, referenceEntryId: hold.id, idempotencyKey: 'render:2:release' };
  ledger.release(release);
  ledger.release(release);
  assert.deepEqual(ledger.balance(base.accountId), { available: 5, held: 0, captured: 0 });
  assert.equal(ledger.entries().filter((entry) => entry.operation === 'release').length, 1);
});

test('ledger prevents insufficient balance, cross-tenant references, and double settlement', () => {
  const ledger = new CreditLedger();
  const grant = ledger.grant({ ...base, amount: 3, idempotencyKey: 'purchase:3' });
  assert.throws(() => ledger.hold({ ...base, amount: 4, idempotencyKey: 'too-much' }), InsufficientCreditsError);
  const hold = ledger.hold({ ...base, amount: 3, idempotencyKey: 'render:3:hold' });
  ledger.capture({ ...base, amount: 3, referenceEntryId: hold.id, idempotencyKey: 'render:3:capture' });
  assert.throws(() => ledger.release({ ...base, amount: 1, referenceEntryId: hold.id, idempotencyKey: 'late-release' }), LedgerConflictError);
  assert.throws(() => ledger.refund({ accountId: base.accountId, workspaceId: 'workspace-b', amount: 1, referenceEntryId: grant.id, idempotencyKey: 'cross-tenant' }), LedgerConflictError);
});

test('refunds, chargebacks, and expiries remain explicit append-only entries', () => {
  const ledger = new CreditLedger();
  const grant = ledger.grant({ ...base, amount: 12, idempotencyKey: 'purchase:4' });
  const hold = ledger.hold({ ...base, amount: 4, idempotencyKey: 'render:4:hold' });
  const capture = ledger.capture({ ...base, amount: 4, referenceEntryId: hold.id, idempotencyKey: 'render:4:capture' });
  ledger.refund({ ...base, amount: 2, referenceEntryId: capture.id, idempotencyKey: 'refund:4' });
  ledger.expire({ ...base, amount: 1, idempotencyKey: 'expiry:4' });
  ledger.chargeback({ ...base, amount: 2, referenceEntryId: grant.id, idempotencyKey: 'chargeback:4' });

  assert.deepEqual(ledger.entries().map((entry) => entry.operation), ['grant', 'hold', 'capture', 'refund', 'expiry', 'chargeback']);
  assert.deepEqual(ledger.balance(base.accountId), { available: 7, held: 0, captured: 2 });
});

test('reusing an idempotency key with different input is rejected', () => {
  const ledger = new CreditLedger();
  ledger.grant({ ...base, amount: 3, idempotencyKey: 'same' });
  assert.throws(() => ledger.grant({ ...base, amount: 4, idempotencyKey: 'same' }), LedgerConflictError);
});

test('cumulative refunds and chargebacks cannot exceed their source entries', () => {
  const ledger = new CreditLedger();
  const grant = ledger.grant({ ...base, amount: 8, idempotencyKey: 'purchase:5' });
  const hold = ledger.hold({ ...base, amount: 4, idempotencyKey: 'render:5:hold' });
  const capture = ledger.capture({ ...base, amount: 4, referenceEntryId: hold.id, idempotencyKey: 'render:5:capture' });
  ledger.refund({ ...base, amount: 3, referenceEntryId: capture.id, idempotencyKey: 'refund:5:a' });
  assert.throws(() => ledger.refund({ ...base, amount: 2, referenceEntryId: capture.id, idempotencyKey: 'refund:5:b' }), LedgerConflictError);
  ledger.chargeback({ ...base, amount: 6, referenceEntryId: grant.id, idempotencyKey: 'chargeback:5:a' });
  assert.throws(() => ledger.chargeback({ ...base, amount: 3, referenceEntryId: grant.id, idempotencyKey: 'chargeback:5:b' }), LedgerConflictError);
});
