import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, realpathSync, rmSync, chmodSync, lstatSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { AgentWorkspaces, GiB, inventory, diskBytes, diskBytesAsync, retiredBytesAsync, jobAlive, StaleWorkspaceSnapshotError, vanishedOnly } from '../lib/agent-workspaces.mjs';

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
  const manager = new AgentWorkspaces({ root: join(folder, 'state'), measure: () => 0, freeBytes: () => 100 * GiB, openFiles: () => 0, gh: () => '[]', ...options });
  const create = (id) => manager.create({ id, repo, owner: 'test-agent', task: 'test workspace lifecycle' });
  return { folder, repo, manager, create };
}

test('initialization preserves a private retired directory timestamp and repairs unsafe modes', async () => {
  const { manager } = fixture();
  manager.initialize();
  const retired = join(manager.root, 'retired');
  const before = lstatSync(retired, { bigint: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  manager.initialize();
  const after = lstatSync(retired, { bigint: true });
  assert.equal(after.ctimeNs, before.ctimeNs, 'an unrelated command must not invalidate an in-flight retired disk scan');
  assert.equal(after.mtimeNs, before.mtimeNs);
  chmodSync(retired, 0o1755);
  manager.initialize();
  assert.equal(lstatSync(retired).mode & 0o7777, 0o700, 'private mode and removal of special bits are still enforced');
});

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
  assert.equal((await manager.gc()).dryRun, true);
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

test('open files remain blockers after switching to a clean landed branch', async () => {
  const { manager, create } = fixture({ openFiles: () => 1 });
  const row = await create('busy');
  await assert.rejects(manager.close('busy'), /open-files/);
  git(row.path, 'switch', '-c', 'different-branch');
  const preview = await manager.close('busy', { dryRun: true });
  assert.ok(preview.blockers.includes('open-files'));
  assert.ok(!preview.blockers.includes('branch-changed'));
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
  await assert.rejects(manager.gc(), /Invalid workspace manifest/);
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

for (const nested of [false, true]) test(`independent child lockfile uses its exact pin and root writer lease (nested workspace: ${nested})`, async () => {
  const { manager, create } = fixture();
  const row = await create('child-lockfile');
  const child = join(row.path, 'app'); mkdirSync(child);
  writeFileSync(join(row.path, 'package.json'), JSON.stringify({ packageManager: 'pnpm@9.15.0' }));
  writeFileSync(join(child, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
  writeFileSync(join(child, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  if (nested) {
    writeFileSync(join(row.path, 'pnpm-workspace.yaml'), 'packages: [packages/*]\n');
    writeFileSync(join(child, 'pnpm-workspace.yaml'), 'packages: [.]\n');
  }
  const policy = manager.policy.bind(manager);
  const storeDir = join(row.path, '.test-shared-store');
  manager.policy = () => ({ ...policy(), storeDir });
  let observed;
  manager.run = async (options) => { observed = options; return { exitCode: 0 }; };
  await manager.lockfileOnly({ id: row.id, 'package-dir': 'app' });
  assert.deepEqual(observed, {
    id: row.id, repo: realpathSync(row.path), installing: true,
    argv: ['corepack', 'pnpm@10.33.2', '--dir', realpathSync(child), 'install', '--lockfile-only', '--ignore-scripts', '--store-dir', storeDir, '--package-import-method', 'auto'],
  });
  assert.equal(existsSync(join(row.path, 'pnpm-lock.yaml')), false);
  assert.equal(existsSync(join(child, 'node_modules')), false);
});

test('child workspace boundaries must be regular files, not links or directories', async () => {
  const { manager, create, folder } = fixture();
  const row = await create('child-workspace-boundary');
  const outside = join(folder, 'outside-workspace.yaml');
  writeFileSync(outside, 'packages: [.]\n');
  let launches = 0;
  manager.run = async () => { launches++; };
  for (const kind of ['linked', 'directory']) {
    const child = join(row.path, kind); mkdirSync(child);
    writeFileSync(join(child, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.33.2' }));
    writeFileSync(join(child, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    const boundary = join(child, 'pnpm-workspace.yaml');
    if (kind === 'linked') symlinkSync(outside, boundary);
    else mkdirSync(boundary);
    await assert.rejects(manager.lockfileOnly({ id: row.id, 'package-dir': kind }), /regular pnpm-workspace.yaml/);
  }
  assert.equal(launches, 0);
});

test('child lockfile rejects traversal, symlink directories and inherited pnpm workspaces', async () => {
  const { manager, create, folder } = fixture();
  const row = await create('child-paths');
  const child = join(row.path, 'app'); mkdirSync(child);
  const outside = join(folder, 'outside'); mkdirSync(outside);
  symlinkSync(outside, join(row.path, 'linked'), 'dir');
  let launches = 0;
  manager.run = async () => { launches++; };
  for (const packageDir of ['', '.', '..', '../outside', 'app/../app', 'app//child', '/tmp', 'C:\\outside']) {
    await assert.rejects(manager.lockfileOnly({ id: row.id, 'package-dir': packageDir }), /relative child directory/);
  }
  for (const packageDir of ['linked', 'linked/child']) {
    await assert.rejects(manager.lockfileOnly({ id: row.id, 'package-dir': packageDir }), /real directories/);
  }
  writeFileSync(join(row.path, 'pnpm-workspace.yaml'), 'packages: [app]\n');
  await assert.rejects(manager.lockfileOnly({ id: row.id, 'package-dir': 'app' }), /parent pnpm workspace/);
  assert.equal(launches, 0);
});

test('child lockfile requires its own regular pinned manifest, lockfile and dependency layout', async () => {
  const { manager, create, folder } = fixture();
  const row = await create('child-metadata');
  const outside = join(folder, 'outside'); mkdirSync(outside);
  let launches = 0;
  manager.run = async () => { launches++; };
  for (const [index, kind] of ['missing-manifest', 'bad-pin', 'missing-lock', 'linked-manifest', 'linked-lock', 'linked-modules', 'linked-store'].entries()) {
    const name = `child-${index}`;
    const child = join(row.path, name); mkdirSync(child);
    const manifest = join(child, 'package.json');
    const lock = join(child, 'pnpm-lock.yaml');
    if (kind === 'linked-manifest') symlinkSync(join(outside, 'package.json'), manifest);
    else if (kind !== 'missing-manifest') writeFileSync(manifest, JSON.stringify({ packageManager: kind === 'bad-pin' ? 'pnpm@^10.33.2' : 'pnpm@10.33.2' }));
    if (kind === 'linked-lock') symlinkSync(join(outside, 'pnpm-lock.yaml'), lock);
    else if (kind !== 'missing-lock') writeFileSync(lock, 'lockfileVersion: 9.0\n');
    if (kind === 'linked-modules') symlinkSync(outside, join(child, 'node_modules'), 'dir');
    if (kind === 'linked-store') { mkdirSync(join(child, 'node_modules')); symlinkSync(outside, join(child, 'node_modules', '.pnpm'), 'dir'); }
    await assert.rejects(manager.lockfileOnly({ id: row.id, 'package-dir': name }), /regular package.json|exact pnpm packageManager pin|regular pnpm-lock.yaml|separate node_modules/);
  }
  assert.equal(launches, 0);
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

test('fresh bounded retired scans start commands promptly and retain total-budget rejection', async () => {
  const { folder, manager, create } = fixture();
  const row = await create('parallel-retired');
  const retired = join(manager.root, 'retired');
  for (let index = 0; index < 48; index++) {
    const path = join(retired, `tree-${index}`); mkdirSync(path);
    for (let file = 0; file < 8; file++) writeFileSync(join(path, `payload-${file}`), 'retained');
  }
  const bin = join(folder, 'bin'); mkdirSync(bin);
  const executable = join(bin, 'du');
  const program = (kib) => writeFileSync(executable, `#!${process.execPath}\nsetTimeout(() => process.stdout.write('${kib}\\tmeasured\\n'), 80);\n`, { mode: 0o700 });
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath}`;
  try {
    program(1024);
    const live = new AgentWorkspaces({ root: manager.root, freeBytes: () => 100 * GiB, openFiles: () => 0 });
    const marker = join(folder, 'started');
    const started = Date.now();
    const running = live.run({ id: row.id, argv: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, '')`] });
    while (!existsSync(marker) && Date.now() - started < 3_500) await pause(10);
    assert.ok(existsSync(marker), 'admission must not wait for serial scans of every retired tree');
    assert.ok(Date.now() - started < 3_500);
    assert.equal((await running).exitCode, 0);
    assert.ok(await retiredBytesAsync(retired) >= 48 * 1024 ** 2);

    program(3 * 1024 ** 2);
    const blocked = join(folder, 'must-not-start');
    await assert.rejects(live.run({ id: row.id, argv: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(blocked)}, '')`] }), /including retired/);
    assert.equal(existsSync(blocked), false);
  } finally { process.env.PATH = previousPath; }
});

test('retired scan includes unknown entries, retries one change, and fails closed on continuous churn', async () => {
  const { folder, manager } = fixture();
  manager.initialize();
  const retired = join(manager.root, 'retired');
  mkdirSync(join(retired, 'tree'));
  writeFileSync(join(retired, 'tree', 'payload'), 'retained');
  writeFileSync(join(retired, 'untracked-file'), 'also retained');
  symlinkSync(join(retired, 'missing-target'), join(retired, 'dangling-alias'));
  assert.ok(await retiredBytesAsync(retired) >= await diskBytesAsync(retired));

  const bin = join(folder, 'bin'); mkdirSync(bin);
  const executable = join(bin, 'du');
  writeFileSync(executable, `#!${process.execPath}\nconst fs = require('fs'); const path = ${JSON.stringify(join(retired, 'late-entry'))}; if (!fs.existsSync(path)) fs.writeFileSync(path, 'new'); process.stdout.write('1\\tmeasured\\n');\n`, { mode: 0o700 });
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath}`;
  try {
    assert.ok(await retiredBytesAsync(retired) >= 3 * 1024);
    writeFileSync(executable, `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(retired)} + '/churn-' + process.pid, 'new'); process.stdout.write('1\\tmeasured\\n');\n`, { mode: 0o700 });
    await assert.rejects(retiredBytesAsync(retired), /Retired directory changed during three/);
  }
  finally { process.env.PATH = previousPath; }
});

test('whole retired scan timeout cancels and reaps every in-flight du worker', async () => {
  const { folder, manager } = fixture();
  manager.initialize();
  const retired = join(manager.root, 'retired');
  for (let index = 0; index < 8; index++) mkdirSync(join(retired, `tree-${index}`));
  const pids = join(folder, 'du-pids'); mkdirSync(pids);
  const bin = join(folder, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'du'), `#!${process.execPath}\nrequire('fs').writeFileSync(${JSON.stringify(pids)} + '/' + process.pid, ''); setTimeout(() => {}, 10000);\n`, { mode: 0o700 });
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath}`;
  try {
    const started = Date.now();
    await assert.rejects(retiredBytesAsync(retired, { timeoutMs: 1_500 }), /Retired disk scan timed out after 1500ms/);
    assert.ok(Date.now() - started < 3_000, 'the bound applies to the entire scan');
    const startedPids = readdirSync(pids).map(Number);
    assert.ok(startedPids.length > 0 && startedPids.length <= 4, 'only bounded fan-out may start');
    for (const pid of startedPids) assert.throws(() => process.kill(pid, 0), (error) => error.code === 'ESRCH', `du ${pid} must be reaped before admission returns`);
  } finally { process.env.PATH = previousPath; }
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

test('invalid bytes fail closed in validation and async status; close needs no disk measurement', async () => {
  const { manager, create } = fixture();
  const row = await create('invalid-bytes');
  for (const invalid of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => manager.validateBudgets({ bytes: invalid, total: 0 }), /Invalid workspace disk measurement/);
    assert.throws(() => manager.validateBudgets({ bytes: 0, total: invalid }), /Invalid total disk measurement/);
    manager.measure = () => invalid;
    assert.throws(() => manager.budgets(row.path), /Invalid/);
    await assert.rejects(manager.status(), /Invalid/);
    assert.equal((await manager.close(row.id, { dryRun: true })).action, 'move-to-retired');
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

function squashLand(repo, row, files) {
  // Simulate a provider squash merge: the same content lands on main as a new
  // commit, so the branch HEAD is never contained in a remote-tracking ref.
  for (const [name, content] of Object.entries(files)) writeFileSync(join(row.path, name), content);
  git(row.path, 'add', '-A'); git(row.path, 'commit', '-m', 'branch work');
  git(repo, 'checkout', '-q', '--detach', 'refs/remotes/origin/main');
  for (const [name, content] of Object.entries(files)) writeFileSync(join(repo, name), content);
  git(repo, 'add', '-A'); git(repo, 'commit', '-m', 'squash: branch work');
  const landed = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'update-ref', 'refs/remotes/origin/main', landed);
  git(repo, 'checkout', '-q', 'main');
  return landed;
}

test('close accepts squash-landed branches only when changed paths match the remote branch', async () => {
  const { manager, repo, create } = fixture();
  const row = await create('squashed');
  squashLand(repo, row, { 'feature.txt': 'landed by squash\n' });
  // main moved on in unrelated files after the squash; still content-equal for the branch's paths.
  git(repo, 'checkout', '-q', '--detach', 'refs/remotes/origin/main');
  writeFileSync(join(repo, 'later.txt'), 'later main work\n'); git(repo, 'add', 'later.txt'); git(repo, 'commit', '-m', 'later');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD'); git(repo, 'checkout', '-q', 'main');
  const preview = await manager.close('squashed', { dryRun: true });
  assert.equal(preview.action, 'move-to-retired');
  assert.equal(preview.landing.landedBy, 'content-equal');
  const receipt = await manager.close('squashed');
  assert.equal(receipt.landing.landedBy, 'content-equal');
  assert.equal(readFileSync(join(receipt.retired, 'feature.txt'), 'utf8'), 'landed by squash\n');
  assert.equal(manager.record('squashed').state, 'closed');
});

test('close keeps unlanded or diverged work unless an operator names a landed remote commit', async () => {
  const { manager, repo, create } = fixture();
  const row = await create('diverged');
  const landed = squashLand(repo, row, { 'feature.txt': 'branch version\n' });
  // Main later edits the same file, so content equality no longer proves landing.
  git(repo, 'checkout', '-q', '--detach', 'refs/remotes/origin/main');
  writeFileSync(join(repo, 'feature.txt'), 'edited on main\n'); git(repo, 'commit', '-qam', 'edit');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD'); git(repo, 'checkout', '-q', 'main');
  await assert.rejects(manager.close('diverged'), /head-not-in-local-remote-refs/);
  await assert.rejects(manager.close('diverged', { landed: 'deadbeefdeadbeef' }), /landing-unverified/);
  const local = git(row.path, 'rev-parse', 'HEAD');
  await assert.rejects(manager.close('diverged', { landed: local }), /not contained in a local remote-tracking ref/);
  const receipt = await manager.close('diverged', { landed });
  assert.equal(receipt.landing.landedBy, 'operator-verified');
  assert.equal(receipt.landing.landedCommit, landed);

  const other = await create('unpublished');
  writeFileSync(join(other.path, 'only-here.txt'), 'never pushed\n');
  git(other.path, 'add', '-A'); git(other.path, 'commit', '-m', 'local only');
  await assert.rejects(manager.close('unpublished'), /head-not-in-local-remote-refs/);
  assert.ok(existsSync(join(other.path, 'only-here.txt')));
});

function mergedPrFixture(id = 'merged-pr') {
  const fixtureData = fixture();
  return { ...fixtureData, setup: async () => {
    const row = await fixtureData.create(id);
    const merge = squashLand(fixtureData.repo, row, { 'feature.txt': 'branch work\n' });
    git(fixtureData.repo, 'checkout', '-q', '--detach', 'refs/remotes/origin/main');
    writeFileSync(join(fixtureData.repo, 'feature.txt'), 'later main edit\n');
    git(fixtureData.repo, 'commit', '-qam', 'main moves on');
    git(fixtureData.repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    git(fixtureData.repo, 'checkout', '-q', 'main');
    const pr = { number: 123, url: 'https://github.com/example/product/pull/123', headRefOid: git(row.path, 'rev-parse', 'HEAD'), mergeCommit: { oid: merge } };
    return { row, pr };
  } };
}

test('merged PR evidence retires squash work after main edits and remote branch deletion', async () => {
  const { manager, repo, setup } = mergedPrFixture();
  const { row, pr } = await setup();
  git(repo, 'update-ref', `refs/remotes/origin/${row.branch}`, pr.headRefOid);
  git(repo, 'update-ref', '-d', `refs/remotes/origin/${row.branch}`);
  const calls = [];
  manager.gh = async (args, cwd) => { calls.push({ args, cwd }); return JSON.stringify([pr]); };
  const receipt = await manager.close(row.id);
  assert.equal(receipt.landing.landedBy, 'merged-pr');
  assert.equal(receipt.landing.prNumber, pr.number); assert.equal(receipt.landing.prUrl, pr.url);
  assert.deepEqual(receipt.landing.landedRefs, ['refs/remotes/origin/main']);
  assert.deepEqual(calls, [{ cwd: row.path, args: ['pr', 'list', '--state', 'merged', '--head', row.branch, '--json', 'number,mergeCommit,headRefOid,url', '--limit', '5'] }]);
  assert.equal(readFileSync(join(receipt.retired, 'feature.txt'), 'utf8'), 'branch work\n');
});

test('merged PR must contain HEAD, never commits ahead of its head or unrelated work', async () => {
  const { manager, setup, repo } = mergedPrFixture();
  const { row, pr } = await setup();
  manager.gh = () => JSON.stringify([pr]);
  writeFileSync(join(row.path, 'feature.txt'), 'extra unpublished change\n');
  git(row.path, 'commit', '-qam', 'ahead of merged PR');
  await assert.rejects(manager.close(row.id), /head-not-in-local-remote-refs/);
  git(row.path, 'checkout', '--detach', pr.headRefOid);
  git(row.path, 'switch', '-c', 'unrelated', git(repo, 'rev-parse', 'main'));
  writeFileSync(join(row.path, 'unrelated.txt'), 'other work\n');
  git(row.path, 'add', '-A'); git(row.path, 'commit', '-m', 'other branch');
  const preview = await manager.close(row.id, { dryRun: true });
  assert.ok(preview.blockers.includes('branch-changed'));
  assert.ok(preview.blockers.includes('head-not-in-local-remote-refs'));
  assert.equal(preview.landing, undefined);
});

test('merged PR accepts an ancestor HEAD and a clean detached HEAD', async () => {
  const { manager, setup } = mergedPrFixture();
  const { row, pr } = await setup();
  const head = pr.headRefOid;
  writeFileSync(join(row.path, 'later-pr.txt'), 'more merged work\n');
  git(row.path, 'add', '-A'); git(row.path, 'commit', '-m', 'later PR head');
  pr.headRefOid = git(row.path, 'rev-parse', 'HEAD');
  git(row.path, 'checkout', '--detach', head);
  manager.gh = () => JSON.stringify([pr]);
  const receipt = await manager.close(row.id);
  assert.equal(receipt.head, head); assert.equal(receipt.branchNow, null);
  assert.equal(receipt.landing.landedBy, 'merged-pr');
  assert.match(receipt.notes.join('\n'), /detached HEAD.*clean and landed/);
});

test('current branch PR is checked separately; dirty switched work stays blocked', async () => {
  const { manager, setup } = mergedPrFixture();
  const { row, pr } = await setup();
  git(row.path, 'switch', '-c', 'current-branch');
  const branches = [];
  manager.gh = (args) => {
    const branch = args[args.indexOf('--head') + 1]; branches.push(branch);
    return JSON.stringify(branch === 'current-branch' ? [pr] : []);
  };
  writeFileSync(join(row.path, 'untracked.txt'), 'keep dirty source');
  const preview = await manager.close(row.id, { dryRun: true });
  assert.ok(preview.blockers.includes('branch-changed')); assert.ok(preview.blockers.includes('dirty-or-untracked'));
  assert.deepEqual(branches, [row.branch, 'current-branch']);
  git(row.path, 'add', 'untracked.txt'); git(row.path, 'commit', '-m', 'additional work');
  // Return to the PR head cleanly, preserving the additional commit on its branch.
  git(row.path, 'switch', '-c', 'landed-current', pr.headRefOid);
  manager.gh = (args) => JSON.stringify(args[args.indexOf('--head') + 1] === 'landed-current' ? [pr] : []);
  const receipt = await manager.close(row.id);
  assert.equal(receipt.branchNow, 'landed-current'); assert.match(receipt.notes.join('\n'), /clean and landed/);
});

test('gh failures and malformed or mismatched evidence fail closed without fatal provider errors', async () => {
  const { manager, setup } = mergedPrFixture();
  const { row, pr } = await setup();
  for (const runner of [
    () => { throw new Error('gh missing or unauthenticated'); },
    async () => { throw new Error('provider failed'); },
    () => 'not json', () => '{}', () => '[]',
    () => JSON.stringify([{ ...pr, state: 'OPEN' }]),
    () => JSON.stringify([{ ...pr, headRefName: 'unrelated' }]),
    () => JSON.stringify([{ ...pr, headRefOid: 'invalid' }]),
    () => JSON.stringify([{ ...pr, mergeCommit: null }]),
  ]) {
    manager.gh = runner;
    const preview = await manager.close(row.id, { dryRun: true });
    assert.deepEqual(preview.blockers, ['head-not-in-local-remote-refs']);
    assert.equal(preview.landing, undefined); assert.equal(manager.record(row.id).state, 'active');
  }
});

test('available PR merge commits need remote containment; unavailable commits use provider evidence', async () => {
  const { manager, repo, setup } = mergedPrFixture();
  const { row, pr } = await setup();
  pr.mergeCommit.oid = pr.headRefOid;
  manager.gh = () => JSON.stringify([pr]);
  await assert.rejects(manager.close(row.id), /head-not-in-local-remote-refs/);
  // No local merge object or remote refs: gh supplies the merged-state evidence.
  git(repo, 'update-ref', '-d', 'refs/remotes/origin/main');
  pr.mergeCommit.oid = 'a'.repeat(40);
  assert.equal((await manager.close(row.id)).landing.landedBy, 'merged-pr');
});

test('already-landed HEAD ignores --landed and records clean branch changes', async () => {
  const { manager, create } = fixture();
  const row = await create('switched');
  git(row.path, 'switch', '-c', 'finished-branch');
  const receipt = await manager.close(row.id, { landed: 'unneeded-invalid-flag' });
  assert.equal(receipt.branchNow, 'finished-branch');
  assert.match(receipt.notes.join('\n'), /Ignored --landed/);
  assert.match(receipt.notes.join('\n'), /clean and landed/);
  const { manager: squashManager, setup } = mergedPrFixture('flag-merged');
  const { row: squashRow, pr } = await setup();
  squashManager.gh = () => JSON.stringify([pr]);
  const preview = await squashManager.close(squashRow.id, { dryRun: true, landed: 'invalid-but-unneeded' });
  assert.equal(preview.action, 'move-to-retired'); assert.match(preview.notes.join('\n'), /Ignored --landed/);
});

test('bulk close preserves busy, fresh, dirty and unlanded work; dry-run changes no receipts or manifests', async () => {
  const { manager, repo, create } = fixture();
  const rows = {};
  for (const id of ['eligible', 'dirty', 'unlanded', 'open', 'leased', 'fresh', 'locked']) rows[id] = await create(id);
  for (const row of Object.values(rows).filter((item) => item.id !== 'fresh')) manager.write({ ...row, heartbeatAt: new Date(Date.now() - 31 * 60_000).toISOString() });
  writeFileSync(join(rows.dirty.path, 'dirty.txt'), 'retain');
  writeFileSync(join(rows.unlanded.path, 'new.txt'), 'unpublished');
  git(rows.unlanded.path, 'add', '-A'); git(rows.unlanded.path, 'commit', '-m', 'unpublished');
  manager.openFiles = (path) => path === rows.open.path ? 1 : 0;
  writeFileSync(join(manager.root, 'jobs', 'test-lease.json'), JSON.stringify({ token: 'test-lease', id: 'leased', repo, pid: process.pid, startedAt: new Date().toISOString() }));
  git(repo, 'worktree', 'lock', rows.locked.path);
  manager.measure = () => { throw new Error('close must never measure disk'); };
  const before = manager.records();
  const preview = await manager.closeAllLanded({ dryRun: true });
  assert.deepEqual(preview.counts, { closed: 2, kept: 5, total: 7 });
  assert.ok(preview.closed.every((item) => item.reason === 'would-retire'));
  assert.deepEqual(manager.records(), before);
  assert.ok(!existsSync(join(manager.root, 'receipts', 'eligible.json')));
  const result = await manager.closeAllLanded();
  assert.deepEqual(result.closed.map((item) => item.id), ['eligible']);
  assert.deepEqual(result.counts, { closed: 1, kept: 6, total: 7 });
  for (const [id, blocker] of [['dirty', 'dirty-or-untracked'], ['unlanded', 'head-not-in-local-remote-refs'], ['open', 'open-files'], ['leased', 'command-running'], ['fresh', 'heartbeat-not-idle']]) {
    assert.ok(result.kept.find((item) => item.id === id).blockers.includes(blocker));
    assert.equal(manager.record(id).state, 'active'); assert.ok(existsSync(rows[id].path));
  }
  assert.match(result.kept.find((item) => item.id === 'locked').reason, /locked/);
  assert.ok(existsSync(join(manager.root, 'receipts', 'eligible.json')));
  assert.ok(existsSync(join(manager.record('eligible').path, 'source.txt')));
  assert.equal(git(repo, 'rev-parse', '--verify', rows.eligible.branch).length, 40);
  assert.equal((await manager.closeAllLanded({ dryRun: true, idleMinutes: 60 })).closed.length, 0);
  await assert.rejects(manager.closeAllLanded({ idleMinutes: -1 }), /idle-minutes/);
  await assert.rejects(manager.closeAllLanded({ idleMinutes: NaN }), /idle-minutes/);
});

test('bulk close uses merged PR evidence and continues after a per-workspace move failure', async () => {
  const { manager, repo, setup, create } = mergedPrFixture('z-merged');
  const { row, pr } = await setup();
  const failed = await create('a-locked');
  for (const item of [row, failed]) manager.write({ ...item, heartbeatAt: new Date(Date.now() - 60 * 60_000).toISOString() });
  git(repo, 'worktree', 'lock', failed.path);
  manager.gh = () => JSON.stringify([pr]);
  const result = await manager.closeAllLanded();
  assert.deepEqual(result.closed.map((item) => item.id), [row.id]);
  assert.deepEqual(result.kept.map((item) => item.id), [failed.id]);
  assert.equal(JSON.parse(readFileSync(join(manager.root, 'receipts', `${row.id}.json`))).landing.landedBy, 'merged-pr');
});

test('status disk measurements are async and bounded; no-disk inspection computes no budgets', async () => {
  const { manager, create } = fixture();
  for (let index = 0; index < 6; index++) await create(`status-${index}`);
  let concurrent = 0; let maximum = 0; const calls = [];
  manager.measure = async (path) => {
    calls.push(path); concurrent++; maximum = Math.max(maximum, concurrent);
    await pause(10); concurrent--; return 1024;
  };
  const result = await manager.status();
  assert.equal(maximum, 4); assert.equal(calls.length, 8);
  assert.equal(result.managedReportedBytes, 2048);
  assert.ok(result.workspaces.every((item) => item.reportedBytes === 1024 && item.overBudget === false));
  manager.measure = () => { throw new Error('no disk'); };
  manager.freeBytes = () => { throw new Error('no reserve calculation'); };
  const light = await manager.status({ noDisk: true });
  for (const field of ['freeBytes', 'managedReportedBytes', 'belowFreeSpaceReserve', 'totalOverBudget']) assert.ok(!Object.hasOwn(light, field));
  assert.ok(light.workspaces.every((item) => item.reportedBytes === null && !Object.hasOwn(item, 'overBudget')));
  assert.equal((await manager.inspect(manager.record('status-0'), { noDisk: true })).reportedBytes, null);
  await manager.close('status-0');
});

test('default status uses asynchronous du and leaves the event loop responsive', async () => {
  const { manager, create, folder } = fixture();
  await create('async-status');
  const bin = join(folder, 'bin'); mkdirSync(bin);
  const executable = join(bin, 'du');
  writeFileSync(executable, `#!${process.execPath}\nsetTimeout(() => process.stdout.write('1\\tpath\\n'), 50);\n`);
  chmodSync(executable, 0o700);
  const previousPath = process.env.PATH;
  process.env.PATH = `${bin}:${previousPath}`;
  manager.measure = diskBytes;
  let ticked = false;
  const timer = setTimeout(() => { ticked = true; }, 10);
  try {
    const status = await manager.status();
    assert.equal(ticked, true); assert.equal(status.managedReportedBytes, 2048);
    assert.equal(status.workspaces[0].reportedBytes, 1024);
  } finally { clearTimeout(timer); process.env.PATH = previousPath; }
});

test('create retries changed identities with fresh budgets and fails closed after three attempts', async () => {
  const { manager, create } = fixture();
  const other = await create('existing');
  let scans = 0; let changed = false;
  manager.measure = async (path) => {
    assert.ok(!existsSync(join(manager.root, 'state.lock')));
    if (path === join(manager.root, 'worktrees')) {
      scans++;
      if (!changed) { changed = true; await manager.locked(() => manager.write({ ...manager.record(other.id), state: 'failed' })); }
    }
    return 0;
  };
  assert.equal((await create('retry-create')).state, 'active'); assert.equal(scans, 2);
  scans = 0;
  manager.measure = async (path) => {
    if (path === join(manager.root, 'worktrees')) {
      scans++;
      await manager.locked(() => { const row = manager.record(other.id); manager.write({ ...row, state: row.state === 'failed' ? 'active' : 'failed' }); });
    }
    return 0;
  };
  await assert.rejects(create('churning-create'), StaleWorkspaceSnapshotError);
  assert.equal(scans, 3); assert.ok(!manager.records().some((item) => item.id === 'churning-create'));
  manager.measure = async () => { throw new Error('unknown measurement'); };
  await assert.rejects(create('unknown-create'), /Disk measurement failed \(create/);
});

test('CLI exposes no-disk status and bulk close flags, and requires an explicit close target', async () => {
  const { manager } = fixture();
  await manager.configure({ minFreeBytes: 1 });
  const cli = fileURLToPath(new URL('../scripts/fleet-workspace.mjs', import.meta.url));
  const call = (...args) => spawnSync(process.execPath, [cli, '--root', manager.root, ...args], { encoding: 'utf8' });
  const status = call('status', '--no-disk');
  assert.equal(status.status, 0, status.stderr); assert.ok(!Object.hasOwn(JSON.parse(status.stdout), 'managedReportedBytes'));
  const close = call('close', '--all-landed', '--dry-run', '--idle-minutes', '10');
  assert.equal(close.status, 0, close.stderr); assert.equal(JSON.parse(close.stdout).idleMinutes, 10);
  assert.equal(JSON.parse(call('close', '--all-landed', '--dry-run').stdout).idleMinutes, 30);
  for (const args of [['close'], ['close', '--all-landed', '--id', 'x'], ['close', '--id', 'x', '--idle-minutes', '1'], ['close', '--all-landed', '--idle-minutes', 'invalid']]) {
    assert.equal(call(...args).status, 1, args.join(' '));
  }
  const help = call('--help'); assert.match(help.stdout, /--all-landed/); assert.match(help.stdout, /--no-disk/);
});

test('missing folders are non-fatal and reconcile frees writer slots without deleting anything', async () => {
  const { manager, repo, create, folder } = fixture();
  await manager.configure({ maxWriters: 2 });
  await create('retired-gone');
  await manager.close('retired-gone');
  const gone = await create('gone'); await create('kept');
  // Another agent removed folders out from under the registry.
  const moved = join(folder, 'moved-away'); git(repo, 'worktree', 'move', gone.path, moved);
  rmSync(manager.record('retired-gone').path, { recursive: true });
  const status = await manager.status();
  assert.deepEqual(status.workspaces.find((item) => item.id === 'gone').blockers, ['missing-worktree']);
  assert.equal((await manager.gc()).workspaces.find((item) => item.id === 'retired-gone').action, 'record-only');
  await assert.rejects(create('third'), /limit reached/);
  assert.equal((await manager.run({ repo, argv: [process.execPath, '-e', ''] })).exitCode, 0, 'managed commands still admit');

  const preview = await manager.reconcile({ dryRun: true });
  assert.deepEqual(preview.changes.map((item) => [item.id, item.action]).sort(), [['gone', 'mark-missing'], ['retired-gone', 'report-retired-folder-missing']]);
  assert.equal(manager.record('gone').state, 'active');
  await manager.reconcile();
  assert.equal(manager.record('gone').state, 'missing');
  assert.equal(manager.record('gone').missingFrom, 'active');
  assert.equal(manager.record('kept').state, 'active');
  assert.ok(existsSync(join(moved, 'source.txt')), 'reconcile never touches relocated source');
  assert.equal(git(repo, 'rev-parse', '--verify', 'agent/gone').length, 40, 'branch retained');
  await assert.rejects(manager.heartbeat('gone'), /Only active/);
  await assert.rejects(manager.close('gone'), /Only active/);
  const third = await create('third');
  assert.equal(third.state, 'active');
  assert.equal((await manager.gc()).workspaces.find((item) => item.id === 'gone').action, 'record-only');
  assert.deepEqual((await manager.reconcile({ dryRun: true })).changes.map((item) => item.id), ['retired-gone']);
});

test('disk measurement tolerates entries vanishing mid-scan but not other du errors', async () => {
  assert.equal(vanishedOnly('du: /x/y: No such file or directory\n'), true);
  assert.equal(vanishedOnly('du: fts_read: No such file or directory'), true);
  assert.equal(vanishedOnly('du: /x/y: Permission denied\ndu: /x/z: No such file or directory'), false);
  assert.equal(vanishedOnly(''), false);
});
