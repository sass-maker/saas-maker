import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { relevant, projects, worktrees, enqueue, complete, start, fingerprint, mcpOverrides, affectedProducts, videoFingerprint } from '../launchkit/scripts/asset-watch.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'asset-watch-test-'));
  const project = join(root, 'project');
  mkdirSync(project); mkdirSync(join(root, 'site-health/catalog'), { recursive: true });
  execFileSync('git', ['init', '-q', project]);
  execFileSync('git', ['-C', project, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'base']);
  writeFileSync(join(root, 'site-health/catalog/projects.json'), JSON.stringify({ projects: [
    { id: 'example', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'project' } },
  ] }));
  return { root, project, stateDir: join(root, 'state'), indexPath: join(root, 'unavailable-index.json') };
}

test('ignores generated files and secrets while observing source edits', () => {
  assert.equal(relevant('src/logo.svg'), true);
  for (const path of ['node_modules/a.js', '.git/index', 'src/.env.production', 'secret.key', 'wrangler.toml', '../secret', '/tmp/a', '']) assert.equal(relevant(path), false);
});

test('finds active projects including newly catalogued products and their worktrees', () => {
  const catalog = { projects: [
    { id: 'new', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'new' } },
    { id: 'old', lifecycle: { portfolioStatus: 'archived' }, repositories: { localPath: 'old' } },
  ] };
  assert.deepEqual(projects(catalog, { products: [] }, '/fleet'), [{ id: 'new', path: '/fleet/new' }]);
  assert.deepEqual(worktrees('/fleet/new', () => 'worktree /fleet/new\nHEAD abc\n\nworktree /elsewhere/writer\nHEAD def\n'), ['/fleet/new', '/elsewhere/writer']);
});

test('preserves newer changes when a prior run completes and backs off failed work', () => {
  const state = { pending: {} };
  enqueue(state, 'a', 1);
  const selected = { a: state.pending.a.generation };
  enqueue(state, 'a', 2);
  complete(state, selected, true, 3);
  assert.equal(state.pending.a.generation, 2);
  complete(state, selected, false, 100);
  assert.equal(state.pending.a.retryAt, 60100);
  assert.equal(state.pending.a.uncertain, true);
  complete(state, { a: 2 }, true, 60101);
  assert.deepEqual(state.pending, {});
});

test('disables each configured MCP using its observed transport and rejects unknown transports', () => {
  const root = mkdtempSync(join(tmpdir(), 'asset-watch-mcp-'));
  const cli = join(root, 'codex');
  writeFileSync(cli, '#!/bin/sh\nprintf \'Name  Command  Status\\na  cmd  enabled\\n\\nName  Url  Status\\nb  https://example.invalid  enabled\\n\'\n', { mode: 0o700 });
  assert.deepEqual(mcpOverrides(cli), ['-c', 'mcp_servers.a={command="/usr/bin/false",enabled=false}', '-c', 'mcp_servers.b={url="https://example.invalid/mcp",enabled=false}']);
  writeFileSync(cli, '#!/bin/sh\nprintf \'unknown format\\n\'\n');
  assert.throws(() => mcpOverrides(cli), /Cannot safely disable/);
});

test('a real source edit queues and invokes the worker', async () => {
  const { root, project, indexPath, stateDir } = fixture();
  const worker = join(root, 'fake-codex');
  const calls = join(root, 'calls');
  writeFileSync(worker, `#!/bin/sh\necho run >> '${calls}'\nwhile [ "$1" != "-C" ]; do shift; done\ncd "$2"\nprintf \'{"version":1,"changes":[]}\' > proposal.json\n`, { mode: 0o700 });
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 100, tickMs: 50, records: () => [], overrides: () => [], driveReady: () => true, apply: () => ({ status: 'no_changes' }), requireLock: false });
  try {
    const firstDeadline = Date.now() + 5000;
    while ((!existsSync(calls) || JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8')).pending.example) && Date.now() < firstDeadline) await delay(50);
    assert.ok(existsSync(calls), 'initial reconciliation ran');
    writeFileSync(join(project, 'logo.svg'), '<svg/>');
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (existsSync(calls) && readFileSync(calls, 'utf8').trim().split('\n').length >= 2) {
        const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
        if (!state.pending.example) return;
      }
      await delay(50);
    }
    assert.fail('the queued change was not completed');
  } finally { stop(); }
});

test('maps shared product asset changes and discovers changed local video bytes', () => {
  const ids = new Set(['site-health', 'saas-maker', 'product']);
  assert.deepEqual(affectedProducts('site-health', 'catalog/projects.json', ids), [...ids]);
  assert.deepEqual(affectedProducts('saas-maker', 'apps/showcase/public/product-assets/product/logo.png', ids), ['product']);
  const folder = mkdtempSync(join(tmpdir(), 'asset-videos-'));
  writeFileSync(join(folder, 'launch.mp4'), 'first');
  const previous = videoFingerprint(folder);
  writeFileSync(join(folder, 'launch.mp4'), 'second version');
  assert.notEqual(videoFingerprint(folder), previous);
});

test('restart detects a second edit to an already dirty tracked file', () => {
  const { root, project, indexPath, stateDir } = fixture();
  const file = join(project, 'logo.svg'); writeFileSync(file, 'original');
  execFileSync('git', ['-C', project, 'add', 'logo.svg']);
  execFileSync('git', ['-C', project, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'logo']);
  writeFileSync(file, 'dirty version one');
  const opts = { fleetRoot: root, indexPath, stateDir, codexPath: '/usr/bin/false', debounceMs: 100000, records: () => [], overrides: () => [], requireLock: false };
  const stop = start(opts); stop();
  const prior = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8')).pending.example.generation;
  const before = fingerprint(project);
  writeFileSync(file, 'dirty version two');
  assert.notEqual(fingerprint(project), before);
  const resumed = start(opts); resumed();
  const after = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8')).pending.example.generation;
  assert.ok(after > prior, 'offline edit is queued again');
});

test('timeout preserves the failed generation for retry', async () => {
  const { root, indexPath, stateDir } = fixture();
  const worker = join(root, 'hang'); writeFileSync(worker, '#!/bin/sh\nsleep 10\n', { mode: 0o700 });
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 0, tickMs: 30, workerTimeoutMs: 100, records: () => [], overrides: () => [], driveReady: () => true, requireLock: false });
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
      if (state.pending.example?.failures) { assert.ok(state.pending.example.retryAt > Date.now()); return; }
      await delay(50);
    }
    assert.fail('timed out worker did not remain queued');
  } finally { stop(); }
});

test('unavailable Drive is detected after changes are queued and before invoking worker', async () => {
  const { root, indexPath, stateDir } = fixture();
  const worker = join(root, 'never-run');
  writeFileSync(worker, `#!/bin/sh\ntouch '${join(root, 'invoked')}'\n`, { mode: 0o700 });
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 0, tickMs: 20, records: () => [], overrides: () => [], driveReady: () => false, requireLock: false });
  try {
    await delay(100);
    const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
    assert.equal(existsSync(join(root, 'invoked')), false);
    assert.equal(state.pending.example.failures, 1);
    assert.equal(state.pending.example.uncertain, true);
  } finally { stop(); }
});

test('prose SUCCESS without a structured proposal never clears the queue', async () => {
  const { root, indexPath, stateDir } = fixture();
  const worker = join(root, 'prose-only'); writeFileSync(worker, '#!/bin/sh\nwhile [ "$1" != "-o" ]; do shift; done\nprintf "SUCCESS\\n" > "$2"\n', { mode: 0o700 });
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 0, tickMs: 20, records: () => [], overrides: () => [], driveReady: () => true, requireLock: false });
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
      if (state.pending.example?.failures) return;
      await delay(50);
    }
    assert.fail('prose-only success was not retained as pending');
  } finally { stop(); }
});

test('worker timeout kills a TERM-resistant group before retry can begin', async () => {
  const { root, indexPath, stateDir } = fixture();
  const worker = join(root, 'resistant'); writeFileSync(worker, `#!${process.execPath}\nprocess.on('SIGTERM', () => {}); setInterval(() => {}, 1000);\n`, { mode: 0o700 });
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 0, tickMs: 30, workerTimeoutMs: 500, records: () => [], overrides: () => [], driveReady: () => true, requireLock: false });
  try {
    await delay(800);
    const during = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
    assert.ok(during.inflight, 'waits for the stubborn process group');
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
      if (!state.inflight && state.pending.example?.failures) return;
      await delay(100);
    }
    assert.fail('the process group did not exit after SIGKILL');
  } finally { stop(); }
});

test('supervisor lock remains held by an inherited child', async () => {
  const { root, stateDir } = fixture();
  const supervisor = join(import.meta.dirname, '../launchkit/scripts/asset-watch-supervisor.py');
  const worker = join(root, 'holder.mjs');
  writeFileSync(worker, `import {spawn} from 'node:child_process'; const fd=Number(process.env.FLEET_ASSET_LOCK_FD); const stdio=['ignore','ignore','ignore']; while(stdio.length<fd) stdio.push('ignore'); stdio[fd]=fd; const child=spawn(process.execPath,['-e','setTimeout(()=>{},2000)'],{stdio,detached:true}); child.unref();`);
  const first = spawn('/usr/bin/python3', [supervisor, stateDir, process.execPath, worker], { stdio: 'ignore' });
  await new Promise((resolve) => first.on('exit', resolve));
  let blocked = false;
  try { execFileSync('/usr/bin/python3', [supervisor, stateDir, '/usr/bin/true'], { stdio: 'ignore' }); } catch { blocked = true; }
  assert.equal(blocked, true, 'a surviving child retains the lock');
  await delay(2300);
  execFileSync('/usr/bin/python3', [supervisor, stateDir, '/usr/bin/true'], { stdio: 'ignore' });
});
