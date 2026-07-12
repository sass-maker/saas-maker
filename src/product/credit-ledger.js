import { randomUUID } from 'node:crypto';

const POSITIVE_INTEGER = Number.isSafeInteger;

export function createCreditAccount({ workspaceId, currency = 'credits', id, createdAt = new Date().toISOString() }) {
  if (!workspaceId || !currency) throw new TypeError('workspaceId and currency are required');
  return Object.freeze({ id: id ?? randomUUID(), workspaceId, currency, status: 'active', createdAt });
}

export class CreditLedger {
  #entries;
  #idempotency;

  constructor(entries = []) {
    this.#entries = entries.map(validateStoredEntry);
    this.#idempotency = new Map(this.#entries.map((entry) => [`${entry.operation}:${entry.idempotencyKey}`, entry]));
  }

  entries(accountId) {
    return this.#entries.filter((entry) => !accountId || entry.accountId === accountId).map(clone);
  }

  balance(accountId) {
    const entries = this.#entries.filter((entry) => entry.accountId === accountId);
    return Object.freeze({
      available: entries.reduce((sum, entry) => sum + entry.availableDelta, 0),
      held: entries.reduce((sum, entry) => sum + entry.heldDelta, 0),
      captured: entries.reduce((sum, entry) => sum + entry.capturedDelta, 0),
    });
  }

  grant(input) {
    return this.#append(input, 'grant', { availableDelta: input.amount, heldDelta: 0, capturedDelta: 0 });
  }

  hold(input) {
    const duplicate = this.#duplicate(input, 'hold');
    if (duplicate) return duplicate;
    this.#assertAvailable(input.accountId, input.amount);
    return this.#append(input, 'hold', { availableDelta: -input.amount, heldDelta: input.amount, capturedDelta: 0 });
  }

  capture(input) {
    const duplicate = this.#duplicate(input, 'capture');
    if (duplicate) return duplicate;
    this.#assertReferenceBalance(input, 'hold', 'held');
    return this.#append(input, 'capture', { availableDelta: 0, heldDelta: -input.amount, capturedDelta: input.amount });
  }

  release(input) {
    const duplicate = this.#duplicate(input, 'release');
    if (duplicate) return duplicate;
    this.#assertReferenceBalance(input, 'hold', 'held');
    return this.#append(input, 'release', { availableDelta: input.amount, heldDelta: -input.amount, capturedDelta: 0 });
  }

  expire(input) {
    const duplicate = this.#duplicate(input, 'expiry');
    if (duplicate) return duplicate;
    this.#assertAvailable(input.accountId, input.amount);
    return this.#append(input, 'expiry', { availableDelta: -input.amount, heldDelta: 0, capturedDelta: 0 });
  }

  refund(input) {
    const duplicate = this.#duplicate(input, 'refund');
    if (duplicate) return duplicate;
    this.#assertAdjustmentBalance(input, 'capture', ['refund'], 'captured');
    return this.#append(input, 'refund', { availableDelta: input.amount, heldDelta: 0, capturedDelta: -input.amount });
  }

  chargeback(input) {
    const duplicate = this.#duplicate(input, 'chargeback');
    if (duplicate) return duplicate;
    this.#assertAdjustmentBalance(input, 'grant', ['chargeback'], 'granted');
    return this.#append(input, 'chargeback', { availableDelta: -input.amount, heldDelta: 0, capturedDelta: 0 });
  }

  #duplicate(input, operation) {
    validateInput(input);
    const previous = this.#idempotency.get(`${operation}:${input.idempotencyKey}`);
    if (!previous) return null;
    if (!sameOperation(previous, input)) throw new LedgerConflictError('idempotency key was reused with different input');
    return clone(previous);
  }

  #append(input, operation, deltas) {
    validateInput(input);
    const key = `${operation}:${input.idempotencyKey}`;
    const previous = this.#idempotency.get(key);
    if (previous) {
      if (!sameOperation(previous, input)) throw new LedgerConflictError('idempotency key was reused with different input');
      return clone(previous);
    }
    const entry = Object.freeze({
      id: input.id ?? randomUUID(),
      accountId: input.accountId,
      workspaceId: input.workspaceId,
      operation,
      amount: input.amount,
      availableDelta: deltas.availableDelta,
      heldDelta: deltas.heldDelta,
      capturedDelta: deltas.capturedDelta,
      referenceEntryId: input.referenceEntryId ?? null,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    });
    this.#entries.push(entry);
    this.#idempotency.set(key, entry);
    return clone(entry);
  }

  #assertAvailable(accountId, amount) {
    if (this.balance(accountId).available < amount) throw new InsufficientCreditsError();
  }

  #assertReference(input, operation) {
    const reference = this.#entries.find((entry) => entry.id === input.referenceEntryId);
    if (!reference || reference.operation !== operation || reference.accountId !== input.accountId || reference.workspaceId !== input.workspaceId) {
      throw new LedgerConflictError(`a matching ${operation} entry is required`);
    }
    if (input.amount > reference.amount) throw new LedgerConflictError('adjustment exceeds the referenced entry');
    return reference;
  }

  #assertReferenceBalance(input, operation, balanceField) {
    return this.#assertAdjustmentBalance(input, operation, ['capture', 'release'], balanceField);
  }

  #assertAdjustmentBalance(input, operation, adjustmentOperations, balanceField) {
    const reference = this.#assertReference(input, operation);
    const settled = this.#entries
      .filter((entry) => entry.referenceEntryId === reference.id && adjustmentOperations.includes(entry.operation))
      .reduce((sum, entry) => sum + entry.amount, 0);
    if (settled + input.amount > reference.amount) throw new LedgerConflictError(`${balanceField} amount is already settled`);
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('insufficient available credits');
    this.name = 'InsufficientCreditsError';
    this.code = 'INSUFFICIENT_CREDITS';
  }
}

export class LedgerConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LedgerConflictError';
    this.code = 'LEDGER_CONFLICT';
  }
}

function validateInput(input) {
  if (!input?.accountId || !input.workspaceId || !input.idempotencyKey) throw new TypeError('accountId, workspaceId, and idempotencyKey are required');
  if (!POSITIVE_INTEGER(input.amount) || input.amount <= 0) throw new TypeError('amount must be a positive safe integer');
}

function validateStoredEntry(entry) {
  validateInput(entry);
  return Object.freeze({ ...entry, metadata: Object.freeze({ ...(entry.metadata ?? {}) }) });
}

function sameOperation(previous, input) {
  return previous.accountId === input.accountId && previous.workspaceId === input.workspaceId &&
    previous.amount === input.amount && previous.referenceEntryId === (input.referenceEntryId ?? null);
}

function clone(entry) {
  return structuredClone(entry);
}
