import assert from 'node:assert/strict';
import test from 'node:test';

import { ActorEarningsLedger } from '../src/product/actor-earnings.js';
import { acceptActorLicence, createActorLicenceSnapshot, createActorProfile, transitionTwin } from '../src/product/actor-domain.js';
import { actorControlledTwinTransition, recordActorVerification } from '../src/product/actor-operations.js';
import { actorEarningsDashboard, createPayoutAccount, recordActorCompliance, requestActorPayout, transitionPayout } from '../src/product/actor-payouts.js';
import { createOutputProvenance } from '../src/product/provenance.js';

test('actor smoke: consent -> verify -> cast -> artifact/licence -> earning -> withdraw -> payout', () => {
  const actor = createActorProfile({ subjectId: 'actor-user-a', workspaceId: 'actor-workspace-a', displayName: 'Actor A',
    adultAttestation: { confirmed: true, acceptanceId: 'adult-a' } });
  const licence = acceptActorLicence({ actorId: actor.id, documentVersion: '2026-07', documentHash: 'a'.repeat(64), source: 'fake-app' });
  const identity = recordActorVerification({ actorId: actor.id, kind: 'identity', providerReference: 'identity-a', status: 'verified' });
  const liveness = recordActorVerification({ actorId: actor.id, kind: 'liveness', providerReference: 'liveness-a', status: 'verified' });
  assert.equal(identity.status, 'verified');
  assert.equal(liveness.status, 'verified');
  const twin = transitionTwin({ id: 'twin-a', actorId: actor.id, status: 'verifying' }, 'active', {
    identityVerified: true, livenessVerified: true, licenceAcceptanceId: licence.id,
  });
  const snapshot = createActorLicenceSnapshot({ actor, twin, licenceAcceptance: licence,
    consent: { id: 'consent-a', actorId: actor.id }, rate: { amount: 100, currency: 'USD_CENTS' } });
  const output = createOutputProvenance({ workspaceId: 'brand-workspace-a', outputId: 'output-a', briefId: 'brief-a',
    inputRightsAttestation: { accepted: true, acceptanceId: 'rights-a' }, renderer: { provider: 'fake', model: 'actor-smoke', version: '1' },
    sourceAssets: [{ id: 'product-a', rightsBasis: 'customer-supplied' }], actorUse: { actorId: actor.id, twinId: twin.id,
      licenceSnapshotId: snapshot.id, actorStatus: 'active', twinStatus: 'active' },
    review: { briefAcceptanceId: 'brief-accept-a', outputAcceptanceId: 'output-accept-a' },
    disclosure: { decision: 'label', policyVersion: 'fake-policy', required: true, applied: true } });
  const earnings = new ActorEarningsLedger();
  earnings.accrue({ actorId: actor.id, actorUseId: 'use-a', workspaceId: 'brand-workspace-a', amount: 100,
    currency: 'USD_CENTS', rateSnapshotId: snapshot.id, idempotencyKey: 'earning-a' });
  const withdrawn = actorControlledTwinTransition(twin, { actorId: actor.id, action: 'withdraw' });
  assert.equal(withdrawn.status, 'withdrawn');
  assert.equal(output.actorUse.licenceSnapshotId, snapshot.id);
  const account = createPayoutAccount({ id: 'payout-account-a', actorId: actor.id, provider: 'fake', providerAccountReference: 'opaque-a',
    currency: 'USD_CENTS', country: 'US', status: 'active' });
  const compliance = recordActorCompliance({ actorId: actor.id, kycStatus: 'verified', taxStatus: 'complete', providerReference: 'kyc-a' });
  const dashboard = actorEarningsDashboard({ actorId: actor.id, earningEntries: earnings.entries(), payouts: [] });
  const requested = requestActorPayout({ actorId: actor.id, payoutAccount: account, compliance, amount: dashboard.payable,
    currency: 'USD_CENTS', payableBalance: dashboard.payable, idempotencyKey: 'payout-a' });
  const paid = transitionPayout(transitionPayout(requested, 'processing'), 'paid', { providerReceiptId: 'receipt-a' });
  assert.equal(paid.status, 'paid');
});
