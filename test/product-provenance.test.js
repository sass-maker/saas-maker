import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DisclosureBlockedError,
  ProvenanceError,
  createOutputProvenance,
  verifyOutputProvenance,
} from '../src/product/provenance.js';
import { acceptActorLicence, createActorLicenceSnapshot, transitionTwin } from '../src/product/actor-domain.js';

function validInput(overrides = {}) {
  return {
    workspaceId: 'workspace-a',
    outputId: 'output-1',
    briefId: 'brief-1',
    inputRightsAttestation: { accepted: true, acceptanceId: 'rights-1', version: '2026-01' },
    renderer: { provider: 'reel-pipeline', model: 'render-pro', version: '1' },
    sourceAssets: [{ id: 'asset-1', rightsBasis: 'customer-owned' }],
    music: { id: 'music-1', rightsBasis: 'licensed' },
    voice: { provider: 'kokoro', model: '82m', version: '1' },
    review: { briefAcceptanceId: 'brief-accept-1', outputAcceptanceId: 'output-accept-1' },
    disclosure: { decision: 'label', policyVersion: '2026-01', required: true, applied: true },
    generatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('delivered output provenance is immutable and integrity-verifiable', () => {
  const record = createOutputProvenance(validInput());
  assert.equal(Object.isFrozen(record.sourceAssets[0]), true);
  assert.equal(verifyOutputProvenance(record), true);
  assert.equal(verifyOutputProvenance({ ...record, outputId: 'tampered' }), false);
});

test('customer input-rights evidence is mandatory', () => {
  assert.throws(() => createOutputProvenance(validInput({ inputRightsAttestation: null })), ProvenanceError);
});

test('actor outputs require the exact licence snapshot', () => {
  assert.throws(() => createOutputProvenance(validInput({ actorUse: { actorId: 'actor-1', twinId: 'twin-1' } })), ProvenanceError);
  const record = createOutputProvenance(validInput({
    actorUse: { actorId: 'actor-1', twinId: 'twin-1', licenceSnapshotId: 'snapshot-1' },
  }));
  assert.equal(record.actorUse.licenceSnapshotId, 'snapshot-1');
});

test('delivery is blocked when required disclosure is absent', () => {
  assert.throws(() => createOutputProvenance(validInput({
    disclosure: { decision: 'label', policyVersion: '2026-01', required: true, applied: false, reason: 'exporter cannot label' },
  })), DisclosureBlockedError);
  assert.throws(() => createOutputProvenance(validInput({
    disclosure: { decision: 'metadata', policyVersion: '2026-01', required: true, applied: true, machineReadableRequired: true },
  })), DisclosureBlockedError);
});

test('actor licence snapshot is attached unchanged to delivered provenance', () => {
  const actor = { id: 'actor-1' };
  const licenceAcceptance = acceptActorLicence({
    actorId: actor.id, documentVersion: '2026-07', documentHash: 'a'.repeat(64), source: 'customer-app',
  });
  const twin = transitionTwin({ id: 'twin-1', actorId: actor.id, status: 'verifying' }, 'active', {
    identityVerified: true, livenessVerified: true, licenceAcceptanceId: licenceAcceptance.id,
  });
  const snapshot = createActorLicenceSnapshot({
    actor, twin, licenceAcceptance, consent: { id: 'consent-1', actorId: actor.id }, rate: { amount: 25, currency: 'USD_CENTS' },
  });
  const record = createOutputProvenance(validInput({
    actorUse: { actorId: actor.id, twinId: twin.id, licenceSnapshotId: snapshot.id },
  }));
  assert.equal(record.actorUse.licenceSnapshotId, snapshot.id);
  assert.equal(verifyOutputProvenance(record), true);
});
