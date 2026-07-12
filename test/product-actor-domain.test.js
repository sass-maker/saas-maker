import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ActorPolicyError,
  acceptActorLicence,
  assertTwinCastable,
  beginBiometricUpload,
  createActorLicenceSnapshot,
  createActorProfile,
  searchLicensedActorLibrary,
  transitionTwin,
} from '../src/product/actor-domain.js';

test('actor profile requires an explicit adult attestation', () => {
  assert.throws(() => createActorProfile({
    subjectId: 'subject-1', workspaceId: 'workspace-1', displayName: 'Actor One', adultAttestation: { confirmed: false },
  }), ActorPolicyError);
  const profile = createActorProfile({
    subjectId: 'subject-1', workspaceId: 'workspace-1', displayName: 'Actor One',
    adultAttestation: { confirmed: true, acceptanceId: 'adult-attestation-1' },
    createdAt: '2026-07-01T00:00:00.000Z',
  });
  assert.equal(profile.role, 'actor');
  assert.equal(profile.status, 'onboarding');
  assert.equal(Object.isFrozen(profile.adultAttestation), true);
});

const hash = 'a'.repeat(64);

test('Actor Licence acceptance is required before biometric upload', () => {
  assert.throws(() => beginBiometricUpload({ actorId: 'actor-1' }), ActorPolicyError);
  const acceptance = acceptActorLicence({ actorId: 'actor-1', documentVersion: '2026-01', documentHash: hash, source: 'web' });
  assert.equal(beginBiometricUpload({ actorId: 'actor-1', licenceAcceptance: acceptance }).licenceAcceptanceId, acceptance.id);
});

test('twin activation requires identity, liveness, and licence evidence', () => {
  const verifying = { id: 'twin-1', actorId: 'actor-1', status: 'verifying' };
  assert.throws(() => transitionTwin(verifying, 'active', {}), ActorPolicyError);
  const active = transitionTwin(verifying, 'active', {
    identityVerified: true, livenessVerified: true, licenceAcceptanceId: 'acceptance-1',
  });
  assert.equal(assertTwinCastable(active).status, 'active');
  assert.throws(() => assertTwinCastable(transitionTwin(active, 'withdrawn')), ActorPolicyError);
});

test('generation snapshots immutable consent, licence, twin, and reserved rate', () => {
  const actor = { id: 'actor-1' };
  const twin = { id: 'twin-1', actorId: actor.id, status: 'active' };
  const licenceAcceptance = acceptActorLicence({ actorId: actor.id, documentVersion: '2026-01', documentHash: hash, source: 'web' });
  const consent = { id: 'consent-1', actorId: actor.id, acceptedAt: '2026-01-01T00:00:00.000Z' };
  const snapshot = createActorLicenceSnapshot({ actor, twin, licenceAcceptance, consent, rate: { currency: 'USD', minorUnits: 500 } });
  assert.equal(snapshot.actorId, actor.id);
  assert.equal(snapshot.twinId, twin.id);
  assert.match(snapshot.integrityHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.licenceAcceptance), true);
  assert.equal(Object.isFrozen(snapshot.rate), true);
});

test('paused, withdrawn, and unverified twins cannot be cast', () => {
  for (const status of ['draft', 'verifying', 'paused', 'withdrawn', 'rejected']) {
    assert.throws(() => createActorLicenceSnapshot({
      actor: { id: 'actor-1' },
      twin: { id: `twin-${status}`, actorId: 'actor-1', status },
      licenceAcceptance: { actorId: 'actor-1' },
      consent: { actorId: 'actor-1' },
      rate: { currency: 'USD', minorUnits: 500 },
    }), ActorPolicyError);
  }
});

test('actor library exposes only active twins with the current licence acceptance', () => {
  const current = acceptActorLicence({
    actorId: 'actor-1', documentVersion: '2026-07', documentHash: hash, source: 'web',
  });
  const old = acceptActorLicence({
    actorId: 'actor-2', documentVersion: '2026-01', documentHash: hash, source: 'web',
  });
  const results = searchLicensedActorLibrary({
    actors: [
      { id: 'actor-1', displayName: 'Asha', tags: ['product-demo'] },
      { id: 'actor-2', displayName: 'Ben', tags: ['founder'] },
      { id: 'actor-3', displayName: 'Chen', tags: ['product-demo'] },
    ],
    twins: [
      { id: 'twin-1', actorId: 'actor-1', status: 'active', statusEvidence: { licenceAcceptanceId: current.id } },
      { id: 'twin-2', actorId: 'actor-2', status: 'active', statusEvidence: { licenceAcceptanceId: old.id } },
      { id: 'twin-3', actorId: 'actor-3', status: 'paused', statusEvidence: { licenceAcceptanceId: 'missing' } },
    ],
    licenceAcceptances: [current, old],
    requiredDocumentVersion: '2026-07',
    query: 'product',
  });
  assert.deepEqual(results.map((result) => result.actor.displayName), ['Asha']);
  assert.equal(results[0].twin.status, 'active');
  assert.equal(Object.isFrozen(results[0].actor.tags), true);
});
