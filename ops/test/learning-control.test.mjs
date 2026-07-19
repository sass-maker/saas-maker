import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const command = resolve(root, 'scripts/agent-bin/learning-control');

test('start, status, and complete use durable sanitized control state', () => {
  const stateRoot = mkdtempSync(resolve(tmpdir(), 'fleet-learning-'));
  const catalog = resolve(stateRoot, 'catalog.json');
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(catalog, JSON.stringify({
    generatedAt: '2026-07-13T00:00:00.000Z',
    sources: [{ id: 'project:pace', label: 'Pace', itemCount: 2, syncStatus: 'fresh' }],
  }));
  const env = {
    ...process.env,
    FLEET_LEARNING_STATE_ROOT: stateRoot,
    FLEET_LEARNING_CATALOG: catalog,
    FLEET_LEARNING_DATE: '2026-07-13',
    FLEET_LEARNING_SESSION_ID: 'fixture-session',
    FLEET_LEARNING_URL: 'https://learning.example',
  };
  const run = (...args) => JSON.parse(execFileSync(command, args, { encoding: 'utf8', env }));

  const started = run('start', 'pace');
  assert.equal(started.url, 'https://learning.example/session/2026-07-13/fixture-session?source=project%3Apace');
  assert.equal(run('status').active[0].sessionId, 'fixture-session');
  assert.equal(run('status').catalog.fresh, 1);
  assert.equal(run('complete', 'fixture-session').status, 'completed');
  assert.equal(run('complete', 'fixture-session').status, 'completed');
  assert.equal(run('status').active.length, 0);
  assert.equal(run('status').completedCount, 1);
});
