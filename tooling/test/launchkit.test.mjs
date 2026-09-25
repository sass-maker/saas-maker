import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const PLANNER = resolve(import.meta.dirname, '../launchkit/scripts/plan-run.mjs');
const REPORT = resolve(import.meta.dirname, '../launchkit/scripts/report.mjs');
const LAUNCHKIT = resolve(import.meta.dirname, '../launchkit');

function plan(args) {
  const out = execFileSync('node', [PLANNER, ...args, '--json'], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('planner emits at most N routes and keeps a truthful smaller target', () => {
  const p = plan(['--n', '10', '--category', 'definitely-not-a-real-category']);
  assert.equal(p.target, 0);
  assert.equal(p.routes.length, 0);
  assert.match(p.truthful, /target kept smaller/);
});

test('planner defaults to researched free/conditional routes, sorted by quality', () => {
  const p = plan(['--n', '5']);
  assert.ok(p.target > 0 && p.target <= 5);
  const ranks = p.routes.map((r) => ({ free: 2, conditional: 1 }[r.zeroCostRoute] ?? 0));
  for (let i = 1; i < ranks.length; i++) assert.ok(ranks[i - 1] >= ranks[i]);
  assert.ok(p.routes.every((r) => ['free', 'conditional'].includes(r.zeroCostRoute)));
  assert.ok(p.routes.every((r) => r.playbook.includes('launchdesk-playbooks')));
});

test('planner never pads with paid/unknown unless asked', () => {
  const p = plan(['--n', '500']);
  assert.ok(p.routes.every((r) => ['free', 'conditional'].includes(r.zeroCostRoute)));
  const withPaid = plan(['--n', '500', '--include-paid', '--include-unknown']);
  assert.ok(withPaid.target >= p.target);
});

test('--domain restricts to named destinations only', () => {
  const p = plan(['--domain', 'producthunt.com,saashub.com', '--n', '10']);
  assert.deepEqual(
    p.routes.map((r) => r.domain).sort(),
    ['producthunt.com', 'saashub.com']
  );
});

test('tracker template and schema agree on required fields', () => {
  const schema = JSON.parse(readFileSync(join(LAUNCHKIT, 'tracker.schema.json'), 'utf8'));
  const template = JSON.parse(readFileSync(join(LAUNCHKIT, 'tracker.template.json'), 'utf8'));
  for (const key of schema.required) assert.ok(key in template, `template missing ${key}`);
});

test('report summarizes states and flags evidence-free submitted entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'launchkit-'));
  const file = join(dir, 'tracker.json');
  writeFileSync(file, JSON.stringify({
    $schema: 'fleet.launchkit-tracker.v1',
    version: 1,
    product: { name: 'Test', url: 'https://example.com' },
    entries: [
      { domain: 'a.com', state: 'live', evidence: 'https://dir.example/a', updated: '2026-09-25T00:00:00Z', attempts: 1 },
      { domain: 'b.com', state: 'submitted', evidence: null, updated: '2026-09-25T00:00:00Z', attempts: 1 },
    ],
  }));
  const out = execFileSync('node', [REPORT, '--tracker', file], { encoding: 'utf8' });
  assert.match(out, /submitted\s+1/);
  assert.match(out, /b\.com — submitted with no evidence/);
  rmSync(dir, { recursive: true, force: true });
});
