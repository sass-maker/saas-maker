import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { activeGeoQueryKeys, clarityReceiptScope, geoCoverage } from '../scripts/reporting-loop-preflight.mjs';

const rootKeys = new Set(['product|brand', 'product|domain']);
const broadKeys = new Set(['product|brand', 'product|problem']);

test('CLI flushes a complete JSON report even when the preflight fails', () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('../scripts/reporting-loop-preflight.mjs', import.meta.url)),
    '--monthly', '--json', '--no-smoke',
  ], { encoding: 'utf8', timeout: 20_000 });
  assert.ok([0, 1].includes(result.status), result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.scope, 'monthly');
  assert.ok(Array.isArray(report.checks));
  assert.ok(report.checks.length > 0);
  assert.ok(['ok', 'warn', 'fail'].includes(report.verdict));
});

test('Clarity receipt coverage excludes inactive/unwired history but retains drift and gaps', () => {
  const wired = { clarityId: 'synthetic', browserSurfaces: [{ kind: 'landing' }] };
  const catalog = { projects: [
    { id: 'current', lifecycle: { status: 'active' }, systems: { clarity: wired } },
    { id: 'missing', lifecycle: { status: 'primary' }, systems: { clarity: wired } },
    { id: 'inactive', lifecycle: { status: 'inactive' }, systems: { clarity: wired } },
    { id: 'unwired', lifecycle: { status: 'active' }, systems: { clarity: { clarityId: 'synthetic' } } },
  ] };
  const keys = ['current', 'inactive', 'unwired', 'orphan'].map((id) =>
    ({ key: `evidence-refresh:clarity:${id}`, value_json: '{}' }));
  const search = { key: 'evidence-refresh:search:portfolio', value_json: '{}' };
  const result = clarityReceiptScope([...keys, search], catalog);
  assert.equal(result.eligible, 2);
  assert.deepEqual(result.excluded, ['inactive', 'unwired']);
  assert.deepEqual(result.orphaned, ['orphan']);
  assert.deepEqual(result.missing, ['missing']);
  assert.deepEqual(result.rows.map((row) => row.key), [keys[0].key, keys[3].key, search.key]);
});

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
