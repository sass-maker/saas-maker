import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validatePortfolioIdentityEvidence } from '../lib/portfolio-identity-evidence.mjs';

const registry = JSON.parse(
  await readFile(new URL('../config/portfolio-identity-evidence.json', import.meta.url), 'utf8'),
);

test('declared evidence contract validates and covers all three Toolbox surfaces', () => {
  const result = validatePortfolioIdentityEvidence(registry);
  assert.equal(result.surfaces.length, 3);
  assert.deepEqual(
    result.surfaces.map((s) => s.id).sort(),
    ['karte', 'portfolio', 'rolepatch'],
  );
  for (const surface of result.surfaces) {
    assert.equal(surface.activation.privatePayloadExcluded, true);
    assert.ok(surface.meaningfulCta, `${surface.id} must declare a meaningful CTA`);
    assert.ok(surface.privacy, `${surface.id} must declare a privacy summary`);
  }
});

test('promotion policy is human-controlled — may recommend, may not auto-promote', () => {
  const result = validatePortfolioIdentityEvidence(registry);
  assert.equal(result.promotionPolicy.mayRecommend, true);
  assert.ok(result.promotionPolicy.mayNot.includes('deploy production without approval'));
  assert.ok(result.promotionPolicy.mayNot.includes('change portfolio classification'));
  assert.equal(result.promotionPolicy.decisionOwner, 'sarthak');
});

test('forbidden payload fields cover resume, JD, profile, chat, contact, credentials', () => {
  const result = validatePortfolioIdentityEvidence(registry);
  const forbidden = new Set(result.forbiddenPayloadFields);
  for (const field of ['resume', 'jd', 'stash', 'coverLetter', 'fitScore', 'profile', 'chat', 'contact', 'email', 'credentials', 'apiKey', 'token', 'userId']) {
    assert.ok(forbidden.has(field), `forbiddenPayloadFields must include ${field}`);
  }
});

test('missing required surface fails validation', () => {
  const partial = structuredClone(registry);
  partial.surfaces = partial.surfaces.filter((s) => s.id !== 'karte');
  assert.throws(() => validatePortfolioIdentityEvidence(partial), /missing required surface: karte/);
});

test('activation with privatePayloadExcluded=false fails validation', () => {
  const leaky = structuredClone(registry);
  leaky.surfaces.find((s) => s.id === 'rolepatch').activation.privatePayloadExcluded = false;
  assert.throws(() => validatePortfolioIdentityEvidence(leaky), /privatePayloadExcluded must be true/);
});

test('promotion policy must include the deploy-without-approval guard', () => {
  const result = validatePortfolioIdentityEvidence(registry);
  assert.ok(
    result.promotionPolicy.mayNot.includes('deploy production without approval'),
    'promotionPolicy.mayNot must include "deploy production without approval"',
  );
  assert.ok(
    result.promotionPolicy.mayNot.includes('change portfolio classification'),
    'promotionPolicy.mayNot must include "change portfolio classification"',
  );
});

test('surface without a meaningful CTA fails validation', () => {
  const noCta = structuredClone(registry);
  noCta.surfaces.find((s) => s.id === 'portfolio').meaningfulCta = '';
  assert.throws(() => validatePortfolioIdentityEvidence(noCta), /meaningfulCta are required/);
});
