import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTOR_ACCEPTANCE_GATES,
  ProductFeatureDisabledError,
  assertFeatureEnabled,
  resolveProductFeatureGates,
} from '../src/product/feature-gates.js';

test('all HexCoded product capabilities fail closed by default', () => {
  const gates = resolveProductFeatureGates({});
  assert.deepEqual(gates, {
    brandSelfServe: false,
    billing: false,
    socialPublishing: false,
    actorCasting: false,
    actorAcceptanceComplete: false,
    actorEvidence: Object.fromEntries(ACTOR_ACCEPTANCE_GATES.map((gate) => [gate, false])),
  });
});

test('actor casting remains disabled when any acceptance proof is missing', () => {
  const env = { HEXCODED_ACTOR_CASTING_ENABLED: 'true' };
  for (const gate of ACTOR_ACCEPTANCE_GATES.slice(0, -1)) env[`HEXCODED_ACTOR_${gate.toUpperCase()}_PROVEN`] = 'true';

  const gates = resolveProductFeatureGates(env);
  assert.equal(gates.actorAcceptanceComplete, false);
  assert.equal(gates.actorCasting, false);
  assert.throws(() => assertFeatureEnabled('actorCasting', gates), ProductFeatureDisabledError);
});

test('actor casting requires the explicit flag and every acceptance proof', () => {
  const env = Object.fromEntries(ACTOR_ACCEPTANCE_GATES.map((gate) => [`HEXCODED_ACTOR_${gate.toUpperCase()}_PROVEN`, 'true']));
  assert.equal(resolveProductFeatureGates(env).actorCasting, false);
  env.HEXCODED_ACTOR_CASTING_ENABLED = 'true';
  assert.equal(resolveProductFeatureGates(env).actorCasting, true);
});
