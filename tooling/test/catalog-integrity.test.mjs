import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeCatalogIntegrity } from '../lib/catalog-integrity.mjs';
import { summarizeReadiness } from '../lib/agent-readiness.mjs';

test('capped catalog reports unchecked surfaces separately from checked validity', () => {
  const results = Array.from({ length: 1_000 }, (_, index) => ({
    id: `surface-${index}`,
    valid: true,
  }));
  const summary = summarizeCatalogIntegrity(results, 1_771);

  assert.equal(summary.status, 'partial');
  assert.equal(summary.data.valid, 1_000);
  assert.equal(summary.data.invalid, 0);
  assert.equal(summary.data.checked, 1_000);
  assert.equal(summary.data.configured, 1_771);
  assert.equal(summary.data.unchecked, 771);
  assert.equal(summary.data.checkedIntegrityPercent, 100);
  assert.equal(summary.data.coveragePercent, 56.5);
  assert.deepEqual(summary.data.failures, []);
  assert.match(summary.detail, /1000\/1000 checked catalog surfaces valid/);
  assert.match(summary.detail, /771 not checked/);

  const checks = Object.fromEntries(
    Array.from({ length: 11 }, (_, index) => [`check-${index}`, { status: 'pass' }]),
  );
  checks['check-10'] = { status: summary.status };
  const readiness = summarizeReadiness(checks, Object.keys(checks));
  assert.equal(readiness.tier, 'A');
  assert.equal(readiness.pass, 10);
  assert.equal(readiness.fail, 0);
  assert.equal(readiness.partial, 1);
});

test('capped catalog preserves real failures among checked surfaces', () => {
  const results = Array.from({ length: 1_000 }, (_, index) => ({
    id: `surface-${index}`,
    valid: true,
  }));
  results[512] = {
    id: 'missing-route',
    valid: false,
    reason: 'url absent from public sitemap',
  };

  const summary = summarizeCatalogIntegrity(results, 1_430);

  assert.equal(summary.status, 'fail');
  assert.equal(summary.data.valid, 999);
  assert.equal(summary.data.invalid, 1);
  assert.equal(summary.data.checked, 1_000);
  assert.equal(summary.data.unchecked, 430);
  assert.deepEqual(summary.data.failures, [
    { id: 'missing-route', reason: 'url absent from public sitemap' },
  ]);
  assert.match(summary.detail, /999\/1000 checked catalog surfaces valid/);
  assert.match(summary.detail, /430 not checked/);
  assert.equal(summary.status, 'fail');
});

test('complete valid catalog is pass and can earn S tier', () => {
  const summary = summarizeCatalogIntegrity(
    Array.from({ length: 3 }, (_, index) => ({ id: `surface-${index}`, valid: true })),
    3,
  );
  assert.equal(summary.status, 'pass');
  const readiness = summarizeReadiness({ required: { status: summary.status } }, ['required']);
  assert.equal(readiness.tier, 'S');
});
