import assert from 'node:assert/strict';
import test from 'node:test';

import { ActorEarningsLedger } from '../src/product/actor-earnings.js';
import {
  ActorPayoutError,
  actorEarningsDashboard,
  createPayoutAccount,
  recordActorCompliance,
  requestActorPayout,
  transitionPayout,
} from '../src/product/actor-payouts.js';

function earningSetup() {
  const ledger = new ActorEarningsLedger();
  const earning = ledger.accrue({ actorId: 'actor-a', actorUseId: 'use-a', workspaceId: 'workspace-a', amount: 100,
    currency: 'USD_CENTS', rateSnapshotId: 'rate-a', idempotencyKey: 'earning-a' });
  return { ledger, earning };
}

test('payout requires active tokenised account plus completed KYC and tax status', () => {
  const account = createPayoutAccount({ id: 'payout-account-a', actorId: 'actor-a', provider: 'fake', providerAccountReference: 'opaque-a', currency: 'USD_CENTS', country: 'US', status: 'active' });
  const incomplete = recordActorCompliance({ actorId: 'actor-a', kycStatus: 'pending', taxStatus: 'pending' });
  assert.throws(() => requestActorPayout({ actorId: 'actor-a', payoutAccount: account, compliance: incomplete, amount: 50, currency: 'USD_CENTS', payableBalance: 100, idempotencyKey: 'payout-a' }), ActorPayoutError);
  const compliance = recordActorCompliance({ actorId: 'actor-a', kycStatus: 'verified', taxStatus: 'complete', providerReference: 'check-a' });
  const payout = requestActorPayout({ actorId: 'actor-a', payoutAccount: account, compliance, amount: 50, currency: 'USD_CENTS', payableBalance: 100, idempotencyKey: 'payout-a' });
  const paid = transitionPayout(transitionPayout(payout, 'processing'), 'paid', { providerReceiptId: 'receipt-a' });
  assert.equal(paid.status, 'paid');
});

test('dashboard reports earned, reversed, payable, processing, and paid balances', () => {
  const { ledger, earning } = earningSetup();
  ledger.reverse({ actorId: 'actor-a', actorUseId: 'use-a', workspaceId: 'workspace-a', amount: 20,
    currency: 'USD_CENTS', rateSnapshotId: 'rate-a', referenceEntryId: earning.id, idempotencyKey: 'reversal-a' });
  const dashboard = actorEarningsDashboard({ actorId: 'actor-a', earningEntries: ledger.entries(), payouts: [
    { actorId: 'actor-a', status: 'paid', amount: 30 }, { actorId: 'actor-a', status: 'processing', amount: 10 },
  ] });
  assert.deepEqual(dashboard, { actorId: 'actor-a', accrued: 80, payable: 40, paid: 30, processing: 10, earned: 100, reversed: 20 });
});

test('payout amount cannot exceed payable balance and paid state needs a receipt', () => {
  const account = createPayoutAccount({ actorId: 'actor-a', provider: 'fake', providerAccountReference: 'opaque-a', currency: 'USD_CENTS', country: 'US', status: 'active' });
  const compliance = recordActorCompliance({ actorId: 'actor-a', kycStatus: 'verified', taxStatus: 'complete' });
  assert.throws(() => requestActorPayout({ actorId: 'actor-a', payoutAccount: account, compliance, amount: 101, currency: 'USD_CENTS', payableBalance: 100, idempotencyKey: 'too-large' }), ActorPayoutError);
  const payout = requestActorPayout({ actorId: 'actor-a', payoutAccount: account, compliance, amount: 50, currency: 'USD_CENTS', payableBalance: 100, idempotencyKey: 'valid' });
  assert.throws(() => transitionPayout(transitionPayout(payout, 'processing'), 'paid'), ActorPayoutError);
});
