import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AgentWorkspaces } from '../lib/agent-workspaces.mjs';
import { coordinatedRetiredBytes } from '../lib/disk-scan-coordination.mjs';

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const library = new URL('../lib/agent-workspaces.mjs', import.meta.url).href;

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'fleet-scan-coordination-'));
  const root = join(base, 'state');
  const callers = [];
  t.after(async () => {
    for (const caller of callers) {
      if (caller.child.exitCode === null && caller.child.signalCode === null) caller.child.kill('SIGKILL');
      await caller.result;
    }
    await until(() => {
      let rows = [];
      try { rows = JSON.parse(readFileSync(join(root, 'disk-scans.json'), 'utf8')); } catch {}
      const pids = [...events().map((event) => event.pid), ...rows.map((row) => row.workerPid)];
      return pids.every((pid) => {
        if (!Number.isInteger(pid)) return true;
        try { process.kill(pid, 0); return false; } catch (error) { return error.code === 'ESRCH'; }
      });
    });
    rmSync(base, { recursive: true, force: true });
  });
  const manager = new AgentWorkspaces({ root });
  manager.initialize();
  for (let index = 0; index < 8; index++) {
    const tree = join(root, 'retired', `tree-${index}`);
    mkdirSync(tree); writeFileSync(join(tree, 'data'), 'initial');
  }
  const bin = join(base, 'bin'); mkdirSync(bin);
  const ledger = join(base, 'ledger');
  writeFileSync(join(bin, 'du'), `#!${process.execPath}
import { appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const path = process.argv.at(-1);
if (path.includes('/retired/tree-')) {
  const log = (event) => appendFileSync(process.env.SCAN_LEDGER, JSON.stringify({ event, pid: process.pid, path }) + '\\n');
  log('start');
  await new Promise(done => setTimeout(done, 500));
  if (existsSync(process.env.SCAN_FAILURE)) { log('end'); console.error('du: permission denied'); process.exit(1); }
  process.stdout.write(execFileSync('/usr/bin/du', process.argv.slice(2)));
  log('end');
} else process.stdout.write(execFileSync('/usr/bin/du', process.argv.slice(2)));
`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, SCAN_LEDGER: ledger, SCAN_FAILURE: join(base, 'failure') };
  const events = () => existsSync(ledger) ? readFileSync(ledger, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  function caller({ stateRoot = root, sameProcess = false } = {}) {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { AgentWorkspaces } from ${JSON.stringify(library)};
      const manager = new AgentWorkspaces({ root: ${JSON.stringify(stateRoot)} });
      const scan = () => manager.measureBudgets(${JSON.stringify(join(root, 'absent'))}, 'fixture');
      try { console.log(JSON.stringify(await ${sameProcess ? 'Promise.all([scan(), scan()])' : 'scan()'})); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
    `], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (part) => { stdout += part; }); child.stderr.on('data', (part) => { stderr += part; });
    const result = new Promise((done, fail) => {
      child.on('error', fail);
      child.on('close', (code) => done({ code, stdout, stderr }));
    });
    const caller = { child, result }; callers.push(caller); return caller;
  }
  const state = () => JSON.parse(readFileSync(join(root, 'disk-scans.json'), 'utf8'));
  return { root, manager, env, events, caller, state };
}

async function until(predicate) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'fixture reached the scanner work boundary'); await pause(20); }
}

test('overlapping separate callers traverse retired entries once; later calls measure growth afresh', async (t) => {
  const f = fixture(t);
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  const results = await Promise.all([first.result, second.result]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8, 'overlapping callers share one complete retired traversal');
  let active = 0; let peak = 0;
  for (const event of f.events()) { active += event.event === 'start' ? 1 : -1; peak = Math.max(peak, active); }
  assert.ok(peak <= 4, `one retired pool has at most four du children; observed ${peak}`);
  const before = JSON.parse(results[0].stdout).total;
  writeFileSync(join(f.root, 'retired', 'tree-0', 'growth'), Buffer.alloc(128 * 1024));
  const later = await f.caller().result;
  assert.equal(later.code, 0, later.stderr);
  assert.ok(JSON.parse(later.stdout).total > before, 'non-overlapping invocation sees newly allocated bytes');
  assert.equal(f.events().filter((event) => event.event === 'start').length, 16, 'completed totals are never reused by a later caller');
});

test('shared failures fail every captured caller and a later call performs a new measurement', async (t) => {
  const f = fixture(t);
  writeFileSync(f.env.SCAN_FAILURE, 'fail');
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  for (const result of await Promise.all([first.result, second.result])) {
    assert.equal(result.code, 1); assert.match(result.stderr, /retired-worktrees.*permission denied/);
  }
  assert.equal(f.events().filter((event) => event.event === 'start').length, 4, 'failure is shared after all four started children close');
  rmSync(f.env.SCAN_FAILURE);
  assert.equal((await f.caller().result).code, 0);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 12);
});

test('requester death leaves the bounded worker running for a surviving follower', async (t) => {
  const f = fixture(t);
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  await until(() => f.state()[0].holders.length === 2);
  first.child.kill('SIGKILL');
  await first.result;
  const result = await second.result;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8);
  assert.deepEqual(f.state(), [], 'dead holders and their completed metadata are reclaimed');
});

test('a canceled follower does not cancel shared scanning', async (t) => {
  const f = fixture(t);
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  await until(() => f.state()[0].holders.length === 2);
  second.child.kill('SIGKILL'); await second.result;
  const result = await first.result;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8);
});

test('dead workers protect surviving orphan groups before automatic fresh-generation recovery', async (t) => {
  const f = fixture(t);
  const first = f.caller();
  await until(() => f.events().filter((event) => event.event === 'start').length === 4);
  const workerPid = f.state()[0].workerPid;
  process.kill(workerPid, 'SIGKILL');
  const second = f.caller();
  await pause(200);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 4, 'no replacement pool may overlap orphan du descendants');
  for (const result of await Promise.all([first.result, second.result])) {
    assert.equal(result.code, 1); assert.match(result.stderr, /worker exited before publishing/);
  }
  const later = await f.caller().result;
  assert.equal(later.code, 0, later.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 12, 'next generation automatically measures all entries once the old group is gone');
});

test('registry work and heartbeat remain responsive while separate callers share a scan', async (t) => {
  const f = fixture(t);
  const id = 'heartbeat-fixture';
  const path = join(f.root, 'worktrees', id); mkdirSync(path);
  const old = new Date(Date.now() - 60_000).toISOString();
  f.manager.write({ schemaVersion: 1, id, repo: f.root, commonDir: f.root, path, owner: 'fixture', task: 'fixture', state: 'active', createdAt: old, heartbeatAt: old });
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller();
  await until(() => f.state()[0].holders.length === 2);
  await f.manager.heartbeat(id);
  assert.ok(Date.parse(f.manager.record(id).heartbeatAt) > Date.parse(old));
  assert.ok(f.events().filter((event) => event.event === 'end').length < 8, 'heartbeat completes before the retired traversal');
  const status = await f.manager.status({ noDisk: true });
  assert.ok(status.workspaces.some((row) => row.id === id));
  for (const result of await Promise.all([first.result, second.result])) assert.equal(result.code, 0, result.stderr);
});

test('an uncommitted worker receives no GO and exits without starting a scan', async (t) => {
  const f = fixture(t);
  const worker = spawn(process.execPath, [fileURLToPath(new URL('../lib/disk-scan-worker.mjs', import.meta.url)), f.root, randomUUID()], {
    detached: true, env: f.env, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  worker.disconnect();
  const code = await new Promise((done, fail) => { worker.once('error', fail); worker.once('exit', done); });
  assert.equal(code, 1);
  assert.deepEqual(f.events(), [], 'no durable owner and GO means no scanner work');
});

test('unsafe retired aliases and malformed ownership records fail before spawning scanner work', async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'disk-scans.json'), JSON.stringify([{ state: 'unknown' }]));
  const result = await f.caller().result;
  assert.equal(result.code, 1); assert.match(result.stderr, /Invalid retired disk scan ownership state/);
  assert.deepEqual(f.events(), []);
  await assert.rejects(coordinatedRetiredBytes(f.manager, join(f.root, 'worktrees')), /Unsafe retired directory/);
});

test('injected measurements retain per-caller behavior and latest policy validation', async (t) => {
  const f = fixture(t);
  let calls = 0;
  f.manager.measure = async () => { calls++; await pause(10); return 1; };
  const snapshots = await Promise.all([
    f.manager.measureBudgets(join(f.root, 'absent'), 'one'),
    f.manager.measureBudgets(join(f.root, 'absent'), 'two'),
  ]);
  assert.equal(calls, 4, 'both injected callers measure active and retired trees');
  assert.deepEqual(f.events(), []);
  f.manager.freeBytes = () => 1;
  for (const snapshot of snapshots) assert.throws(() => f.manager.validateBudgets(snapshot), /below the workspace reserve/);
});

test('overlapping callers in one process also share one active generation', async (t) => {
  const f = fixture(t);
  const result = await f.caller({ sameProcess: true }).result;
  assert.equal(result.code, 0, result.stderr);
  const snapshots = JSON.parse(result.stdout);
  assert.equal(snapshots[0].total, snapshots[1].total);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8);
});

test('different ancestor aliases of the same canonical state root share a generation', async (t) => {
  const f = fixture(t);
  const alias = join(dirname(f.root), 'alias');
  symlinkSync(dirname(f.root), alias);
  const first = f.caller();
  await until(() => f.events().some((event) => event.event === 'start'));
  const second = f.caller({ stateRoot: join(alias, 'state') });
  for (const result of await Promise.all([first.result, second.result])) assert.equal(result.code, 0, result.stderr);
  assert.equal(f.events().filter((event) => event.event === 'start').length, 8);
});
