import { randomUUID } from 'node:crypto';

const PAYOUT_TRANSITIONS = Object.freeze({
  requested: new Set(['processing', 'cancelled', 'failed']),
  processing: new Set(['paid', 'failed']),
  failed: new Set(['processing', 'cancelled']),
  cancelled: new Set(),
  paid: new Set(),
});

export function recordActorCompliance(input) {
  if (!input?.actorId || !['not_started', 'pending', 'verified', 'failed', 'expired'].includes(input.kycStatus) ||
      !['unknown', 'pending', 'complete', 'action_required'].includes(input.taxStatus)) {
    throw new ActorPayoutError('actor KYC and tax statuses are required');
  }
  return immutable({
    actorId: input.actorId, kycStatus: input.kycStatus, taxStatus: input.taxStatus,
    providerReference: input.providerReference ?? null, updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
}

export function createPayoutAccount(input) {
  if (!input?.actorId || !input.provider || !input.providerAccountReference || !input.currency || !input.country) {
    throw new ActorPayoutError('tokenised provider payout account details are required');
  }
  return immutable({
    id: input.id ?? randomUUID(), actorId: input.actorId, provider: input.provider,
    providerAccountReference: input.providerAccountReference, currency: input.currency,
    country: input.country, status: input.status ?? 'pending', createdAt: input.createdAt ?? new Date().toISOString(),
  });
}

export function requestActorPayout({ actorId, payoutAccount, compliance, amount, currency, idempotencyKey, payableBalance, id, requestedAt }) {
  if (!actorId || payoutAccount?.actorId !== actorId || payoutAccount.status !== 'active' ||
      compliance?.actorId !== actorId || compliance.kycStatus !== 'verified' || compliance.taxStatus !== 'complete') {
    throw new ActorPayoutError('active payout account and completed KYC/tax checks are required');
  }
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > payableBalance || currency !== payoutAccount.currency || !idempotencyKey) {
    throw new ActorPayoutError('valid payable amount, currency, and idempotency key are required');
  }
  return immutable({
    id: id ?? randomUUID(), actorId, payoutAccountId: payoutAccount.id, amount, currency,
    idempotencyKey, status: 'requested', requestedAt: requestedAt ?? new Date().toISOString(), providerReceiptId: null,
  });
}

export function transitionPayout(payout, nextStatus, input = {}) {
  if (!PAYOUT_TRANSITIONS[payout?.status]?.has(nextStatus)) throw new ActorPayoutError(`invalid payout transition: ${payout?.status} -> ${nextStatus}`);
  if (nextStatus === 'paid' && !input.providerReceiptId) throw new ActorPayoutError('provider payout receipt is required');
  return immutable({
    ...payout, status: nextStatus, statusChangedAt: input.at ?? new Date().toISOString(),
    providerReceiptId: input.providerReceiptId ?? payout.providerReceiptId,
    failureCode: input.failureCode ?? null,
  });
}

export function actorEarningsDashboard({ actorId, earningEntries, payouts }) {
  const entries = earningEntries.filter((entry) => entry.actorId === actorId);
  const accrued = entries.reduce((sum, entry) => sum + entry.amountDelta, 0);
  const paid = payouts.filter((payout) => payout.actorId === actorId && payout.status === 'paid').reduce((sum, payout) => sum + payout.amount, 0);
  const processing = payouts.filter((payout) => payout.actorId === actorId && ['requested', 'processing'].includes(payout.status)).reduce((sum, payout) => sum + payout.amount, 0);
  const earned = entries.filter((entry) => entry.operation === 'earning').reduce((sum, entry) => sum + entry.amountDelta, 0);
  const reversed = Math.abs(entries.filter((entry) => entry.operation === 'reversal').reduce((sum, entry) => sum + entry.amountDelta, 0));
  return Object.freeze({ actorId, accrued, payable: Math.max(0, accrued - paid - processing), paid, processing, earned, reversed });
}

export class ActorPayoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActorPayoutError';
    this.code = 'ACTOR_PAYOUT_CONFLICT';
  }
}

function immutable(value) {
  return Object.freeze(structuredClone(value));
}

export { PAYOUT_TRANSITIONS };
