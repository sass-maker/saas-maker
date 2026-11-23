import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../scripts/agent-bin/fleet-notify', import.meta.url));

test('retired Telegram routes cannot send or prevent new notifications from queuing', (t) => {
  const state = mkdtempSync(join(tmpdir(), 'fleet-notify-test-'));
  t.after(() => rmSync(state, { recursive: true, force: true }));
  const config = join(state, 'config.json');
  const writeRoutes = (routes) => writeFileSync(config, JSON.stringify({
    schemaVersion: 1,
    routes,
    dedupeWindowMinutes: 60,
    retentionDays: 7,
    maxAttempts: 3,
  }));

  writeRoutes({ critical: ['openclaw-telegram', 'ntfy'] });

  const run = (...args) => spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, FLEET_NOTIFY_CONFIG: config, FLEET_NOTIFY_STATE_DIR: state },
  });
  const emit = (...args) => run('emit', '--severity', 'critical', '--source',
    'test', '--title', 'Test notification', '--no-drain', '--json', ...args);

  const rejected = emit('--channel', 'openclaw-telegram');
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /invalid channel: openclaw-telegram/);

  const accepted = emit();
  assert.equal(accepted.status, 0, accepted.stderr);
  const { id, channels } = JSON.parse(accepted.stdout);
  assert.deepEqual(channels, ['ntfy']);

  const pendingFile = join(state, 'pending', `${id}.json`);
  const event = JSON.parse(readFileSync(pendingFile, 'utf8'));
  event.channels = ['openclaw-telegram'];
  writeFileSync(pendingFile, JSON.stringify(event));

  writeRoutes({ critical: ['openclaw-telegram'] });
  const retiredOnly = emit('--title', 'Retired route notification');
  assert.equal(retiredOnly.status, 0, retiredOnly.stderr);
  const retiredEvent = JSON.parse(retiredOnly.stdout);
  assert.deepEqual(retiredEvent.channels, ['openclaw-telegram']);

  const drained = run('drain', '--json');
  assert.equal(drained.status, 0, drained.stderr);
  assert.equal(JSON.parse(drained.stdout).blocked, 2);
  const pending = JSON.parse(readFileSync(pendingFile, 'utf8'));
  assert.equal(pending.state, 'blocked');
  const newPending = JSON.parse(readFileSync(join(state, 'pending', `${retiredEvent.id}.json`), 'utf8'));
  assert.equal(newPending.state, 'blocked');
  assert.equal(pending.deliveries['openclaw-telegram'].error, 'OpenClaw Telegram has been retired');
});
