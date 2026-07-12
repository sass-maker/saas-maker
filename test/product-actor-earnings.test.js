import assert from 'node:assert/strict';
import test from 'node:test';

import { ActorEarningsError, ActorEarningsLedger } from '../src/product/actor-earnings.js';

const input = {
  actorId: 'actor-a', actorUseId: 'use-a', workspaceId: 'workspace-a', amount: 25,
  currency: 'USD_CENTS', rateSnapshotId: 'rate-a', idempotencyKey: 'use-a:earning',
};

test('one successful actor use accrues one idempotent append-only earning', () => {
  const ledger = new ActorEarningsLedger();
  const first = ledger.accrue(input);
  const duplicate = ledger.accrue(input);
  assert.deepEqual(duplicate, first);
  assert.equal(ledger.entries('actor-a').length, 1);
  assert.equal(ledger.balance('actor-a'), 25);
});

test('refund and chargeback adjustments are explicit bounded reversals', () => {
  const ledger = new ActorEarningsLedger();
  const earning = ledger.accrue(input);
  ledger.reverse({ ...input, amount: 10, referenceEntryId: earning.id, idempotencyKey: 'use-a:refund', reason: 'brand_refund' });
  assert.deepEqual(ledger.entries('actor-a').map((entry) => entry.operation), ['earning', 'reversal']);
  assert.equal(ledger.balance('actor-a'), 15);
  assert.throws(() => ledger.reverse({
    ...input, amount: 16, referenceEntryId: earning.id, idempotencyKey: 'use-a:chargeback', reason: 'chargeback',
  }), ActorEarningsError);
});

test('earnings cannot be linked across actors or uses', () => {
  const ledger = new ActorEarningsLedger();
  const earning = ledger.accrue(input);
  assert.throws(() => ledger.reverse({
    ...input, actorId: 'actor-b', amount: 1, referenceEntryId: earning.id, idempotencyKey: 'cross-actor',
  }), ActorEarningsError);
});
