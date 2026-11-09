import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { relevant, projects, worktrees, enqueue, complete, start, fingerprint, mcpOverrides, affectedProducts, videoFingerprint, setRecoveryState, recordVerification, status, planningReadOverrides, queueRetirement, retireEligibleJobs, selectReady } from '../launchkit/scripts/asset-watch.mjs';

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

test('new edits preserve recovery identity and unresolved verification', () => {
  const state = { pending: {} }; enqueue(state, 'a', 1);
  setRecoveryState(state, { a: 1 }, '/private/recovery/batch', { status: 'verification_pending' });
  enqueue(state, 'a', 2, '/new/source');
  assert.equal(state.pending.a.recovery, '/private/recovery/batch');
  assert.equal(status(state)[0].status, 'verification_pending');
  for (let i = 0; i < 5; i++) recordVerification(state, { a: 2 }, '/private/recovery/batch', false, 100 + i);
  assert.equal(status(state)[0].status, 'needs_recovery');
  assert.match(status(state)[0].reason, /five attempts/);
  enqueue(state, 'a', 200);
  assert.equal(status(state)[0].status, 'needs_recovery');
});

test('planner has no Drive fetch tool', () => {
  assert.ok(planningReadOverrides.some((entry) => entry.includes('tools.get_file_metadata')));
  assert.ok(planningReadOverrides.every((entry) => !entry.includes('tools.fetch')));
});

test('retirement moves only eligible, unreferenced scratch and preserves all other state', () => {
  const { root } = fixture(); const workerDir = join(root, 'worker'); const trashed = join(root, 'trashed'); mkdirSync(workerDir); mkdirSync(trashed);
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'];
  for (const id of ids) { mkdirSync(join(workerDir, id)); writeFileSync(join(workerDir, id, 'evidence'), id); }
  const state = { pending: { a: { planningJob: ids[1] } }, inflight: { jobId: ids[2] }, batchJobs: { recovery: { jobId: ids[3] } } };
  for (const id of ids) queueRetirement(state, id);
  let saves = 0;
  retireEligibleJobs({ state, workerDir, persist: () => saves++, trash: (path) => renameSync(path, join(trashed, path.split('/').at(-1))) });
  assert.equal(existsSync(join(workerDir, ids[0])), false); assert.equal(readFileSync(join(trashed, ids[0], 'evidence'), 'utf8'), ids[0]);
  for (const id of ids.slice(1)) assert.equal(existsSync(join(workerDir, id)), true);
  assert.equal(state.retiredScratchCount, 1); assert.equal(saves, 1);
});

test('retirement preserves and surfaces failed, interrupted and unsafe cleanup', () => {
  const { root } = fixture(); const workerDir = join(root, 'worker'); const elsewhere = join(root, 'elsewhere'); mkdirSync(workerDir); mkdirSync(elsewhere);
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
  mkdirSync(join(workerDir, ids[0])); mkdirSync(join(workerDir, ids[1])); symlinkSync(elsewhere, join(workerDir, ids[2]));
  const state = { pending: {} }; for (const id of ids) queueRetirement(state, id);
  retireEligibleJobs({ state, workerDir, persist: () => {}, trash: (path) => { if (path.endsWith(ids[0])) throw Error('denied'); renameSync(path, join(elsewhere, ids[1])); throw Error('outcome uncertain'); } });
  assert.equal(state.retirements[ids[0]].status, 'failed');
  assert.equal(state.retirements[ids[1]].status, 'unknown');
  assert.equal(state.retirements[ids[2]].status, 'failed');
  assert.equal(existsSync(join(workerDir, ids[0])), true); assert.equal(existsSync(join(elsewhere, ids[1])), true); assert.equal(existsSync(join(workerDir, ids[2])), true);
  assert.deepEqual(status(state).map((item) => item.status).sort(), ['cleanup_failed', 'cleanup_failed', 'cleanup_unknown']);
});

test('a missing previously eligible job is reported unknown rather than assumed trashed', () => {
  const { root } = fixture(); const workerDir = join(root, 'worker'); mkdirSync(workerDir);
  const id = '11111111-1111-4111-8111-111111111111'; const state = { pending: {} }; queueRetirement(state, id);
  let called = false; retireEligibleJobs({ state, workerDir, persist: () => {}, trash: () => { called = true; } });
  assert.equal(called, false); assert.equal(state.retirements[id].status, 'unknown');
});

test('a state persistence failure after moving scratch never records confirmed retirement', () => {
  const { root } = fixture(); const workerDir = join(root, 'worker'); const trashed = join(root, 'trashed'); mkdirSync(workerDir); mkdirSync(trashed);
  const id = '11111111-1111-4111-8111-111111111111'; mkdirSync(join(workerDir, id));
  const state = { pending: {} }; queueRetirement(state, id);
  assert.throws(() => retireEligibleJobs({ state, workerDir, persist: () => { throw Error('disk full'); }, trash: (path) => renameSync(path, join(trashed, id)) }), /disk full/);
  assert.equal(state.retirements[id].status, 'unknown'); assert.equal(state.retiredScratchCount, 0);
  assert.equal(existsSync(join(trashed, id)), true);
});

test('verification selects every product sharing a batch even when a later edit resets debounce', () => {
  const common = { generation: 1, retryAt: 0, firstAt: 1, verificationPending: true, recovery: '/batch' };
  const state = { pending: { a: { ...common, changedAt: 1 }, b: { ...common, generation: 2, changedAt: 999 } } };
  assert.deepEqual(selectReady(state, 1000, 100, 10000).selected, { a: 1, b: 2 });
  state.pending.b.needsRecovery = 'partial';
  assert.deepEqual(selectReady(state, 1000, 100, 10000).selected, {});
});

test('successful multi-product verification retires planning and verifier scratch, preserving recovery', async () => {
  const { root, indexPath, stateDir } = fixture();
  const other = join(root, 'other'); mkdirSync(other); execFileSync('git', ['init', '-q', other]);
  execFileSync('git', ['-C', other, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'base']);
  const catalogPath = join(root, 'site-health/catalog/projects.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')); catalog.projects.push({ id: 'other', lifecycle: { portfolioStatus: 'active' }, repositories: { localPath: 'other' } }); writeFileSync(catalogPath, JSON.stringify(catalog));
  const plannerId = '11111111-1111-4111-8111-111111111111';
  const workerDir = join(stateDir, 'worker'); const plannerDir = join(workerDir, plannerId); mkdirSync(plannerDir, { recursive: true }); writeFileSync(join(plannerDir, 'proposal.json'), '{}');
  const recovery = join(stateDir, 'recovery', '22222222-2222-4222-8222-222222222222'); mkdirSync(recovery, { recursive: true }); writeFileSync(join(recovery, 'manifest.json'), '{"changes":[]}');
  const entry = { generation: 1, changedAt: 1, firstAt: 1, failures: 0, retryAt: 0, sources: [], verificationPending: true, recovery };
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify({ pending: { example: entry, other: entry }, checkpoints: {}, batchJobs: { [recovery]: { jobId: plannerId, products: ['example', 'other'] } } }));
  const trashed = join(root, 'trashed'); mkdirSync(trashed);
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: '/unused', debounceMs: 0, tickMs: 20, records: () => [], overrides: () => [], driveReady: () => true, classify: () => ({ status: 'verification_pending' }), verifyRemote: () => ({ child: {}, promise: Promise.resolve(true) }), trash: (path) => renameSync(path, join(trashed, path.split('/').at(-1))), requireLock: false });
  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
      if (state.retiredScratchCount === 2) { assert.deepEqual(state.pending, {}); assert.equal(existsSync(recovery), true); assert.equal(existsSync(join(trashed, plannerId)), true); return; }
      await delay(50);
    }
    assert.fail('verified batch scratch was not retired');
  } finally { stop(); }
});

test('executable requires a locally configured asset index', () => {
  const script = join(import.meta.dirname, '../launchkit/scripts/asset-watch.mjs');
  const env = { ...process.env }; delete env.FLEET_ASSET_INDEX;
  assert.throws(() => execFileSync(process.execPath, [script], { env, stdio: 'pipe' }), (error) => error.status === 1 && error.stderr.toString().includes('FLEET_ASSET_INDEX must be an absolute path'));
});

test('disables each configured MCP using its observed transport and rejects unknown transports', () => {
  const root = mkdtempSync(join(tmpdir(), 'asset-watch-mcp-'));
  const cli = join(root, 'codex');
  writeFileSync(cli, '#!/bin/sh\nprintf \'Name  Command  Status\\na  cmd  enabled\\n\\nName  Url  Status\\nb  https://example.invalid  enabled\\n\'\n', { mode: 0o700 });
  assert.deepEqual(mcpOverrides(cli), ['-c', 'mcp_servers.a={command="/usr/bin/false",enabled=false}', '-c', 'mcp_servers.b={url="https://example.invalid/mcp",enabled=false}']);
  writeFileSync(cli, '#!/bin/sh\nprintf \'No MCP servers configured.\\n\'\n');
  assert.deepEqual(mcpOverrides(cli), []);
  writeFileSync(cli, '#!/bin/sh\nprintf \'unknown format\\n\'\n');
  assert.throws(() => mcpOverrides(cli), /Cannot safely disable/);
});

test('a real source edit queues and invokes the worker', async () => {
  const { root, project, indexPath, stateDir } = fixture();
  const worker = join(root, 'fake-codex');
  const calls = join(root, 'calls');
  writeFileSync(worker, `#!/bin/sh\necho run >> '${calls}'\nwhile [ "$1" != "-C" ]; do shift; done\ncd "$2"\nprintf \'{"version":1,"changes":[]}\' > proposal.json\n`, { mode: 0o700 });
  const trashed = join(root, 'trashed'); mkdirSync(trashed);
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: worker, debounceMs: 100, tickMs: 50, records: () => [], overrides: () => [], driveReady: () => true, apply: () => ({ status: 'no_changes' }), trash: (path) => renameSync(path, join(trashed, path.split('/').at(-1))), requireLock: false });
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

test('restart before a recovery manifest is created is safely replannable', () => {
  const { root, indexPath, stateDir } = fixture(); mkdirSync(stateDir);
  const recoveryId = '11111111-1111-4111-8111-111111111111';
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify({ pending: { example: { generation: 1, changedAt: Date.now(), failures: 0, retryAt: 0, sources: [] } }, checkpoints: {}, inflight: { phase: 'applying', selected: { example: 1 }, recoveryId } }));
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: '/usr/bin/false', debounceMs: 100000, records: () => [], overrides: () => [], requireLock: false }); stop();
  const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
  assert.equal(state.pending.example.verificationPending, false);
  assert.equal(state.pending.example.needsRecovery, null);
  assert.equal(state.inflight, null);
});

test('restart with a partial prepared batch surfaces needs-recovery and preserves backup', () => {
  const { root, indexPath, stateDir } = fixture(); mkdirSync(stateDir);
  const recoveryId = '11111111-1111-4111-8111-111111111111';
  writeFileSync(join(stateDir, 'state.json'), JSON.stringify({ pending: { example: { generation: 1, changedAt: Date.now(), failures: 0, retryAt: 0, sources: [] } }, checkpoints: {}, inflight: { phase: 'applying', selected: { example: 1 }, recoveryId } }));
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: '/usr/bin/false', debounceMs: 100000, records: () => [], overrides: () => [], classify: () => ({ status: 'needs_recovery', reason: 'partial write' }), requireLock: false }); stop();
  const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8'));
  assert.equal(status(state)[0].status, 'needs_recovery');
  assert.equal(state.pending.example.recovery, join(stateDir, 'recovery', recoveryId));
  assert.equal(state.inflight, null);
});

test('scratch limit leaves work pending without starting a worker', async () => {
  const { root, indexPath, stateDir } = fixture(); const scratch = join(stateDir, 'worker'); mkdirSync(scratch, { recursive: true });
  for (let i = 0; i < 50; i++) mkdirSync(join(scratch, String(i)));
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: '/no/worker', debounceMs: 0, tickMs: 20, records: () => [], overrides: () => [], driveReady: () => true, requireLock: false });
  try { await delay(100); const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8')); assert.ok(state.pending.example.failures); assert.equal(status(state)[0].status, 'needs_recovery'); } finally { stop(); }
});

test('planner spawn failure remains pending and does not leave a polling loop', async () => {
  const { root, indexPath, stateDir } = fixture();
  const stop = start({ fleetRoot: root, indexPath, stateDir, codexPath: '/no/such/worker', debounceMs: 0, tickMs: 20, records: () => [], overrides: () => [], driveReady: () => true, requireLock: false });
  try { await delay(150); const state = JSON.parse(readFileSync(join(stateDir, 'state.json'), 'utf8')); assert.ok(state.pending.example.failures); assert.equal(state.inflight, null); } finally { stop(); }
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
