const ACTOR_ACCEPTANCE_GATES = Object.freeze([
  'consent',
  'licence',
  'identity',
  'liveness',
  'earnings',
  'withdrawal',
  'retention',
  'misuse',
  'payout',
]);

export function resolveProductFeatureGates(env = process.env) {
  const evidence = Object.fromEntries(
    ACTOR_ACCEPTANCE_GATES.map((gate) => [gate, enabled(env[`HEXCODED_ACTOR_${gate.toUpperCase()}_PROVEN`])]),
  );
  const actorAcceptanceComplete = Object.values(evidence).every(Boolean);

  return Object.freeze({
    brandSelfServe: enabled(env.HEXCODED_BRAND_SELF_SERVE_ENABLED),
    billing: enabled(env.HEXCODED_BILLING_ENABLED),
    socialPublishing: enabled(env.HEXCODED_SOCIAL_PUBLISHING_ENABLED),
    actorCasting: enabled(env.HEXCODED_ACTOR_CASTING_ENABLED) && actorAcceptanceComplete,
    actorAcceptanceComplete,
    actorEvidence: Object.freeze(evidence),
  });
}

export function assertFeatureEnabled(feature, gates = resolveProductFeatureGates()) {
  if (!Object.hasOwn(gates, feature) || gates[feature] !== true) {
    throw new ProductFeatureDisabledError(feature);
  }
}

export class ProductFeatureDisabledError extends Error {
  constructor(feature) {
    super(`${feature} is not enabled`);
    this.name = 'ProductFeatureDisabledError';
    this.code = 'PRODUCT_FEATURE_DISABLED';
  }
}

function enabled(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export { ACTOR_ACCEPTANCE_GATES };
