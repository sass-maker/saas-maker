import { createHash, randomUUID } from 'node:crypto';

const CASTABLE_STATUS = 'active';
const TWIN_TRANSITIONS = Object.freeze({
  draft: new Set(['verifying', 'rejected', 'withdrawn']),
  verifying: new Set(['active', 'rejected', 'withdrawn']),
  active: new Set(['paused', 'withdrawn']),
  paused: new Set(['active', 'withdrawn']),
  rejected: new Set(),
  withdrawn: new Set(),
});

export function acceptActorLicence({ actorId, documentVersion, documentHash, source, acceptedAt = new Date().toISOString() }) {
  if (!actorId || !documentVersion || !validHash(documentHash) || !source) throw new TypeError('complete immutable licence acceptance is required');
  return immutable({ id: randomUUID(), actorId, document: 'actor-licence', documentVersion, documentHash, source, acceptedAt });
}

export function beginBiometricUpload({ actorId, licenceAcceptance }) {
  if (!licenceAcceptance || licenceAcceptance.actorId !== actorId || licenceAcceptance.document !== 'actor-licence') {
    throw new ActorPolicyError('current Actor Licence acceptance is required before biometric upload');
  }
  return immutable({ actorId, licenceAcceptanceId: licenceAcceptance.id, authorisedAt: new Date().toISOString() });
}

export function transitionTwin(twin, nextStatus, evidence = {}) {
  if (!TWIN_TRANSITIONS[twin?.status]?.has(nextStatus)) throw new ActorPolicyError(`invalid twin transition: ${twin?.status} -> ${nextStatus}`);
  if (nextStatus === 'active' && (!evidence.identityVerified || !evidence.livenessVerified || !evidence.licenceAcceptanceId)) {
    throw new ActorPolicyError('identity, liveness, and licence evidence are required to activate a twin');
  }
  return immutable({ ...twin, status: nextStatus, statusChangedAt: new Date().toISOString(), statusEvidence: { ...evidence } });
}

export function createActorLicenceSnapshot({ actor, twin, licenceAcceptance, consent, rate }) {
  if (twin?.actorId !== actor?.id || twin.status !== CASTABLE_STATUS) throw new ActorPolicyError('only an active twin belonging to the actor can be cast');
  if (licenceAcceptance?.actorId !== actor.id || consent?.actorId !== actor.id || consent?.withdrawnAt) {
    throw new ActorPolicyError('active consent and licence evidence are required');
  }
  const snapshot = {
    id: randomUUID(),
    actorId: actor.id,
    twinId: twin.id,
    licenceAcceptance,
    consent,
    rate,
    capturedAt: new Date().toISOString(),
  };
  return immutable({ ...snapshot, integrityHash: sha256(canonical(snapshot)) });
}

export function assertTwinCastable(twin) {
  if (twin?.status !== CASTABLE_STATUS) throw new ActorPolicyError('twin is not available for new uses');
  return twin;
}

export class ActorPolicyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActorPolicyError';
    this.code = 'ACTOR_POLICY_VIOLATION';
  }
}

function immutable(value) {
  return deepFreeze(structuredClone(value));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export { CASTABLE_STATUS, TWIN_TRANSITIONS };
