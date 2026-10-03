import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { AgentWorkspaces, GiB, inventory } from '../lib/agent-workspaces.mjs';

const fixtures = [];
test.after(() => {
  // Remove only this suite's newly created, isolated throwaway repositories.
  for (const path of fixtures) rmSync(path, { recursive: true });
});

function git(repo, ...args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'fleet-workspace-test-'));
  fixtures.push(folder);
  const repo = join(folder, 'source'); mkdirSync(repo);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'Workspace Test'); git(repo, 'config', 'user.email', 'workspace@example.test');
  writeFileSync(join(repo, 'source.txt'), 'retained source\n');
  git(repo, 'add', 'source.txt'); git(repo, 'commit', '-m', 'fixture');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  const manager = new AgentWorkspaces({ root: join(folder, 'state'), measure: () => 0, freeBytes: () => 100 * GiB, openFiles: () => 0, ...options });
  const create = (id) => manager.create({ id, repo, owner: 'test-agent', task: 'test workspace lifecycle' });
  return { folder, repo, manager, create };
}

test('linked writer shares Git objects, records ownership and preserves source on close', async () => {
  const { manager, repo, create } = fixture();
  const row = await create('writer');
  assert.equal(row.state, 'active'); assert.equal(row.owner, 'test-agent');
  assert.equal(git(row.path, 'rev-parse', '--git-common-dir'), join(realpathSync(repo), '.git'));
  assert.match(readFileSync(join(manager.root, 'AGENTS.md'), 'utf8'), /pinned frozen pnpm installs/);
  const preview = await manager.close('writer', { dryRun: true });
  assert.equal(preview.action, 'move-to-retired'); assert.ok(existsSync(row.path));
  const receipt = await manager.close('writer');
  assert.equal(readFileSync(join(receipt.retired, 'source.txt'), 'utf8'), 'retained source\n');
  assert.ok(existsSync(join(repo, 'source.txt')));
  assert.equal(manager.record('writer').state, 'closed');
  assert.equal(manager.gc().dryRun, true);
  assert.match(receipt.note, /no disk space was reclaimed/);
  git(repo, 'worktree', 'move', receipt.retired, receipt.original);
  assert.ok(existsSync(join(receipt.original, 'source.txt')));
});

test('dirty/untracked source and commits absent from remote refs prevent close', async () => {
  const { manager, create } = fixture();
  const row = await create('dirty');
  writeFileSync(join(row.path, 'new.txt'), 'do not lose me');
  await assert.rejects(manager.close('dirty'), /dirty-or-untracked/);
  assert.equal(readFileSync(join(row.path, 'new.txt'), 'utf8'), 'do not lose me');
  git(row.path, 'add', 'new.txt'); git(row.path, 'commit', '-m', 'unpublished');
  await assert.rejects(manager.close('dirty'), /head-not-in-local-remote-refs/);
  assert.ok(existsSync(row.path));
});

test('open files, changed branch and missing Git state remain explicit blockers', async () => {
  const { manager, create } = fixture({ openFiles: () => 1 });
  const row = await create('busy');
  await assert.rejects(manager.close('busy'), /open-files/);
  git(row.path, 'switch', '-c', 'different-branch');
  assert.ok(manager.inspect(manager.record('busy')).blockers.includes('branch-changed'));
});

test('traversal, temporary stores and symlink state directories are rejected', async () => {
  const { manager, create, folder } = fixture();
  await assert.rejects(create('../escape'), /workspace ID/);
  await assert.rejects(manager.configure({ storeDir: '/tmp/unshared-store' }), /temporary folder/);
  await assert.rejects(manager.configure({ maxWriters: 0 }), /Invalid policy/);
  await assert.rejects(manager.configure({ credentials: 'forbidden' }), /Unknown/);
  const target = join(folder, 'outside'); mkdirSync(target);
  const root = join(folder, 'symlink'); symlinkSync(target, root);
  await assert.rejects(new AgentWorkspaces({ root }).configure({ maxWriters: 1 }), /Unsafe/);
});

test('concurrent writers cannot exceed the configured writer limit', async () => {
  const { manager, create } = fixture();
  await manager.configure({ maxWriters: 1 });
  const results = await Promise.allSettled([create('first'), create('second')]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(manager.records().length, 1);
  assert.match(results.find((item) => item.status === 'rejected').reason.message, /limit reached/);
});

test('disk budgets and free-space reserve block work before command execution', async () => {
  const { manager, create } = fixture({ freeBytes: () => GiB });
  await assert.rejects(create('no-space'), /disk space/);
  assert.equal(manager.records().length, 0);
  const other = fixture({ measure: () => 100 * GiB });
  await assert.rejects(other.create('too-large'), /total disk budget/);
});

test('post-command disk overruns release the lease and preserve generated and source files', async () => {
  const { manager, create } = fixture({ measure: (path) => existsSync(join(path, 'generated-output.flag')) ? 9 * GiB : 0 });
  const row = await create('overrun');
  await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', "require('fs').writeFileSync('generated-output.flag', 'retained output')"] }), /disk budget/);
  assert.equal(manager.jobs().length, 0);
  assert.equal(readFileSync(join(row.path, 'generated-output.flag'), 'utf8'), 'retained output');
  assert.equal(readFileSync(join(row.path, 'source.txt'), 'utf8'), 'retained source\n');
});

test('malformed manifests fail closed instead of approving cleanup', async () => {
  const { manager, create } = fixture();
  const row = await create('unknown');
  writeFileSync(join(manager.root, 'manifests', `${row.id}.json`), JSON.stringify({ ...row, unexpectedField: true }));
  assert.throws(() => manager.gc(), /Invalid workspace manifest/);
  assert.ok(existsSync(join(row.path, 'source.txt')));
});

test('heavy jobs enforce concurrency, block close and release leases after failure', async () => {
  const { manager, create } = fixture();
  await manager.configure({ maxHeavyJobs: 1 });
  const one = await create('one'); const two = await create('two');
  const running = manager.run({ id: one.id, argv: [process.execPath, '-e', 'setTimeout(() => process.exit(7), 500)'] });
  while (manager.jobs().length === 0) await new Promise((done) => setTimeout(done, 10));
  await assert.rejects(manager.run({ id: two.id, argv: [process.execPath, '-e', 'process.exit(0)'] }), /Heavy-command limit/);
  await assert.rejects(manager.close(one.id), /command-running/);
  assert.equal((await running).exitCode, 7);
  assert.equal(manager.jobs().filter((job) => job.childPid).length, 0);
  assert.equal(manager.record(one.id).lastExitCode, 7);
  assert.ok(existsSync(two.path));
  await assert.rejects(manager.run({ id: two.id, argv: ['fleet-command-that-does-not-exist'] }), /ENOENT/);
  assert.equal(manager.jobs().length, 0);
});

test('install requires an exact pnpm pin and lockfile, and generic run cannot bypass it', async () => {
  const { manager, create } = fixture();
  const row = await create('deps');
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'npm@10.0.0' }));
  await assert.rejects(manager.install({ id: row.id }), /exact pnpm/);
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  await assert.rejects(manager.install({ id: row.id }), /pnpm lockfile/);
  await assert.rejects(manager.run({ id: row.id, argv: ['pnpm', 'install', '--store-dir', '/tmp/another-store'] }), /fleet-workspace install/);
  await assert.rejects(manager.run({ id: row.id, argv: ['corepack', 'pnpm', 'install'] }), /fleet-workspace install/);
  const shared = join(manager.root, 'shared-dependencies'); mkdirSync(shared);
  symlinkSync(shared, join(row.path, 'node_modules'));
  await assert.rejects(manager.install({ id: row.id }), /separate node_modules/);
});

test('install arguments enforce one shared store, frozen lockfile and auto imports', async () => {
  const { manager, create } = fixture();
  const row = await create('install');
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  writeFileSync(join(row.path, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  const before = readFileSync(join(row.path, 'pnpm-lock.yaml'), 'utf8');
  let observed;
  manager.run = async (options) => { observed = options; return { exitCode: 0 }; };
  await manager.install({ id: row.id, offline: true });
  assert.equal(observed.argv[0], 'corepack');
  assert.ok(observed.argv.includes('--frozen-lockfile'));
  assert.ok(observed.argv.includes('--offline'));
  assert.equal(observed.argv[observed.argv.indexOf('--store-dir') + 1], manager.policy().storeDir);
  assert.equal(observed.argv[observed.argv.indexOf('--package-import-method') + 1], 'auto');
  assert.equal(readFileSync(join(row.path, 'pnpm-lock.yaml'), 'utf8'), before);
});

test('separate CLI processes serialize creates rather than losing manifests', async () => {
  const { manager, repo } = fixture();
  await manager.configure({ maxWriters: 1, minFreeBytes: 1 });
  const cli = new URL('../scripts/fleet-workspace.mjs', import.meta.url).pathname;
  function call(id) {
    return new Promise((done) => {
      const child = spawn(process.execPath, [cli, 'create', '--root', manager.root, '--id', id, '--repo', repo, '--owner', 'test', '--task', 'concurrent CLI']);
      let stderr = ''; child.stderr.on('data', (part) => { stderr += part; });
      child.on('exit', (code) => done({ code, stderr }));
    });
  }
  const results = await Promise.all([call('process-one'), call('process-two')]);
  assert.equal(results.filter((row) => row.code === 0).length, 1, JSON.stringify(results));
  assert.equal(manager.records().length, 1);
});

test('legacy inventory is bounded, does not follow symlinks and never mutates checkouts', async () => {
  const { folder, repo } = fixture();
  mkdirSync(join(folder, 'sample-pnpm-store', 'v10'), { recursive: true });
  symlinkSync(repo, join(folder, 'do-not-follow'));
  const before = git(repo, 'status', '--porcelain');
  const report = inventory(folder);
  assert.equal(report.dryRun, true);
  assert.equal(report.entries.filter((row) => row.kind === 'independent-checkout').length, 1);
  assert.equal(report.entries.filter((row) => row.kind === 'pnpm-store').length, 1);
  assert.ok(report.entries.every((row) => row.owner === 'unknown'));
  assert.equal(git(repo, 'status', '--porcelain'), before);
  assert.ok(existsSync(repo));
});
