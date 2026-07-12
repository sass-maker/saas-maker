import { randomUUID } from 'node:crypto';

export class ActorEarningsLedger {
  #entries;
  #idempotency;

  constructor(entries = []) {
    this.#entries = entries.map(validateEntry);
    this.#idempotency = new Map(this.#entries.map((entry) => [entry.idempotencyKey, entry]));
  }

  accrue(input) {
    return this.#append(input, 'earning', input.amount);
  }

  reverse(input) {
    const source = this.#entries.find((entry) => entry.id === input?.referenceEntryId && entry.operation === 'earning');
    if (!source || source.actorId !== input.actorId || source.actorUseId !== input.actorUseId) {
      throw new ActorEarningsError('matching actor earning is required');
    }
    const reversed = this.#entries
      .filter((entry) => entry.operation === 'reversal' && entry.referenceEntryId === source.id)
      .reduce((sum, entry) => sum + Math.abs(entry.amountDelta), 0);
    if (reversed + input.amount > source.amountDelta) throw new ActorEarningsError('reversal exceeds original earning');
    return this.#append(input, 'reversal', -input.amount);
  }

  entries(actorId) {
    return this.#entries.filter((entry) => !actorId || entry.actorId === actorId).map((entry) => structuredClone(entry));
  }

  balance(actorId) {
    return this.#entries.filter((entry) => entry.actorId === actorId).reduce((sum, entry) => sum + entry.amountDelta, 0);
  }

  #append(input, operation, amountDelta) {
    validateInput(input);
    const existing = this.#idempotency.get(input.idempotencyKey);
    if (existing) {
      if (!sameEntry(existing, input, operation, amountDelta)) throw new ActorEarningsError('idempotency key was reused with different input');
      return structuredClone(existing);
    }
    const entry = Object.freeze({
      id: input.id ?? randomUUID(),
      actorId: input.actorId,
      actorUseId: input.actorUseId,
      workspaceId: input.workspaceId,
      operation,
      amountDelta,
      currency: input.currency,
      rateSnapshotId: input.rateSnapshotId,
      referenceEntryId: input.referenceEntryId ?? null,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      reason: input.reason ?? null,
    });
    this.#entries.push(entry);
    this.#idempotency.set(entry.idempotencyKey, entry);
    return structuredClone(entry);
  }
}

export class ActorEarningsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActorEarningsError';
    this.code = 'ACTOR_EARNINGS_CONFLICT';
  }
}

function validateInput(input) {
  if (!input?.actorId || !input.actorUseId || !input.workspaceId || !input.currency || !input.rateSnapshotId || !input.idempotencyKey) {
    throw new TypeError('actor, use, workspace, currency, rate snapshot, and idempotency key are required');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) throw new TypeError('amount must be a positive safe integer');
}

function validateEntry(entry) {
  const amount = Math.abs(entry.amountDelta);
  validateInput({ ...entry, amount });
  if (!['earning', 'reversal'].includes(entry.operation) || (entry.operation === 'earning') !== (entry.amountDelta > 0)) {
    throw new TypeError('invalid stored earning entry');
  }
  return Object.freeze({ ...entry });
}

function sameEntry(previous, input, operation, amountDelta) {
  return previous.actorId === input.actorId && previous.actorUseId === input.actorUseId && previous.workspaceId === input.workspaceId &&
    previous.operation === operation && previous.amountDelta === amountDelta && previous.currency === input.currency &&
    previous.rateSnapshotId === input.rateSnapshotId && previous.referenceEntryId === (input.referenceEntryId ?? null);
}
