import { randomUUID } from 'node:crypto';

import { ActorPolicyError, transitionTwin } from './actor-domain.js';

const ASSET_TRANSITIONS = Object.freeze({
  pending_upload: new Set(['stored', 'deletion_requested']),
  stored: new Set(['deletion_requested']),
  deletion_requested: new Set(['deleted', 'deletion_failed']),
  deletion_failed: new Set(['deletion_requested']),
  deleted: new Set(),
});

export function recordActorVerification(input) {
  if (!input?.actorId || !input.providerReference || !['identity', 'liveness'].includes(input.kind) ||
      !['pending', 'verified', 'failed', 'invalidated'].includes(input.status)) {
    throw new ActorOperationsError('complete provider verification evidence is required');
  }
  return immutable({
    id: input.id ?? randomUUID(), actorId: input.actorId, kind: input.kind,
    providerReference: input.providerReference, status: input.status,
    checkedAt: input.checkedAt ?? new Date().toISOString(), reasonCode: input.reasonCode ?? null,
  });
}

export function createTwinAsset(input) {
  if (!input?.actorId || !input.twinId || !['face', 'voice', 'liveness', 'verification'].includes(input.kind) ||
      !input.processor || !input.processorReference || !input.purpose || !input.retentionPolicyVersion) {
    throw new ActorOperationsError('asset owner, processor reference, purpose, and retention policy are required');
  }
  return immutable({
    id: input.id ?? randomUUID(), actorId: input.actorId, twinId: input.twinId,
    kind: input.kind, processor: input.processor, processorReference: input.processorReference,
    purpose: input.purpose, retentionPolicyVersion: input.retentionPolicyVersion,
    status: input.status ?? 'pending_upload', createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function transitionTwinAsset(asset, nextStatus, input = {}) {
  if (!ASSET_TRANSITIONS[asset?.status]?.has(nextStatus)) {
    throw new ActorOperationsError(`invalid twin asset transition: ${asset?.status} -> ${nextStatus}`);
  }
  if (nextStatus === 'deletion_requested' && (!input.reason || !input.idempotencyKey)) {
    throw new ActorOperationsError('processor deletion requires a reason and idempotency key');
  }
  if (nextStatus === 'deleted' && !input.processorReceiptId) {
    throw new ActorOperationsError('processor deletion receipt is required');
  }
  return immutable({
    ...asset, status: nextStatus, statusChangedAt: input.at ?? new Date().toISOString(),
    deletion: nextStatus.startsWith('deletion_') || nextStatus === 'deleted'
      ? { ...asset.deletion, reason: input.reason ?? asset.deletion?.reason, idempotencyKey: input.idempotencyKey ?? asset.deletion?.idempotencyKey,
          processorReceiptId: input.processorReceiptId ?? asset.deletion?.processorReceiptId ?? null, errorCode: input.errorCode ?? null }
      : asset.deletion,
  });
}

export function actorControlledTwinTransition(twin, { actorId, action, reason, at }) {
  if (!actorId || twin?.actorId !== actorId || !['pause', 'withdraw'].includes(action)) {
    throw new ActorOperationsError('only the owning actor can pause or withdraw a twin');
  }
  const nextStatus = action === 'pause' ? 'paused' : 'withdrawn';
  return transitionTwin(twin, nextStatus, { actorInitiated: true, reason, at });
}

export function escalateActorSafety(twin, { kind, evidenceId, at = new Date().toISOString() }) {
  if (!['death_or_incapacity', 'fraud_invalidation', 'misuse'].includes(kind) || !evidenceId) {
    throw new ActorOperationsError('supported escalation kind and evidence are required');
  }
  if (!['active', 'paused', 'verifying', 'draft'].includes(twin?.status)) {
    throw new ActorPolicyError('twin cannot be escalated from its current state');
  }
  const nextStatus = kind === 'fraud_invalidation' ? 'withdrawn' : (twin.status === 'active' ? 'paused' : 'withdrawn');
  return immutable({
    ...twin, status: nextStatus, statusChangedAt: at,
    statusEvidence: { escalationKind: kind, evidenceId, humanReviewRequired: true },
  });
}

export class ActorOperationsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActorOperationsError';
    this.code = 'ACTOR_OPERATIONS_CONFLICT';
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

export { ASSET_TRANSITIONS };
