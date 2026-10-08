import assert from 'node:assert/strict';
import test from 'node:test';
import { generateReport } from '../scripts/geo-observatory-record.mjs';

const config = { products: [{ id: 'example', queries: [
  { qid: 'brand', q: 'Example', kind: 'brand' },
  { qid: 'problem', q: 'Solve the problem', kind: 'problem' },
  { qid: 'old', q: 'Retired', kind: 'brand', status: 'historical' },
] }] };
const entry = { date: '2026-10-02', product: 'example', qid: 'brand', class: 'A', top: ['https://example.com'], notes: 'Owned origin appeared.' };

test('partial latest date stays visibly incomplete despite historical coverage', () => {
  const report = generateReport([entry, { ...entry, date: '2026-09-05', qid: 'problem' }], config);
  assert.match(report, /Active root\/broad union: 1\/2 queries/);
  assert.match(report, /INCOMPLETE broad run/);
  assert.match(report, /Missing: example\|problem\./);
  assert.match(report, /unmeasured, not class C/);
  assert.doesNotMatch(report, /Missing:.*example\|old/);
});

test('complete active set excludes retired queries and still warns about single-run changes', () => {
  const report = generateReport([entry, { ...entry, qid: 'problem' }], config);
  assert.match(report, /Active root\/broad union: 2\/2 queries/);
  assert.doesNotMatch(report, /INCOMPLETE broad run/);
  assert.match(report, /single-run observations, unconfirmed/);
});
