import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, realpathSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { AgentWorkspaces, GiB, inventory, diskBytesAsync, jobAlive, StaleWorkspaceSnapshotError } from '../lib/agent-workspaces.mjs';

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
  await assert.rejects(manager.install({ id: row.id }), /valid existing npm package-lock/);
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  await assert.rejects(manager.install({ id: row.id }), /pnpm lockfile/);
  await assert.rejects(manager.run({ id: row.id, argv: ['pnpm', 'install', '--store-dir', '/tmp/another-store'] }), /fleet-workspace install/);
  await assert.rejects(manager.run({ id: row.id, argv: ['corepack', 'pnpm', 'install'] }), /fleet-workspace install/);
  await assert.rejects(manager.run({ id: row.id, argv: ['npm', 'ci'] }), /fleet-workspace install/);
  await assert.rejects(manager.run({ id: row.id, argv: ['corepack', 'npm', 'ci'] }), /fleet-workspace install/);
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

test('lockfile-only generation uses pinned Corepack, shared defaults and no scripts', async () => {
  const { manager, create } = fixture();
  const row = await create('lockfile-only');
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  writeFileSync(join(row.path, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  const before = readFileSync(join(row.path, 'pnpm-lock.yaml'), 'utf8');
  const policy = manager.policy.bind(manager);
  const storeDir = join(row.path, '.test-shared-store');
  manager.policy = () => ({ ...policy(), storeDir });
  let observed;
  manager.run = async (options) => { observed = options; return { exitCode: 0 }; };

  await manager.lockfileOnly({ id: row.id });

  assert.deepEqual(observed, {
    id: row.id,
    repo: realpathSync(row.path),
    argv: ['corepack', 'pnpm', 'install', '--lockfile-only', '--ignore-scripts', '--store-dir', storeDir, '--package-import-method', 'auto'],
    installing: true,
  });
  assert.equal(readFileSync(join(row.path, 'pnpm-lock.yaml'), 'utf8'), before);
  assert.equal(existsSync(join(row.path, 'node_modules')), false);
});

test('lockfile-only generation fails closed for invalid pins and missing lockfiles', async () => {
  const { manager, create } = fixture();
  const row = await create('lockfile-invalid');
  writeFileSync(join(row.path, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  let launches = 0;
  manager.run = async () => { launches++; return { exitCode: 0 }; };

  for (const packageManager of [undefined, 'pnpm', 'pnpm@next', 'pnpm@^10.33.2', 'npm@10.0.0']) {
    writeFileSync(join(row.path, 'package.json'), JSON.stringify(packageManager === undefined ? {} : { packageManager }));
    await assert.rejects(manager.lockfileOnly({ id: row.id }), /exact pnpm packageManager pin/);
  }
  assert.equal(launches, 0);

  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  rmSync(join(row.path, 'pnpm-lock.yaml'));
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /existing regular pnpm-lock.yaml/);
  assert.equal(existsSync(join(row.path, 'pnpm-lock.yaml')), false);
  assert.equal(launches, 0);
});

test('lockfile-only generation rejects linked metadata and node_modules layouts before launch', async () => {
  const { manager, create, folder } = fixture();
  const row = await create('lockfile-links');
  const outside = join(folder, 'outside'); mkdirSync(outside);
  const packagePath = join(row.path, 'package.json');
  const lockPath = join(row.path, 'pnpm-lock.yaml');
  const outsidePackage = join(outside, 'package.json');
  const outsideLock = join(outside, 'pnpm-lock.yaml');
  const packageBytes = JSON.stringify({ packageManager: 'pnpm@10.33.2' });
  const lockBytes = 'lockfileVersion: 9.0\n';
  writeFileSync(outsidePackage, packageBytes);
  writeFileSync(outsideLock, lockBytes);
  let launches = 0;
  manager.run = async () => { launches++; return { exitCode: 0 }; };

  writeFileSync(packagePath, packageBytes); writeFileSync(lockPath, lockBytes);
  rmSync(packagePath); symlinkSync(outsidePackage, packagePath);
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /regular package.json/);
  assert.equal(readFileSync(outsidePackage, 'utf8'), packageBytes);

  rmSync(packagePath); writeFileSync(packagePath, packageBytes);
  rmSync(lockPath); symlinkSync(outsideLock, lockPath);
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /regular pnpm-lock.yaml/);
  assert.equal(readFileSync(outsideLock, 'utf8'), lockBytes);

  rmSync(lockPath); mkdirSync(lockPath);
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /regular pnpm-lock.yaml/);
  rmSync(lockPath, { recursive: true }); writeFileSync(lockPath, lockBytes);

  const nodeModules = join(row.path, 'node_modules');
  symlinkSync(outside, nodeModules, 'dir');
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /separate node_modules/);
  rmSync(nodeModules);
  symlinkSync(join(outside, 'missing-target'), nodeModules, 'dir');
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /separate node_modules/);
  rmSync(nodeModules);
  mkdirSync(nodeModules); symlinkSync(outside, join(nodeModules, '.pnpm'), 'dir');
  await assert.rejects(manager.lockfileOnly({ id: row.id }), /separate node_modules/);
  assert.equal(readFileSync(outsidePackage, 'utf8'), packageBytes);
  assert.equal(readFileSync(outsideLock, 'utf8'), lockBytes);
  assert.equal(launches, 0);
});

function npmFixture(row, packageManager) {
  const manifest = { name: 'locked-npm-fixture', version: '1.0.0', ...(packageManager ? { packageManager } : {}) };
  writeFileSync(join(row.path, 'package.json'), JSON.stringify(manifest));
  writeFileSync(join(row.path, 'package-lock.json'), JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, packages: { '': { name: manifest.name, version: manifest.version } } }));
}

test('native npm install preserves current lock and chooses npm over an undeclared stale pnpm lock', async () => {
  const { manager, create } = fixture();
  const row = await create('npm-native');
  npmFixture(row);
  writeFileSync(join(row.path, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0\n# retained stale historical lock\n');
  const locks = ['package.json', 'package-lock.json', 'pnpm-lock.yaml'].map((name) => [name, readFileSync(join(row.path, name), 'utf8')]);
  let observed;
  manager.run = async (options) => { observed = options; return { exitCode: 0 }; };
  await manager.install({ id: row.id, offline: true });
  assert.deepEqual(observed.argv, ['npm', 'ci', '--cache', join(homedir(), '.npm'), '--offline']);
  assert.equal(observed.installing, true);
  assert.equal(observed.id, row.id);
  for (const [name, contents] of locks) assert.equal(readFileSync(join(row.path, name), 'utf8'), contents);
});

test('explicit npm pin must match the installed version before launching npm ci', async () => {
  const { manager, create } = fixture();
  const row = await create('npm-version-pin');
  npmFixture(row, 'npm@0.0.0');
  let launches = 0;
  let observed;
  manager.run = async (options) => { launches++; observed = options; return { exitCode: 0 }; };
  await assert.rejects(manager.install({ id: row.id }), /does not match packageManager pin 0\.0\.0/);
  assert.equal(launches, 0);

  const version = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  const installedVersion = version.stdout.trim();
  assert.match(installedVersion, /^\d+\.\d+\.\d+$/);
  npmFixture(row, `npm@${installedVersion}`);
  await manager.install({ id: row.id });
  assert.equal(launches, 1);
  assert.deepEqual(observed.argv, ['npm', 'ci', '--cache', join(homedir(), '.npm')]);
});

test('native npm rejects integrity-suffixed pins before launching npm ci', async () => {
  const { manager, create } = fixture();
  const row = await create('npm-integrity-pin');
  const version = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, version.stderr);
  npmFixture(row, `npm@${version.stdout.trim()}+sha512.abcdef`);
  let launches = 0;
  manager.run = async () => { launches++; return { exitCode: 0 }; };
  await assert.rejects(manager.install({ id: row.id }), /Unsupported packageManager/);
  assert.equal(launches, 0);
});

test('native npm never substitutes for explicit pnpm or unknown managers and rejects malformed locks', async () => {
  const { manager, create } = fixture();
  const row = await create('npm-contract');
  manager.run = async () => { throw new Error('unexpected installer launch'); };
  for (const managerName of ['yarn@4.0.0', 'bun@1.0.0', 'npm@latest', 'pnpm@latest', 'pnpm@10.33.2']) {
    npmFixture(row, managerName);
    await assert.rejects(manager.install({ id: row.id }), /Unsupported packageManager|exact pnpm|pnpm lockfile/);
  }
  npmFixture(row);
  for (const lock of ['not-json', 'null', '[]', '{"lockfileVersion":4,"packages":{"":{}}}', '{"lockfileVersion":3,"packages":{}}', '{"lockfileVersion":1}']) {
    writeFileSync(join(row.path, 'package-lock.json'), lock);
    await assert.rejects(manager.install({ id: row.id }), /valid existing npm package-lock/);
    assert.equal(readFileSync(join(row.path, 'package-lock.json'), 'utf8'), lock);
  }
});

test('native npm installation retains reserve and per-checkout/total disk gates before launch', async () => {
  const { manager, create } = fixture();
  const row = await create('npm-budget'); npmFixture(row);
  manager.freeBytes = () => GiB;
  await assert.rejects(manager.install({ id: row.id }), /workspace reserve/);
  manager.freeBytes = () => 100 * GiB;
  manager.measure = (path) => path === realpathSync(row.path) ? 9 * GiB : 0;
  await assert.rejects(manager.install({ id: row.id }), /its disk budget/);
  manager.measure = (path) => path === join(manager.root, 'worktrees') || path === join(manager.root, 'retired') ? 100 * GiB : 0;
  await assert.rejects(manager.install({ id: row.id }), /total disk budget/);
  assert.equal(manager.jobs().length, 0);
  assert.equal(existsSync(join(row.path, 'node_modules')), false);
});

test('native npm installation occupies the same heavy lease pool and cannot bypass concurrency', async () => {
  const { manager, create } = fixture();
  await manager.configure({ maxHeavyJobs: 1 });
  const busy = await create('npm-busy'); const row = await create('npm-waiting'); npmFixture(row);
  const running = manager.run({ id: busy.id, argv: [process.execPath, '-e', 'setTimeout(() => process.exit(0), 500)'] });
  while (manager.jobs().length === 0) await new Promise((done) => setTimeout(done, 10));
  await assert.rejects(manager.install({ id: row.id }), /Heavy-command limit/);
  assert.equal(existsSync(join(row.path, 'node_modules')), false);
  assert.equal((await running).exitCode, 0);
  assert.equal(manager.jobs().length, 0);
});

test('periodic budget scans do not hold the heartbeat registry lock while the child is alive', async () => {
  const { manager, create } = fixture();
  const row = await create('periodic-budget');
  let measuredTicks = 0;
  manager.measure = () => {
    {
      const child = manager.jobs().find((job) => Number.isInteger(job.childPid));
      let childAlive = false;
      if (child) { try { process.kill(child.childPid, 0); childAlive = true; } catch (error) { if (error.code !== 'ESRCH') throw error; } }
      if (childAlive) {
        measuredTicks++;
        assert.equal(existsSync(join(manager.root, 'state.lock')), false, 'periodic budget scan must not inherit the async heartbeat lock');
      }
    }
    return 0;
  };
  const originalSetInterval = globalThis.setInterval;
  globalThis.setInterval = (callback, delay, ...args) => {
    if (delay !== 15_000) return originalSetInterval(callback, delay, ...args);
    return originalSetInterval(callback, 10, ...args);
  };
  try {
    const result = await manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => process.exit(0), 150)'] });
    assert.equal(result.exitCode, 0);
    assert.ok(measuredTicks > 0, 'the real periodic budget callback must run while the child is alive');
    assert.equal(manager.jobs().length, 0);
  } finally {
    globalThis.setInterval = originalSetInterval;
  }
});

test('separate CLI processes serialize creates rather than losing manifests', async () => {
  const { manager, repo } = fixture();
  await manager.configure({ maxWriters: 1, minFreeBytes: 1 });
  const cli = fileURLToPath(new URL('../scripts/fleet-workspace.mjs', import.meta.url));
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

const pause = (ms) => new Promise((done) => setTimeout(done, ms));
function acceleratedTicks() {
  const original = globalThis.setInterval;
  globalThis.setInterval = (callback, delay, ...args) => original(callback, delay === 15_000 ? 10 : delay, ...args);
  return () => { globalThis.setInterval = original; };
}
test('slow complete scans leave registry available and ignore heartbeat-only changes', async () => {
  const { manager, create } = fixture();
  const row = await create('slow-scan');
  let scanning = false; let measured = 0;
  manager.measure = async () => {
    scanning = true; measured++;
    assert.equal(existsSync(join(manager.root, 'state.lock')), false);
    await pause(40); return 0;
  };
  const running = manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] });
  while (!scanning) await pause(1);
  await manager.heartbeat(row.id);
  assert.equal((await running).exitCode, 0);
  assert.equal(measured, 6, 'startup and post-command each require all three fresh measurements');
});
test('current free reserve and current policy are checked after async measurement', async () => {
  const { manager, create } = fixture();
  const row = await create('fresh-reserve');
  manager.measure = async () => { await pause(20); return 0; };
  const running = manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] });
  manager.freeBytes = () => GiB;
  await assert.rejects(running, /workspace reserve/);
  assert.equal(manager.jobs().length, 0);
  manager.freeBytes = () => 100 * GiB;
  manager.measure = async () => { await pause(20); return 2 * GiB; };
  const second = manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] });
  await manager.configure({ maxWorkspaceBytes: GiB });
  await assert.rejects(second, /its disk budget/);
  assert.equal(manager.jobs().length, 0);
});
test('material workspace identity changes invalidate a scan before command admission', async () => {
  const { manager, create } = fixture();
  const row = await create('identity-guard');
  let scanning = false;
  manager.measure = async () => { scanning = true; await pause(20); return 0; };
  const running = manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] });
  while (!scanning) await pause(1);
  await manager.locked(() => { const changed = manager.record(row.id); changed.state = 'failed'; manager.write(changed); });
  await assert.rejects(running, /closed before|identities changed/);
  assert.equal(manager.jobs().length, 0);
});
test('unknown periodic measurement stops only the owned child and retains diagnostic phase and cause', async () => {
  const { manager, create } = fixture();
  const row = await create('unknown-disk');
  const failure = new Error('du -sk timed out after 180000ms'); failure.code = 'ETIMEDOUT';
  let failedMeasurements = 0;
  manager.measure = () => {
    if (manager.jobs().some((job) => job.childPid)) { failedMeasurements++; throw failure; }
    return 0;
  };
  const restore = acceleratedTicks();
  try {
    await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => {}, 1000)'] }), (error) => {
      assert.match(error.message, /periodic, workspace/);
      const primary = error instanceof AggregateError ? error.cause : error;
      assert.equal(primary.cause, failure); return true;
    });
    assert.equal(manager.jobs().length, 0);
    assert.equal(failedMeasurements, 1, 'a terminal disk failure stops further scans and repeated signals');
  } finally { restore(); }
});
test('long async periodic scans allow independent heartbeats without overlapping scans', async () => {
  const { manager, create } = fixture();
  const row = await create('live-heartbeat');
  let heartbeats = 0; let concurrent = 0; let maximum = 0;
  const heartbeat = manager.heartbeat.bind(manager);
  manager.heartbeat = async (id) => { heartbeats++; return heartbeat(id); };
  manager.measure = async () => { concurrent++; maximum = Math.max(maximum, concurrent); await pause(30); concurrent--; return 0; };
  const restore = acceleratedTicks();
  try {
    assert.equal((await manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => {}, 170)'] })).exitCode, 0);
    assert.ok(heartbeats >= 4); assert.equal(maximum, 1); assert.equal(manager.jobs().length, 0);
  } finally { restore(); }
});
test('heartbeat contention alone does not terminate an otherwise valid owned command', async () => {
  const { manager, create } = fixture();
  const row = await create('heartbeat-contention');
  manager.heartbeat = async () => { throw new Error('simulated registry contention'); };
  const restore = acceleratedTicks();
  try {
    assert.equal((await manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => process.exit(7), 100)'] })).exitCode, 7);
  } finally { restore(); }
});
test('cleanup contention preserves the primary disk error and retains its lease', async () => {
  const { manager, create } = fixture();
  const row = await create('cleanup-cause');
  const original = manager.locked.bind(manager); let calls = 0;
  manager.locked = (fn) => ++calls === 4 ? Promise.reject(new Error('cleanup registry locked')) : original(fn);
  manager.measure = (path) => existsSync(join(path, 'overrun.flag')) ? 9 * GiB : 0;
  await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', "require('fs').writeFileSync('overrun.flag', '')"] }), (error) => {
    assert.ok(error instanceof AggregateError); assert.match(error.cause.message, /disk budget/);
    assert.match(error.message, /cleanup also failed: cleanup registry locked/); return true;
  });
  assert.equal(manager.jobs().length, 1, 'unknown cleanup leaves the private lease available for inspection');
});

test('retired worktrees remain included and unknown retired bytes prevent admission', async () => {
  const { manager, create } = fixture();
  const row = await create('retired-budget');
  manager.measure = (path) => path === join(manager.root, 'retired') ? 41 * GiB : 0;
  await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] }), /including retired/);
  manager.measure = (path) => {
    if (path === join(manager.root, 'retired')) throw new Error('measurement unavailable');
    return 0;
  };
  await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', 'process.exit(0)'] }), /startup, retired-worktrees/);
  assert.equal(manager.jobs().length, 0);
});
test('same checkout remains exclusive under simultaneous asynchronous admission', async () => {
  const { manager, create } = fixture();
  const row = await create('exclusive');
  manager.measure = async () => { await pause(10); return 0; };
  const results = await Promise.allSettled([1, 2].map(() => manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => {}, 100)'] })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /using this checkout/);
  assert.equal(manager.jobs().length, 0);
});

test('async du requires complete valid output and has an actual bounded timeout', async () => {
  const { folder, repo } = fixture();
  const bin = join(folder, 'bin'); mkdirSync(bin);
  const executable = join(bin, 'du');
  const program = (code) => { writeFileSync(executable, `#!${process.execPath}\n${code}\n`); chmodSync(executable, 0o700); };
  const previousPath = process.env.PATH;
  const originalTimeout = globalThis.setTimeout;
  let sawBound = false;
  process.env.PATH = `${bin}:${previousPath}`;
  try {
    program("process.stdout.write('123\\tmeasured-path\\n')");
    assert.equal(await diskBytesAsync(repo), 123 * 1024);
    program("process.stdout.write('unknown\\tmeasured-path\\n')");
    await assert.rejects(diskBytesAsync(repo), /invalid measurement/);
    program("process.stderr.write('unavailable'); process.exit(1)");
    await assert.rejects(diskBytesAsync(repo), /unavailable/);
    program('setTimeout(() => {}, 10000)');
    globalThis.setTimeout = (callback, delay, ...args) => {
      if (delay === 180_000) { sawBound = true; return originalTimeout(callback, 50, ...args); }
      return originalTimeout(callback, delay, ...args);
    };
    await assert.rejects(diskBytesAsync(repo), (error) => error.code === 'ETIMEDOUT');
    assert.equal(sawBound, true);
  } finally { process.env.PATH = previousPath; globalThis.setTimeout = originalTimeout; }
});

test('invalid bytes fail closed in validation, synchronous status and retirement', async () => {
  const { manager, create } = fixture();
  const row = await create('invalid-bytes');
  for (const invalid of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => manager.validateBudgets({ bytes: invalid, total: 0 }), /Invalid workspace disk measurement/);
    assert.throws(() => manager.validateBudgets({ bytes: 0, total: invalid }), /Invalid total disk measurement/);
    manager.measure = () => invalid;
    assert.throws(() => manager.budgets(row.path), /Invalid/);
    assert.throws(() => manager.status(), /Invalid/);
    await assert.rejects(manager.close(row.id), /Invalid workspace disk measurement/);
    assert.equal(manager.record(row.id).state, 'active');
    assert.ok(existsSync(row.path));
  }
  manager.measure = () => 0;
  manager.freeBytes = () => NaN;
  assert.throws(() => manager.validateBudgets({ bytes: 0, total: 0 }), /Invalid free-space/);
});

function leaseProbes({ manager = null, child = null, members = null, group = false } = {}) {
  const probe = (pid) => pid === 11 ? manager !== null : pid === 22 ? child !== null : pid === -22 ? group : false;
  const identities = (pid, grouped) => grouped ? members : pid === 11 ? manager : child;
  return { probe, identities };
}
const leaseStart = Date.parse('2026-10-04T07:18:22.522Z');
const lease = { pid: 11, childPid: 22, startedAt: new Date(leaseStart).toISOString() };
const born = (pid, pgid, offset) => ({ pid, pgid, bornAt: leaseStart + offset });
test('recycled manager PID does not occupy a heavy lease, while original manager remains live', () => {
  assert.equal(jobAlive(lease, leaseProbes({manager:[born(11,11,-5000)]})), true);
  assert.equal(jobAlive(lease, leaseProbes({manager:[born(11,11,3600000)]})), false);
});
test('child birth precision and delayed spawn retain legitimate children and reject distant reuse', () => {
  assert.equal(jobAlive(lease, leaseProbes({child:[born(22,22,478)]})), true);
  for (const offset of [3000,30000,60000]) assert.equal(jobAlive(lease,leaseProbes({child:[born(22,22,offset)],group:true})),true,'delayed orphan child stays protected');
  assert.equal(jobAlive(lease, leaseProbes({child:[born(22,99,3600000)]})), false);
});
test('recycled process-group leader and wholly new group do not occupy a historical lease', () => {
  assert.equal(jobAlive(lease, leaseProbes({child:[born(22,22,3600000)],members:[born(22,22,3600000),born(33,22,3600010)],group:true})), false);
});
test('orphan original groups and older original members survive recycled positive PIDs', () => {
  assert.equal(jobAlive(lease, leaseProbes({members:[born(33,22,3600000)],group:true})), true, 'leader absent; late descendants still protected');
  assert.equal(jobAlive(lease, leaseProbes({child:[born(22,99,3600000)],group:true})), true, 'recycled child in another group cannot disprove original orphan group');
  assert.equal(jobAlive(lease, leaseProbes({child:[born(22,22,3600000)],members:[born(22,22,3600000),born(33,22,-500)],group:true})), true, 'original older group member remains protected');
});
test('unknown process births, group membership and lease timestamps fail closed', () => {
  assert.equal(jobAlive(lease,{probe:pid=>pid===11,identities:()=>null}),true);
  assert.equal(jobAlive(lease,leaseProbes({manager:[{pid:11,pgid:11,bornAt:NaN}]})),true);
  assert.equal(jobAlive({...lease,startedAt:'unknown'},leaseProbes({manager:[born(11,11,3600000)]})),true);
  assert.equal(jobAlive(lease,leaseProbes({child:[born(22,22,3600000)],group:true,members:null})),true);
  assert.equal(jobAlive(lease,leaseProbes({child:[born(22,22,3600000)],group:true,members:[]})),true);
});


test('startup retries a changed unrelated identity with fresh bytes before atomic admission', async () => {
  const { manager, create } = fixture();
  const row = await create('startup-retry'); const other = await create('startup-other');
  let measured = 0; let changed = false; const accepted = [];
  const validate = manager.validateBudgets.bind(manager);
  manager.validateBudgets = (snapshot) => { const result = validate(snapshot); accepted.push(snapshot.bytes); return result; };
  manager.measure = async (path) => {
    measured++; assert.equal(existsSync(join(manager.root, 'state.lock')), false);
    if (!changed && path === realpathSync(row.path)) {
      changed = true;
      await manager.locked(() => { manager.write({ ...manager.record(other.id), state: 'failed' }); });
      return 7 * GiB;
    }
    return 0;
  };
  assert.equal((await manager.run({ id: row.id, argv: [process.execPath, '-e', "require('fs').writeFileSync('admitted.flag', 'fresh')"] })).exitCode, 0);
  assert.equal(measured, 9, 'one rejected scan plus fresh startup and postflight scans each measure all three roles');
  assert.deepEqual(accepted, [0, 0], 'stale bytes are never accepted');
  assert.equal(readFileSync(join(row.path, 'admitted.flag'), 'utf8'), 'fresh');
  assert.equal(manager.jobs().length, 0);
});

test('one unrelated identity change during a periodic scan converges without killing the owned child', async () => {
  const { manager, create } = fixture();
  const row = await create('periodic-retry'); const other = await create('periodic-other');
  let changed = false; let periodicWorkspaces = 0; let verifiedAlive = false;
  manager.measure = async (path) => {
    assert.equal(existsSync(join(manager.root, 'state.lock')), false);
    const child = manager.jobs().find((job) => job.childPid);
    let childAlive = false;
    if (child) {
      try { process.kill(child.childPid, 0); childAlive = true; }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    if (childAlive && path === realpathSync(row.path)) {
      periodicWorkspaces++; verifiedAlive = true;
      if (!changed) {
        changed = true;
        await manager.locked(() => { manager.write({ ...manager.record(other.id), state: 'failed' }); });
      }
    }
    await pause(5); return 0;
  };
  const restore = acceleratedTicks();
  try {
    assert.equal((await manager.run({ id: row.id, argv: [process.execPath, '-e', "setTimeout(() => require('fs').writeFileSync('completed.flag', 'alive'), 300)"] })).exitCode, 0);
    assert.ok(changed && verifiedAlive && periodicWorkspaces >= 2);
    assert.equal(readFileSync(join(row.path, 'completed.flag'), 'utf8'), 'alive');
    assert.equal(manager.jobs().length, 0);
  } finally { restore(); }
});

test('continuous periodic identity churn fails closed after exactly three full fresh scans', async () => {
  const { manager, create } = fixture();
  const row = await create('periodic-churn'); const other = await create('churn-other');
  let attempts = 0; let periodicRoles = 0;
  manager.measure = async (path) => {
    assert.equal(existsSync(join(manager.root, 'state.lock')), false);
    if (manager.jobs().some((job) => job.childPid)) {
      periodicRoles++;
      if (path === realpathSync(row.path)) {
        attempts++;
        await manager.locked(() => {
          const current = manager.record(other.id);
          manager.write({ ...current, state: current.state === 'active' ? 'failed' : 'active' });
        });
      }
    }
    return 0;
  };
  const restore = acceleratedTicks();
  try {
    await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => {}, 1000)'] }), (error) => {
      const primary = error instanceof AggregateError ? error.cause : error;
      assert.ok(primary instanceof StaleWorkspaceSnapshotError); return true;
    });
    assert.equal(attempts, 3); assert.equal(periodicRoles, 9);
    assert.equal(manager.jobs().length, 0);
    assert.equal(readFileSync(join(row.path, 'source.txt'), 'utf8'), 'retained source\n');
  } finally { restore(); }
});

test('actual periodic disk or reserve failures are terminal even when identities also change', async () => {
  for (const kind of ['bytes', 'reserve']) {
    const { manager, create } = fixture();
    const row = await create(`terminal-${kind}`); const other = await create(`other-${kind}`);
    let scans = 0;
    manager.measure = async (path) => {
      if (path === realpathSync(row.path) && manager.jobs().some((job) => job.childPid)) {
        scans++;
        await manager.locked(() => { manager.write({ ...manager.record(other.id), state: 'failed' }); });
        if (kind === 'reserve') manager.freeBytes = () => GiB;
        return kind === 'bytes' ? 9 * GiB : 0;
      }
      return 0;
    };
    const restore = acceleratedTicks();
    try {
      await assert.rejects(manager.run({ id: row.id, argv: [process.execPath, '-e', 'setTimeout(() => {}, 1000)'] }), kind === 'bytes' ? /its disk budget/ : /workspace reserve/);
      assert.equal(scans, 1, 'real failures do not consume identity retries');
      assert.equal(manager.jobs().length, 0);
    } finally { restore(); }
  }
});

test('postflight identity changes also require a complete converged fresh scan', async () => {
  const { manager, create } = fixture();
  const row = await create('postflight-retry'); const other = await create('postflight-other');
  let changed = false; let measured = 0;
  manager.measure = async (path) => {
    measured++;
    if (!changed && path === realpathSync(row.path) && existsSync(join(row.path, 'completed.flag'))) {
      changed = true;
      await manager.locked(() => { manager.write({ ...manager.record(other.id), state: 'failed' }); });
    }
    return 0;
  };
  assert.equal((await manager.run({ id: row.id, argv: [process.execPath, '-e', "require('fs').writeFileSync('completed.flag', '')"] })).exitCode, 0);
  assert.ok(changed); assert.equal(measured, 9);
  assert.equal(manager.record(row.id).lastExitCode, 0); assert.equal(manager.jobs().length, 0);
});
