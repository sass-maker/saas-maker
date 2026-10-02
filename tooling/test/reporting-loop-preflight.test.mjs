import assert from 'node:assert/strict';
import test from 'node:test';
import { activeGeoQueryKeys, geoCoverage } from '../scripts/reporting-loop-preflight.mjs';

const rootKeys = new Set(['product|brand', 'product|domain']);
const broadKeys = new Set(['product|brand', 'product|problem']);

test('root amendments retire legacy broad queries in the same way as the recorder', () => {
  const config = { products: [{ id: 'product', origin: 'https://example.com', queries: [
    { qid: 'old', q: 'old brand query' },
    { qid: 'problem', q: 'useful problem query' },
  ] }] };
  const contract = { roots: [{ projectId: 'product', rootDomain: 'example.com', queries: [
    { id: 'old', text: 'old brand query', status: 'historical', supersededBy: 'new' },
    { id: 'new', text: 'new exact brand query', status: 'active' },
  ] }] };
  const keys = activeGeoQueryKeys(contract, config);
  assert.deepEqual([...keys.rootKeys], ['product|new']);
  assert.deepEqual([...keys.broadKeys], ['product|problem']);
  const coverage = geoCoverage({ ...keys, seen: new Set(['product|new', 'product|problem']), monthly: true, state: 'ok' });
  assert.equal(coverage.state, 'ok');
  assert.equal(coverage.requiredExpected, 2);
});

test('monthly GEO requires the complete active union, not just branded roots', () => {
  const result = geoCoverage({ seen: rootKeys, rootKeys, broadKeys, monthly: true, state: 'ok' });
  assert.equal(result.state, 'fail');
  assert.equal(result.rootHits, 2);
  assert.equal(result.broadHits, 1);
  assert.equal(result.requiredHits, 2);
  assert.equal(result.requiredExpected, 3);
  assert.deepEqual(result.missingKeys, ['product|problem']);
});

test('weekly root coverage does not demand monthly problem queries', () => {
  const result = geoCoverage({ seen: rootKeys, rootKeys, broadKeys, monthly: false, state: 'ok' });
  assert.equal(result.state, 'ok');
  assert.equal(result.requiredExpected, 2);
  assert.deepEqual(result.missingKeys, []);
});

test('broad completion cannot substitute for missing root queries in monthly scope', () => {
  const result = geoCoverage({ seen: broadKeys, rootKeys, broadKeys, monthly: true, state: 'ok' });
  assert.equal(result.state, 'fail');
  assert.deepEqual(result.missingKeys, ['product|domain']);
});

test('complete coverage preserves stale evidence and weekly partial roots warn', () => {
  const seen = new Set([...rootKeys, ...broadKeys]);
  for (const state of ['ok', 'warn', 'fail']) {
    assert.equal(geoCoverage({ seen, rootKeys, broadKeys, monthly: true, state }).state, state);
  }
  assert.equal(geoCoverage({ seen: new Set(), rootKeys, broadKeys, monthly: false, state: 'ok' }).state, 'warn');
  assert.equal(geoCoverage({ seen: new Set(), rootKeys, broadKeys, monthly: false, state: 'fail' }).state, 'fail');
});
