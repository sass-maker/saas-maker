import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { maintenancePlist, installMaintenanceSchedule, maintenanceLabel } from '../lib/workspace-maintenance-schedule.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'fleet-schedule-test-'));
  t.after(() => rmSync(root, { recursive: true }));
  const calls = [];
  const options = { root, cli: '/release with spaces/fleet-workspace.mjs' };
  const dependencies = { home: root, node: '/usr/local/bin/node', platform: 'darwin', uid: 501, path: '/usr/bin:/bin',
    run: (bin, args) => { calls.push([bin, args]); return { status: 0 }; } };
  return { root, calls, options, dependencies };
}

test('schedule uses an argument array, escapes XML, and avoids shells and accumulating logs', () => {
  const plist = maintenancePlist({ node: '/node', cli: '/a&b/cli.mjs', root: '/state<private>', path: '/bin' });
  assert.ok(plist.includes('/a&amp;b/cli.mjs')); assert.ok(plist.includes('/state&lt;private&gt;'));
  assert.match(plist, /StartInterval<\/key><integer>3600/);
  assert.match(plist, /RunAtLoad<\/key><false\/>/);
  assert.equal(plist.includes('/bin/zsh'), false); assert.equal(plist.includes('.log'), false);
  assert.throws(() => maintenancePlist({ node: 'relative', cli: '/cli', root: '/root', path: '/bin' }), /absolute/);
});

test('preview writes nothing and never loads a launch agent', (t) => {
  const { root, calls, options, dependencies } = fixture(t);
  const result = installMaintenanceSchedule(options, dependencies);
  assert.equal(result.installed, false); assert.equal(calls.length, 0);
  assert.equal(existsSync(join(root, 'Library')), false);
});

test('installation validates before loading and preserves one rollback copy', (t) => {
  const { root, calls, options, dependencies } = fixture(t);
  const first = installMaintenanceSchedule({ ...options, apply: true }, dependencies);
  assert.equal(first.installed, true);
  assert.deepEqual(calls.map(([bin, args]) => [bin, args[0]]), [
    ['/usr/bin/plutil', '-lint'], ['/bin/launchctl', 'bootout'], ['/bin/launchctl', 'bootstrap'],
  ]);
  assert.equal(readFileSync(first.plistPath, 'utf8'), first.plist);
  installMaintenanceSchedule({ ...options, cli: '/next/cli.mjs', apply: true }, dependencies);
  assert.equal(readFileSync(join(root, 'maintenance-schedule.previous.plist'), 'utf8'), first.plist);
});

test('a failed replacement restores the previous schedule and reports failure', (t) => {
  const { options, dependencies } = fixture(t);
  const first = installMaintenanceSchedule({ ...options, apply: true }, dependencies);
  let attempts = 0;
  const run = (bin, args) => ({ status: args[0] === 'bootstrap' && ++attempts === 1 ? 1 : 0 });
  assert.throws(() => installMaintenanceSchedule({ ...options, cli: '/new/cli.mjs', apply: true }, { ...dependencies, run }), /did not accept/);
  assert.equal(readFileSync(first.plistPath, 'utf8'), first.plist);
  assert.equal(attempts, 2);
});

test('unknown schedule ownership and unsupported platforms fail without mutation', (t) => {
  const { root, options, dependencies, calls } = fixture(t);
  const folder = join(root, 'Library', 'LaunchAgents'); mkdirSync(folder, { recursive: true });
  const path = join(folder, maintenanceLabel + '.plist'); writeFileSync(path, 'owner-managed unknown schedule');
  assert.throws(() => installMaintenanceSchedule({ ...options, apply: true }, dependencies), /unrelated/);
  assert.equal(readFileSync(path, 'utf8'), 'owner-managed unknown schedule'); assert.equal(calls.length, 0);
  assert.throws(() => installMaintenanceSchedule(options, { ...dependencies, platform: 'linux' }), /launchd/);
});

test('a disposable CLI or symlink schedule cannot be installed', (t) => {
  const { root, options, dependencies, calls } = fixture(t);
  assert.throws(() => installMaintenanceSchedule({ ...options, cli: join(root, 'worktrees', 'writer', 'cli.mjs'), apply: true }, dependencies), /durable CLI/);
  const folder = join(root, 'Library', 'LaunchAgents'); mkdirSync(folder, { recursive: true });
  const target = join(root, 'private-file'); writeFileSync(target, 'preserved');
  symlinkSync(target, join(folder, maintenanceLabel + '.plist'));
  assert.throws(() => installMaintenanceSchedule({ ...options, apply: true }, dependencies), /non-regular/);
  assert.equal(readFileSync(target, 'utf8'), 'preserved'); assert.equal(calls.length, 0);
});
