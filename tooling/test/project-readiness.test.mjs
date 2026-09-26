import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

const SCRIPT = resolve(import.meta.dirname, '../scripts/project-readiness.mjs');

test('prints usage and exits non-zero with no selector', () => {
  const result = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /--project|--repo/);
});

test('--help exits zero with usage', () => {
  const out = execFileSync('node', [SCRIPT, '--help'], { encoding: 'utf8' });
  assert.match(out, /Usage:/);
});

test('--repo on a missing checkout reports repo.exists failure as json', () => {
  const out = execFileSync('node', [
    SCRIPT, '--repo', 'definitely-not-a-fleet-repo', '--format', 'json',
  ], { encoding: 'utf8' });
  const report = JSON.parse(out);
  assert.equal(report.repo, 'definitely-not-a-fleet-repo');
  const repoCheck = report.results.find((r) => r.id === 'repo.exists');
  assert.equal(repoCheck.status, 'fail');
  assert.ok(report.counts.fail >= 1);
});

test('markdown output ends with a next-actions section', () => {
  const out = execFileSync('node', [SCRIPT, '--repo', 'definitely-not-a-fleet-repo'], { encoding: 'utf8' });
  assert.match(out, /# Readiness: definitely-not-a-fleet-repo/);
  assert.match(out, /## next actions/);
});
