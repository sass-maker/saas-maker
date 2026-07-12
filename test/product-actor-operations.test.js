import assert from 'node:assert/strict';
import test from 'node:test';

import { transitionTwin } from '../src/product/actor-domain.js';
import {
  ActorOperationsError,
  actorControlledTwinTransition,
  createTwinAsset,
  escalateActorSafety,
  recordActorVerification,
  transitionTwinAsset,
} from '../src/product/actor-operations.js';

const activeTwin = { id: 'twin-a', actorId: 'actor-a', status: 'active' };

test('verification and twin assets retain processor evidence without raw biometric content', () => {
  const verification = recordActorVerification({ actorId: 'actor-a', kind: 'identity', providerReference: 'ref-a', status: 'verified' });
  assert.equal(verification.status, 'verified');
  const asset = createTwinAsset({
    id: 'asset-a', actorId: 'actor-a', twinId: 'twin-a', kind: 'face', processor: 'fake-processor',
    processorReference: 'opaque-ref', purpose: 'twin-generation', retentionPolicyVersion: 'policy-1', status: 'stored',
  });
  const requested = transitionTwinAsset(asset, 'deletion_requested', { reason: 'actor-withdrawal', idempotencyKey: 'delete-a' });
  const deleted = transitionTwinAsset(requested, 'deleted', { processorReceiptId: 'receipt-a' });
  assert.equal(deleted.status, 'deleted');
  assert.equal(deleted.deletion.processorReceiptId, 'receipt-a');
  assert.throws(() => transitionTwinAsset(asset, 'deleted', { processorReceiptId: 'skip' }), ActorOperationsError);
});

test('only the owning actor can pause or permanently withdraw future casting', () => {
  assert.equal(actorControlledTwinTransition(activeTwin, { actorId: 'actor-a', action: 'pause' }).status, 'paused');
  assert.equal(actorControlledTwinTransition(activeTwin, { actorId: 'actor-a', action: 'withdraw' }).status, 'withdrawn');
  assert.throws(() => actorControlledTwinTransition(activeTwin, { actorId: 'actor-b', action: 'pause' }), ActorOperationsError);
});

test('death/incapacity and misuse pause casting while fraud invalidation withdraws it', () => {
  assert.equal(escalateActorSafety(activeTwin, { kind: 'death_or_incapacity', evidenceId: 'case-a' }).status, 'paused');
  assert.equal(escalateActorSafety(activeTwin, { kind: 'misuse', evidenceId: 'case-b' }).status, 'paused');
  assert.equal(escalateActorSafety(activeTwin, { kind: 'fraud_invalidation', evidenceId: 'case-c' }).status, 'withdrawn');
});

test('withdrawal cannot rewrite delivered licence evidence', () => {
  const delivered = Object.freeze({ outputId: 'output-a', licenceSnapshotId: 'snapshot-a' });
  const withdrawn = actorControlledTwinTransition(activeTwin, { actorId: 'actor-a', action: 'withdraw' });
  assert.equal(withdrawn.status, 'withdrawn');
  assert.deepEqual(delivered, { outputId: 'output-a', licenceSnapshotId: 'snapshot-a' });
  assert.throws(() => transitionTwin(withdrawn, 'active', {}));
});
