import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateQuietExperiments } from '../lib/portfolio-identity-quiet-experiments.mjs';

const registry = JSON.parse(
  await readFile(new URL('../config/portfolio-identity-quiet-experiments.json', import.meta.url), 'utf8'),
);

test('declared experiments validate and cover all three Toolbox surfaces', () => {
  const result = validateQuietExperiments(registry);
  assert.equal(result.experiments.length, 3);
  assert.deepEqual(
    result.experiments.map((e) => e.surface).sort(),
    ['karte', 'portfolio', 'rolepatch'],
  );
});

test('every experiment is bounded with start, expiry, budget, metric, and stop rule', () => {
  const result = validateQuietExperiments(registry);
  for (const exp of result.experiments) {
    assert.ok(exp.startAt, `${exp.id}: startAt required`);
    assert.ok(exp.expiryAt, `${exp.id}: expiryAt required`);
    assert.ok(Date.parse(exp.expiryAt) > Date.parse(exp.startAt), `${exp.id}: expiry must be after start`);
    assert.ok(exp.budget && exp.budget.max > 0, `${exp.id}: budget.max must be positive`);
    assert.ok(exp.metric && exp.metric.threshold > 0, `${exp.id}: metric.threshold must be positive`);
    assert.ok(exp.stopRule, `${exp.id}: stopRule required`);
    assert.ok(exp.attribution.includes('utm_'), `${exp.id}: attribution must include UTM`);
  }
});

test('no experiment is launch-approved — distribution requires separate human approval', () => {
  const result = validateQuietExperiments(registry);
  for (const exp of result.experiments) {
    assert.equal(exp.launchApproved, false, `${exp.id}: launchApproved must be false`);
  }
});

test('every experiment is review-controlled with no replacement campaign', () => {
  assert.equal(registry.defaults.reviewControlled, true);
  assert.equal(registry.defaults.autoExpire, true);
  assert.equal(registry.defaults.noReplacementCampaign, true);
});

test('experiment with launchApproved=true fails validation', () => {
  const launched = structuredClone(registry);
  launched.experiments[0].launchApproved = true;
  assert.throws(() => validateQuietExperiments(launched), /launchApproved must be false/);
});

test('experiment without expiry fails validation', () => {
  const noExpiry = structuredClone(registry);
  delete noExpiry.experiments[0].expiryAt;
  assert.throws(() => validateQuietExperiments(noExpiry), /startAt and expiryAt are required/);
});

test('experiment with expiry before start fails validation', () => {
  const inverted = structuredClone(registry);
  inverted.experiments[0].expiryAt = '2026-07-01T00:00:00Z';
  inverted.experiments[0].startAt = '2026-08-01T00:00:00Z';
  assert.throws(() => validateQuietExperiments(inverted), /expiryAt must be after startAt/);
});

test('experiment without stop rule fails validation', () => {
  const noStop = structuredClone(registry);
  delete noStop.experiments[0].stopRule;
  assert.throws(() => validateQuietExperiments(noStop), /stopRule is required/);
});

test('experiment without attribution UTM fails validation', () => {
  const noUtm = structuredClone(registry);
  noUtm.experiments[0].attribution = 'campaign=foo';
  assert.throws(() => validateQuietExperiments(noUtm), /attribution must include UTM/);
});
