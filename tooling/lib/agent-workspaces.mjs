import {
  existsSync, mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync,
  readdirSync, unlinkSync, realpathSync, statSync, statfsSync, chmodSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { coordinatedRetiredBytes } from './disk-scan-coordination.mjs';

export class StaleWorkspaceSnapshotError extends Error {
  constructor() {
    super('Workspace identities changed during disk measurement; retry with a fresh measurement.');
    this.name = 'StaleWorkspaceSnapshotError';
  }
}

export const GiB = 1024 ** 3;
export const defaults = Object.freeze({
  storeDir: join(homedir(), 'Library', 'pnpm', 'store'),
  packageImportMethod: process.platform === 'darwin' ? 'clone' : 'auto',
  maxStoreBytes: 20 * GiB, storePnpmVersion: '10.33.2',
  maxWriters: 8, maxHeavyJobs: 2, maxWorkspaceBytes: 8 * GiB,
  maxTotalBytes: 40 * GiB, minFreeBytes: 20 * GiB, staleHours: 24,
});
const exactPnpmPin = /^pnpm@\d+\.\d+\.\d+(?:\+sha\d+\.[a-f0-9]+)?$/;

function independentPackageDirectory(root, relative) {
  if (typeof relative !== 'string' || isAbsolute(relative) || /[\\:]/.test(relative) ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('--package-dir requires a relative child directory without traversal.');
  }
  let target = root;
  for (const part of relative.split('/')) {
    target = join(target, part);
    const entry = lstatSync(target);
    if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error('--package-dir must contain only real directories, not symlinks.');
  }
  let ownWorkspace;
  try { ownWorkspace = lstatSync(join(target, 'pnpm-workspace.yaml')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (ownWorkspace) {
    if (ownWorkspace.isSymbolicLink() || !ownWorkspace.isFile()) {
      throw new Error('--package-dir requires a regular pnpm-workspace.yaml for its own workspace boundary.');
    }
    // pnpm resolves this boundary before any ancestor workspace. Keep the root
    // writer lease while using the child's existing pin, lockfile and modules.
    return target;
  }
  for (let parent = dirname(target); ; parent = dirname(parent)) {
    let workspace;
    try { workspace = lstatSync(join(parent, 'pnpm-workspace.yaml')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (workspace) throw new Error('--package-dir cannot inherit a parent pnpm workspace.');
    if (parent === dirname(parent)) break;
  }
  return target;
}
export const defaultRoot = join(homedir(), 'Library', 'Application Support', 'Fleet', 'Agent Workspaces.noindex');

function command(bin, args, cwd) {
  const result = spawnSync(bin, args, {
    cwd, encoding: 'utf8', timeout: bin === 'du' || (bin === 'git' && args[0] === 'worktree' && args[1] === 'remove') ? 180_000 : 60_000, maxBuffer: 32 * 1024 ** 2,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', COREPACK_ENABLE_AUTO_PIN: '0' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${bin} ${args[0]} failed: ${result.error?.message ?? result.stderr.trim()}`);
  }
  return result.stdout.trim();
}
const git = (repo, ...args) => command('git', args, repo);
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const now = () => new Date().toISOString();
function validatePolicy(value) {
  if (Object.keys(value).some((key) => !Object.hasOwn(defaults, key))) throw new Error('Unknown workspace policy setting.');
  const policy = { ...defaults, ...value };
  if (!['clone', 'auto'].includes(policy.packageImportMethod)) throw new Error('packageImportMethod must be clone or auto; plain copies and mutable shared node_modules are not supported.');
  if (!/^\d+\.\d+\.\d+$/.test(policy.storePnpmVersion)) throw new Error('storePnpmVersion requires an exact pnpm version.');
  if (typeof policy.storeDir !== 'string' || !policy.storeDir.startsWith('/') || policy.storeDir.includes('\0')) throw new Error('storeDir must be an absolute persistent path.');
  let ancestor = resolve(policy.storeDir);
  const tail = [];
  while (!existsSync(ancestor)) { tail.unshift(ancestor.split(sep).at(-1)); ancestor = dirname(ancestor); }
  const storePath = resolve(realpathSync(ancestor), ...tail);
  if ([resolve('/tmp'), '/private/tmp', '/var/folders', '/private/var/folders'].some((path) => storePath === path || storePath.startsWith(`${path}/`))) {
    throw new Error('The shared pnpm store cannot live in a temporary folder.');
  }
  for (const [key, value] of Object.entries(policy)) {
    if (!['storeDir', 'packageImportMethod', 'storePnpmVersion'].includes(key) && (!Number.isSafeInteger(value) || value < 1)) throw new Error(`Invalid policy value: ${key}`);
  }
  return policy;
}
function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  renameSync(temporary, path);
}
function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
function processIdentities(pid, group = false) {
  // Darwin ps provides second-resolution process births. Other platforms and
  // failed/ambiguous observations stay unknown, never evidence of a dead job.
  if (process.platform !== 'darwin') return null;
  const result = spawnSync('ps', [group ? '-g' : '-p', String(pid), '-o', 'pid=,pgid=,lstart='], {
    encoding: 'utf8', timeout: 2_000, maxBuffer: 1024 ** 2,
    env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
  });
  if (result.error || result.status !== 0) return null;
  const rows = result.stdout.trim().split('\n').filter(Boolean).map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) return null;
    const bornAt = Date.parse(`${match[3]} UTC`);
    return Number.isFinite(bornAt) ? { pid: Number(match[1]), pgid: Number(match[2]), bornAt } : null;
  });
  return rows.length && rows.every(Boolean) ? rows : null;
}
export function jobAlive(job, { probe = alive, identities = processIdentities } = {}) {
  const startedAt = Date.parse(job.startedAt);
  // Historical leases lack exact child births. Preserve a conservative minute
  // for ps precision and a stalled immediate spawn; near-time reuse remains
  // unknown/protected rather than incorrectly discarding a legitimate orphan.
  const latestBirth = startedAt + 60_000;
  const identity = (pid) => Number.isFinite(startedAt) ? identities(pid)?.find((row) => row.pid === pid) : null;
  if (probe(job.pid)) {
    const manager = identity(job.pid);
    if (!manager || !Number.isFinite(manager.bornAt) || manager.bornAt <= latestBirth) return true;
  }
  let child;
  if (probe(job.childPid)) {
    child = identity(job.childPid);
    if (!child || !Number.isFinite(child.bornAt) || child.bornAt <= latestBirth) return true;
  }
  if (!Number.isInteger(job.childPid) || job.childPid < 1 || process.platform === 'win32') return false;
  // Keep legitimate orphan groups, including late-born descendants, when the
  // original leader is absent. Reject reuse only with a proven new leader AND
  // an entirely new group; missing identity/membership evidence fails closed.
  const groupAlive = probe !== alive ? probe(-job.childPid) : (() => {
    try { process.kill(-job.childPid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
  })();
  if (!groupAlive) return false;
  if (child && child.bornAt > latestBirth && child.pgid === job.childPid) {
    const members = identities(job.childPid, true);
    if (members?.length && members.every((row) => row && Number.isFinite(row.bornAt) && row.pgid === job.childPid && row.bornAt > latestBirth)) return false;
  }
  return true;
}
// `du` exits non-zero when an entry disappears while it walks the tree (another
// agent retiring or trashing a folder). Accept a total only when every
// diagnostic is such a vanished-entry report; permission and other errors
// still fail closed.
export function vanishedOnly(stderr) {
  const lines = String(stderr ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every((line) => /^du: .*(?:No such file or directory|fts_read)/.test(line));
}
function duBytes(path) {
  const result = spawnSync('du', ['-sk', path], { encoding: 'utf8', timeout: 180_000, maxBuffer: 32 * 1024 ** 2 });
  if (result.error) throw new Error(`du -sk failed: ${result.error.message}`);
  const bytes = Number(result.stdout.trim().split(/\s/)[0]) * 1024;
  if (result.status !== 0 && !(vanishedOnly(result.stderr) && result.stdout.trim())) throw new Error(`du -sk failed: ${result.stderr.trim()}`);
  return bytes;
}
function requireBytes(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label} disk measurement`);
  return value;
}
export function diskBytes(path) {
  if (!existsSync(path)) throw new Error(`Missing path: ${path}`);
  return requireBytes(duBytes(path), 'workspace');
}
// Complete, bounded measurement: no cached totals or retired-worktree exclusions.
export function diskBytesAsync(path, { signal } = {}) {
  // `existsSync` follows links and would misclassify a dangling retired alias;
  // `du` still counts the symlink itself, so only a missing directory entry fails.
  try { lstatSync(path); }
  catch (error) { return Promise.reject(error.code === 'ENOENT' ? new Error(`Missing path: ${path}`) : error); }
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((done, fail) => {
    const child = spawn('du', ['-sk', path], { stdio: ['ignore', 'pipe', 'pipe'], signal, killSignal: 'SIGKILL' });
    let stdout = ''; let stderr = ''; let failure; let spawnFailure;
    const timer = setTimeout(() => {
      failure = new Error('du -sk timed out after 180000ms');
      failure.code = 'ETIMEDOUT'; child.kill('SIGKILL');
    }, 180_000);
    for (const [stream, collect] of [[child.stdout, (part) => { stdout += part; }], [child.stderr, (part) => { stderr += part; }]]) {
      stream.on('data', (part) => {
        collect(part);
        if (stdout.length + stderr.length > 32 * 1024 ** 2 && !failure) {
          failure = new Error('du -sk output exceeded its buffer limit'); child.kill('SIGKILL');
        }
      });
    }
    // Wait for close after cancellation: rejecting on the earlier error event
    // could release admission while a killed du child is still being reaped.
    child.once('error', (error) => { spawnFailure = error; });
    child.once('close', (code) => {
      clearTimeout(timer);
      const bytes = Number(stdout.trim().split(/\s/)[0]) * 1024;
      if (spawnFailure) fail(spawnFailure);
      else if (failure) fail(failure);
      else if (code !== 0 && !(vanishedOnly(stderr) && stdout.trim())) fail(new Error(`du -sk failed (${code}): ${stderr.trim()}`));
      else if (!stdout.trim() || !Number.isSafeInteger(bytes) || bytes < 0) fail(new Error('du -sk returned an invalid measurement'));
      else done(bytes);
    });
  });
}
// Retired trees are never omitted from admission. Scan their immediate entries
// fresh with bounded fan-out; separate `du` calls can only overcount shared
// hardlinks, so their sum is a conservative total-budget measurement.
export async function retiredBytesAsync(path, { concurrency = 4, timeoutMs = 180_000 } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Invalid retired scan concurrency.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180_000) throw new Error('Invalid retired scan timeout.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Retired disk scan timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (controller.signal.aborted) throw controller.signal.reason;
      const before = lstatSync(path, { bigint: true });
      if (!before.isDirectory() || before.isSymbolicLink()) throw new Error(`Unsafe retired directory: ${path}`);
      const entries = readdirSync(path).sort();
      let next = 0;
      const sizes = new Array(entries.length);
      const scans = await Promise.allSettled(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
        while (next < entries.length) {
          const index = next++;
          sizes[index] = await diskBytesAsync(join(path, entries[index]), { signal: controller.signal });
        }
      }));
      if (controller.signal.aborted) throw controller.signal.reason;
      const after = lstatSync(path, { bigint: true });
      const changed = before.dev !== after.dev || before.ino !== after.ino || before.mtimeNs !== after.mtimeNs ||
        before.ctimeNs !== after.ctimeNs || entries.join('\0') !== readdirSync(path).sort().join('\0');
      if (changed) {
        if (attempt < 3) continue;
        throw new Error('Retired directory changed during three complete disk measurements.');
      }
      const failure = scans.find((scan) => scan.status === 'rejected');
      if (failure) throw failure.reason;
      // `du -sk` includes the directory inode. st_blocks uses 512-byte units.
      const directoryBytes = requireBytes(Number(((before.blocks + 1n) / 2n) * 1024n), 'retired directory');
      return requireBytes(sizes.reduce((sum, bytes) => requireBytes(sum + bytes, 'retired'), directoryBytes), 'retired');
    }
  } finally { clearTimeout(timer); }
}
function combinedError(primary, cleanup) {
  return new AggregateError([primary, cleanup], `${primary.message}; cleanup also failed: ${cleanup.message}`, { cause: primary });
}
function validateId(id) {
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(id ?? '')) throw new Error('Use a short lowercase workspace ID without slashes.');
  return id;
}
function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) throw new Error(`${label} is required (1–500 characters).`);
  return value;
}
function openFileCount(path) {
  // Enumerate names once, then filter in memory; never publish other processes' paths.
  const result = spawnSync('lsof', ['-n', '-P', '-F', 'n'], { encoding: 'utf8', timeout: 30_000, maxBuffer: 64 * 1024 ** 2 });
  if (result.error || result.status !== 0) throw new Error('Cannot verify open files with lsof; keep the workspace.');
  return result.stdout.split('\n').filter((line) => line === `n${path}` || line.startsWith(`n${path}${sep}`)).length;
}
function storeWriters() {
  const result = spawnSync('ps', ['-axo', 'pid=,args='], { encoding: 'utf8', timeout: 5_000, maxBuffer: 16 * 1024 ** 2 });
  if (result.error || result.status !== 0) throw new Error('Cannot verify external pnpm processes; keep the shared store.');
  // Inspect locally; never return process arguments or environment values.
  return result.stdout.split('\n').filter((line) => Number(line.trim().split(/\s/)[0]) !== process.pid
    && /(?:^|[\/\s])(?:pnpm(?:\.[cm]?js)?(?:@\d+\.\d+\.\d+)?|corepack(?:\.[cm]?js)?)(?=\s|$)/.test(line)).length;
}
async function pruneNativeStore(policy, root, onSpawn) {
  const child = spawn('corepack', [`pnpm@${policy.storePnpmVersion}`, 'store', 'prune', '--store-dir', policy.storeDir], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, COREPACK_ENABLE_AUTO_PIN: '0', COREPACK_ENABLE_NETWORK: '0' },
  });
  let output = ''; let failure;
  const completion = new Promise((done, fail) => {
    child.once('error', fail);
    child.once('close', (code) => code === 0 && !failure ? done() : fail(failure ?? new Error('Native pnpm store prune failed; inspect maintenance before retrying.')));
  });
  completion.catch(() => {});
  const timer = setTimeout(() => { failure = new Error('Native pnpm store prune timed out.'); child.kill('SIGKILL'); }, 180_000);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (part) => {
    output += part;
    if (output.length > 1024 ** 2) { failure = new Error('Native pnpm store prune exceeded its output bound.'); child.kill('SIGKILL'); }
  });
  try { await onSpawn(child.pid); await completion; }
  catch (error) { child.kill('SIGKILL'); await completion.catch(() => {}); throw error; }
  finally { clearTimeout(timer); }
}
async function mapBounded(items, action, limit = 4) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await action(items[index]);
    }
  }));
  return results;
}
function acceptLandedBranch(info) {
  if (info.blockers.includes('branch-changed') && info.remoteRefs !== undefined
    && !info.blockers.some((item) => item === 'dirty-or-untracked' || item === 'head-not-in-local-remote-refs' || item.startsWith('git-state-unknown:'))) {
    info.blockers = info.blockers.filter((item) => item !== 'branch-changed');
    info.notes.push(`Recorded branch ${info.branch} changed to ${info.branchNow ?? 'detached HEAD'}; current HEAD is clean and landed.`);
  }
}

function regularFile(path) {
  try { return lstatSync(path).isFile(); }
  catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false; throw error; }
}

function packageInstallRoot(parent, repo) {
  for (let current = parent; ; current = dirname(current)) {
    if (regularFile(join(current, 'package.json')) && (regularFile(join(current, 'node_modules', '.modules.yaml')) || regularFile(join(current, 'node_modules', '.package-lock.json')))) return current;
    if (current === repo || current === dirname(current)) return null;
  }
}

function generatedHusky(parent, repo) {
  const installRoot = packageInstallRoot(parent, repo);
  if (!installRoot) return false;
  const root = join(parent, '.husky', '_');
  if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) return false;
  const runtime = join(installRoot, 'node_modules', 'husky', 'husky');
  if (!regularFile(runtime) || !regularFile(join(root, 'h'))) return false;
  if (!readFileSync(runtime).equals(readFileSync(join(root, 'h')))) return false;
  const wrappers = new Set(['applypatch-msg', 'pre-applypatch', 'post-applypatch', 'pre-commit', 'pre-merge-commit', 'prepare-commit-msg', 'commit-msg', 'post-commit', 'pre-rebase', 'post-checkout', 'post-merge', 'pre-push', 'pre-auto-gc', 'post-rewrite', 'sendemail-validate']);
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (!regularFile(path)) return false;
    const content = readFileSync(path, 'utf8');
    if (name === 'h') continue;
    if (name === '.gitignore' && content.trim() === '*') continue;
    if (name === 'husky.sh' && content === "echo \"husky - DEPRECATED\n\nPlease remove the following two lines from $0:\n\n#!/usr/bin/env sh\n. \\\"\\$(dirname -- \\\"\\$0\\\")/_/husky.sh\\\"\n\nThey WILL FAIL in v10.0.0\n\"") continue;
    if (wrappers.has(name) && content.trim() === '#!/usr/bin/env sh\n. "$(dirname "$0")/h"') continue;
    return false;
  }
  return true;
}

// Git worktree remove also deletes ignored files, even without --force.
// Only known generated directories with an owning build/package manifest are
// disposable. Local databases, env files, evidence and other ignored data block.
function disposableIgnored(repo) {
  const ignored = git(repo, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z').split('\0').filter(Boolean);
  const artifacts = new Set(); const unknown = []; const husky = new Map();
  for (const path of ignored) {
    const parts = path.replace(/\/$/, '').split('/');
    let artifact;
    for (let index = 0; index < parts.length; index++) {
      const name = parts[index];
      const parent = join(repo, ...parts.slice(0, index));
      const root = join(parent, name);
      let directory;
      try { directory = lstatSync(root).isDirectory(); } catch { directory = false; }
      if (!directory) continue;
      if (name === 'node_modules' && regularFile(join(parent, 'package.json'))
        && packageInstallRoot(parent, repo)) artifact = parts.slice(0, index + 1).join('/');
      if (name === '.husky') {
        const collapsed = parts[index + 1] === undefined && readdirSync(root).every((entry) => entry === '_');
        if (parts[index + 1] === '_' || collapsed) {
          if (!husky.has(parent)) husky.set(parent, generatedHusky(parent, repo));
          if (husky.get(parent)) artifact = parts.slice(0, index + (collapsed ? 1 : 2)).join('/');
        }
      }
      if (name === '.build' && regularFile(join(parent, 'Package.swift'))) {
        // SwiftPM checkouts are source repositories. A local edit there is
        // unknown work, even though the enclosing build directory is ignored.
        const checkouts = join(root, 'checkouts');
        let clean = true;
        if (existsSync(checkouts)) {
          if (!lstatSync(checkouts).isDirectory() || lstatSync(checkouts).isSymbolicLink()) clean = false;
          else for (const entry of readdirSync(checkouts)) {
            const checkout = join(checkouts, entry);
            try {
              if (lstatSync(checkout).isSymbolicLink() || git(checkout, 'rev-parse', '--show-toplevel') !== realpathSync(checkout)
                || git(checkout, 'status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching')
                || !git(checkout, 'for-each-ref', '--format=%(refname)', '--contains', 'HEAD', 'refs/remotes/', 'refs/tags/')) clean = false;
            } catch { clean = false; }
          }
        }
        if (clean) artifact = parts.slice(0, index + 1).join('/');
      }
      if (name === 'target' && regularFile(join(parent, 'Cargo.toml'))) artifact = parts.slice(0, index + 1).join('/');
      if (['.next', '.nuxt', '.svelte-kit', '.astro', '.turbo', '.vite', 'dist', 'build', 'coverage', '.output'].includes(name)
        && regularFile(join(parent, 'package.json'))) {
        const manifest = json(join(parent, 'package.json'));
        if (typeof manifest.scripts?.build === 'string' || typeof manifest.scripts?.test === 'string') artifact = parts.slice(0, index + 1).join('/');
      }
      if (artifact) break;
    }
    if (artifact) artifacts.add(artifact);
    else unknown.push(path);
  }
  return { ignoredArtifacts: [...artifacts].sort(), unknownIgnored: unknown };
}

export class AgentWorkspaces {
  constructor({ root = defaultRoot, measure = diskBytes, freeBytes, openFiles = openFileCount, gh = (args, repo) => command('gh', args, repo), externalStoreWriters = storeWriters, pruneStore = pruneNativeStore } = {}) {
    this.root = resolve(root);
    this.measure = measure;
    this.freeBytes = freeBytes ?? (() => { const fs = statfsSync(this.root); return fs.bavail * fs.bsize; });
    this.openFiles = openFiles;
    this.gh = gh;
    this.externalStoreWriters = externalStoreWriters;
    this.pruneNativeStore = pruneStore;
  }
  initialize() {
    if (this.root === sep || this.root === homedir() || existsSync(join(this.root, '.git'))) throw new Error('Choose a dedicated private state directory outside a Git checkout.');
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    for (const path of [this.root, ...['manifests', 'worktrees', 'retired', 'jobs', 'receipts'].map((name) => join(this.root, name))]) {
      mkdirSync(path, { recursive: true, mode: 0o700 });
      const state = lstatSync(path);
      if (state.isSymbolicLink() || !state.isDirectory()) throw new Error(`Unsafe state directory: ${path}`);
      if ((state.mode & 0o7777) !== 0o700) chmodSync(path, 0o700);
    }
    const instructions = join(this.root, 'AGENTS.md');
    if (!existsSync(instructions)) {
      try {
        writeFileSync(instructions, `# Managed agent workspaces\n\nRead the owning repository's AGENTS.md before work. Use fleet-workspace for\nwriter creation, pinned frozen pnpm installs, heavy commands and task closeout.\nRead ${fileURLToPath(new URL('../docs/agent-workspaces.md', import.meta.url))}.\nReview-only agents reuse source. Do not create per-task stores or copy build/\ndependency folders. Respect shared limits and heartbeat long idle tasks.\nClose deletes only verified clean merged work and recognized generated output;\nunknown, dirty or active work stays protected. Use gc --dry-run then gc --apply\nfor old retained checkouts; --retain is explicit. Do not commit, push,\ndeploy, migrate or release unless the owner explicitly requested it.\n`, { flag: 'wx', mode: 0o600 });
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
  }
  async locked(fn) {
    this.initialize();
    const path = join(this.root, 'state.lock');
    const token = randomUUID();
    const deadline = Date.now() + 15_000;
    while (true) {
      try {
        writeFileSync(path, JSON.stringify({ pid: process.pid, token, createdAt: now() }), { flag: 'wx', mode: 0o600 });
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if (Date.now() > deadline) throw new Error('Workspace registry is locked. Inspect state.lock; preserve it before repairing a crashed owner.');
        await new Promise((done) => setTimeout(done, 40));
      }
    }
    try { return await fn(); }
    finally { if (json(path).token === token) unlinkSync(path); }
  }
  policy() {
    const path = join(this.root, 'policy.json');
    return validatePolicy(existsSync(path) ? json(path) : {});
  }
  async configure(patch) {
    return this.locked(() => {
      const checked = validatePolicy({ ...this.policy(), ...patch });
      save(join(this.root, 'policy.json'), checked);
      return checked;
    });
  }
  records() {
    if (!existsSync(join(this.root, 'manifests'))) return [];
    return readdirSync(join(this.root, 'manifests')).filter((name) => name.endsWith('.json')).map((name) => {
      const row = json(join(this.root, 'manifests', name));
      validateId(row.id);
      const fields = ['schemaVersion', 'id', 'repo', 'commonDir', 'path', 'owner', 'task', 'branch', 'baseSha', 'state', 'createdAt', 'heartbeatAt', 'closedAt', 'lastCommandAt', 'lastExitCode', 'missingAt', 'missingFrom'];
      if (Object.keys(row).some((key) => !fields.includes(key)) || name !== `${row.id}.json` || row.schemaVersion !== 1 || !['creating', 'active', 'failed', 'closed', 'missing'].includes(row.state)) throw new Error('Invalid workspace manifest.');
      requireText(row.owner, 'manifest owner'); requireText(row.task, 'manifest task');
      if (typeof row.repo !== 'string' || !row.repo.startsWith('/') || typeof row.commonDir !== 'string' || !row.commonDir.startsWith('/') || !Number.isFinite(Date.parse(row.heartbeatAt))) throw new Error('Invalid workspace identity or heartbeat.');
      const expected = join(this.root, row.state === 'closed' ? 'retired' : 'worktrees', row.id);
      if (row.path !== expected || (existsSync(row.path) && lstatSync(row.path).isSymbolicLink())) throw new Error(`Unsafe workspace path for ${row.id}`);
      return row;
    });
  }
  record(id) {
    validateId(id);
    const row = this.records().find((item) => item.id === id);
    if (!row) throw new Error(`Unknown workspace: ${id}`);
    return row;
  }
  write(row) { save(join(this.root, 'manifests', `${row.id}.json`), row); }
  jobs() {
    if (!existsSync(join(this.root, 'jobs'))) return [];
    return readdirSync(join(this.root, 'jobs')).filter((name) => name.endsWith('.json')).map((name) => {
      const row = json(join(this.root, 'jobs', name));
      if (Object.keys(row).some((key) => !['token', 'id', 'repo', 'pid', 'childPid', 'startedAt'].includes(key)) || name !== `${row.token}.json` || !Number.isInteger(row.pid)) throw new Error('Invalid command lease.');
      return row;
    });
  }
  identities() {
    return JSON.stringify(this.records().map(({ id, state, path }) => ({ id, state, path })).sort((a, b) => a.id.localeCompare(b.id)));
  }
  async measureBudgets(path, phase, { includeStore = false } = {}) {
    this.initialize();
    const identities = this.identities();
    const measure = async (target, role) => {
      const started = Date.now();
      try {
        const bytes = await (this.measure === diskBytes
          ? role === 'retired-worktrees' ? coordinatedRetiredBytes(this, target) : diskBytesAsync(target)
          : this.measure(target));
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid disk measurement');
        return bytes;
      } catch (cause) {
        throw new Error(`Disk measurement failed (${phase}, ${role}, ${Date.now() - started}ms): ${cause.message}`, { cause });
      }
    };
    const bytes = existsSync(path) ? await measure(path, 'workspace') : 0;
    const active = await measure(join(this.root, 'worktrees'), 'active-worktrees');
    const retired = await measure(join(this.root, 'retired'), 'retired-worktrees');
    const storeDir = this.policy().storeDir;
    const storeBytes = includeStore && existsSync(storeDir) ? await measure(storeDir, 'shared-pnpm-store') : 0;
    return { bytes, total: active + retired, identities, ...(includeStore ? { storeBytes, storeDir } : {}) };
  }
  validateBudgets(snapshot) {
    requireBytes(snapshot.bytes, 'workspace');
    requireBytes(snapshot.total, 'total');
    const policy = this.policy();
    if (snapshot.storeDir !== undefined && snapshot.storeDir !== policy.storeDir) throw new StaleWorkspaceSnapshotError();
    if (snapshot.storeBytes !== undefined && requireBytes(snapshot.storeBytes, 'shared store') > policy.maxStoreBytes) throw new Error('Shared pnpm store exceeds its cache budget; run fleet-workspace maintain --apply when package jobs are idle.');
    if (snapshot.bytes > policy.maxWorkspaceBytes) throw new Error('Workspace exceeds its disk budget; review its artifacts before starting another command.');
    if (snapshot.total > policy.maxTotalBytes) throw new Error('Managed workspaces exceed the total disk budget (including retired worktrees).');
    if (requireBytes(this.freeBytes(), 'free-space') < policy.minFreeBytes) throw new Error('Available disk space is below the workspace reserve.');
    if (snapshot.identities !== undefined && snapshot.identities !== this.identities()) throw new StaleWorkspaceSnapshotError();
    return snapshot;
  }
  async withFreshBudgets(path, phase, action = () => {}, options = {}) {
    // Only a changed identity snapshot is retriable. Unknown bytes, policy,
    // reserve, lock and command-admission failures remain conservative failures.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const snapshot = await this.measureBudgets(path, phase, options);
      try {
        return await this.locked(() => {
          this.validateBudgets(snapshot);
          return action();
        });
      } catch (error) {
        if (!(error instanceof StaleWorkspaceSnapshotError) || attempt === 3) throw error;
      }
    }
  }
  budgets(path) {
    const bytes = existsSync(path) ? requireBytes(this.measure(path), 'workspace') : 0;
    const total = requireBytes(this.measure(join(this.root, 'worktrees')), 'active-worktrees') + requireBytes(this.measure(join(this.root, 'retired')), 'retired-worktrees');
    return this.validateBudgets({ bytes, total });
  }
  async create({ id, repo, owner, task, base = 'HEAD' }) {
    validateId(id); requireText(owner, 'owner'); requireText(task, 'task');
    repo = realpathSync(resolve(repo));
    const baseSha = git(repo, 'rev-parse', '--verify', '--end-of-options', `${base}^{commit}`);
    const path = join(this.root, 'worktrees', id);
    return this.withFreshBudgets(path, 'create', () => {
      if (this.records().some((row) => row.id === id)) throw new Error('Workspace ID already exists; reuse it or choose another.');
      const policy = this.policy();
      // Closed and reconciled-missing records no longer hold a writer slot.
      if (this.records().filter((row) => !['closed', 'missing'].includes(row.state)).length >= policy.maxWriters) throw new Error('Writer workspace limit reached.');
      if (existsSync(path)) throw new Error('Workspace path already exists.');
      const branch = `agent/${id}`;
      const commonDir = git(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir');
      const row = { schemaVersion: 1, id, repo, commonDir, path, owner, task, branch, baseSha, state: 'creating', createdAt: now(), heartbeatAt: now() };
      this.write(row);
      try {
        git(repo, 'worktree', 'add', '-b', branch, path, baseSha);
        row.state = 'active'; this.write(row);
        return row;
      } catch (error) {
        row.state = 'failed'; this.write(row);
        throw error;
      }
    });
  }
  async heartbeat(id) {
    return this.locked(() => {
      const row = this.record(id);
      if (row.state !== 'active') throw new Error('Only active workspaces can receive heartbeats.');
      row.heartbeatAt = now(); this.write(row); return row;
    });
  }
  async measuredBytes(path, role = 'workspace') {
    return requireBytes(await (this.measure === diskBytes ? diskBytesAsync(path) : this.measure(path)), role);
  }
  async inspect(row, { noDisk = false } = {}) {
    const info = { ...row, reportedBytes: null, blockers: [], notes: [] };
    if (!noDisk && existsSync(row.path)) {
      try { info.reportedBytes = await this.measuredBytes(row.path); }
      catch (error) { if (existsSync(row.path)) throw error; }
    }
    // A missing folder is reported, never fatal: other records stay inspectable.
    if (!existsSync(row.path)) { info.blockers.push('missing-worktree'); return info; }
    try {
      if (!lstatSync(join(row.path, '.git')).isFile()) throw new Error('Not a linked worktree');
      if (git(row.path, 'rev-parse', '--show-toplevel') !== realpathSync(row.path)) throw new Error('Worktree identity mismatch');
      if (git(row.path, 'rev-parse', '--path-format=absolute', '--git-common-dir') !== row.commonDir) throw new Error('Repository identity mismatch');
      info.head = git(row.path, 'rev-parse', 'HEAD');
      const branch = spawnSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd: row.path, encoding: 'utf8' });
      if (branch.error || ![0, 1].includes(branch.status)) throw new Error('Cannot determine current branch');
      info.branchNow = branch.status === 0 ? branch.stdout.trim() : null;
      if (info.branchNow !== row.branch) info.blockers.push('branch-changed');
      if (git(row.path, 'status', '--porcelain=v1', '-z', '--untracked-files=all')) info.blockers.push('dirty-or-untracked');
      const remotes = git(row.path, 'for-each-ref', '--format=%(refname)', '--contains', info.head, 'refs/remotes/').split('\n').filter(Boolean);
      if (!remotes.length) info.blockers.push('head-not-in-local-remote-refs');
      info.remoteRefs = remotes;
    } catch (error) { info.blockers.push(`git-state-unknown: ${error.message}`); }
    if (this.jobs().some((job) => (job.id === row.id || job.repo === realpathSync(row.path)) && jobAlive(job))) info.blockers.push('command-running');
    acceptLandedBranch(info);
    return info;
  }
  async status({ noDisk = false } = {}) {
    const policy = this.policy();
    const rows = this.records();
    const measurements = noDisk || !existsSync(join(this.root, 'worktrees')) ? [] : [
      () => this.measuredBytes(join(this.root, 'worktrees'), 'active-worktrees'),
      () => this.measuredBytes(join(this.root, 'retired'), 'retired-worktrees'),
    ];
    const results = await mapBounded([...measurements, ...rows.map((row) => async () => {
      const info = await this.inspect(row, { noDisk });
      info.stale = Date.now() - Date.parse(row.heartbeatAt) > policy.staleHours * 3_600_000;
      if (!noDisk) info.overBudget = info.reportedBytes !== null && info.reportedBytes > policy.maxWorkspaceBytes;
      return info;
    })], (scan) => scan());
    const status = { policy, workspaces: results.slice(measurements.length), jobs: this.jobs().map((job) => ({ ...job, running: jobAlive(job) })) };
    if (!noDisk) {
      const freeBytes = existsSync(this.root) ? requireBytes(this.freeBytes(), 'free-space') : null;
      const managedReportedBytes = requireBytes(measurements.length ? results[0] + results[1] : 0, 'total');
      Object.assign(status, { freeBytes, managedReportedBytes, belowFreeSpaceReserve: freeBytes !== null && freeBytes < policy.minFreeBytes, totalOverBudget: managedReportedBytes > policy.maxTotalBytes });
    }
    return status;
  }
  // A squash merge leaves the branch HEAD outside every remote ref. Treat the
  // work as landed when each path the branch changed (since its merge base with
  // the remote default branch) has identical content there, or when the
  // operator names a landed remote commit, or a merged PR contains HEAD.
  async landing(info, landed) {
    const repo = info.path;
    if (landed !== undefined) {
      if (typeof landed !== 'string' || !/^[0-9a-f]{7,64}$/i.test(landed)) throw new Error('--landed must be a commit SHA.');
      const sha = git(repo, 'rev-parse', '--verify', '--end-of-options', `${landed}^{commit}`);
      const refs = git(repo, 'for-each-ref', '--format=%(refname)', '--contains', sha, 'refs/remotes/').split('\n').filter(Boolean);
      if (!refs.length) throw new Error(`Landed commit ${sha} is not contained in a local remote-tracking ref; fetch first.`);
      return { landedBy: 'operator-verified', landedCommit: sha, landedRefs: refs };
    }
    let ref;
    for (const candidate of ['refs/remotes/origin/HEAD', 'refs/remotes/origin/main', 'refs/remotes/origin/master']) {
      const probe = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${candidate}^{commit}`], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
      if (probe.status === 0) { ref = candidate; break; }
    }
    if (ref) {
      if (spawnSync('git', ['merge-base', '--is-ancestor', info.head, ref], { cwd: repo }).status === 0) {
        return { landedBy: 'merged-ancestor', landedRef: ref, landedRefSha: git(repo, 'rev-parse', ref) };
      }
      const base = spawnSync('git', ['merge-base', info.head, ref], { cwd: repo, encoding: 'utf8' });
      if (base.error || ![0, 1].includes(base.status)) throw new Error('Cannot determine landing merge base');
      if (base.status === 0) {
        const changed = git(repo, 'diff', '--name-only', '-z', '--no-renames', base.stdout.trim(), info.head).split('\0').filter(Boolean);
        if (changed.length) {
          const diff = spawnSync('git', ['diff', '--quiet', '--no-renames', ref, info.head, '--', ...changed.map((path) => `:(literal)${path}`)], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
          if (diff.status === 0) return { landedBy: 'content-equal', landedRef: ref, landedRefSha: git(repo, 'rev-parse', ref), changedPaths: changed.length };
          if (diff.status !== 1) throw new Error(`git diff failed: ${diff.stderr.trim()}`);
        }
      }
    }
    for (const branch of new Set([info.branch, info.branchNow].filter(Boolean))) {
      try {
        const prs = JSON.parse(await this.gh(['pr', 'list', '--state', 'merged', '--head', branch, '--json', 'number,mergeCommit,headRefOid,url', '--limit', '5'], repo));
        if (!Array.isArray(prs)) continue;
        for (const pr of prs) {
          if (!Number.isSafeInteger(pr.number) || pr.number < 1 || typeof pr.url !== 'string'
            || !/^[0-9a-f]{40,64}$/i.test(pr.headRefOid ?? '') || !/^[0-9a-f]{40,64}$/i.test(pr.mergeCommit?.oid ?? '')
            || (pr.state !== undefined && pr.state !== 'MERGED')
            || (pr.headRefName !== undefined && pr.headRefName !== branch)) continue;
          // A merged PR may contain HEAD, but HEAD must never be ahead of it.
          if (info.head !== pr.headRefOid && spawnSync('git', ['merge-base', '--is-ancestor', info.head, pr.headRefOid], { cwd: repo }).status !== 0) continue;
          const merge = pr.mergeCommit.oid;
          const probe = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${merge}^{commit}`], { cwd: repo });
          if (probe.error || ![0, 1].includes(probe.status)) continue;
          const available = probe.status === 0;
          const refs = available ? git(repo, 'for-each-ref', '--format=%(refname)', '--contains', merge, 'refs/remotes/').split('\n').filter(Boolean) : [];
          if (available && !refs.length) continue;
          return { landedBy: 'merged-pr', prNumber: pr.number, prUrl: pr.url, headRefOid: pr.headRefOid, landedCommit: merge, landedRefs: refs };
        }
      } catch { /* Missing gh, auth, provider or malformed output supplies no evidence. */ }
    }
    return null;
  }
  async close(id, { dryRun = false, landed, idleMinutes, retain = false } = {}) {
    if (idleMinutes !== undefined && (!Number.isFinite(idleMinutes) || idleMinutes < 0)) throw new Error('--idle-minutes must be a non-negative number.');
    this.initialize();
    const row = this.record(id);
    if (row.state !== 'active' && !(row.state === 'closed' && !retain)) throw new Error('Only active workspaces or retained closed workspaces can be closed.');
    const keep = (info) => {
      if (dryRun) return { ...info, dryRun: true, action: 'keep' };
      const error = new Error('Keeping ' + id + ': ' + info.blockers.join(', '));
      error.blockers = info.blockers; throw error;
    };
    // Fresh tasks cannot qualify. Skip Git/provider/open-file scans entirely.
    if (idleMinutes !== undefined && Date.now() - Date.parse(row.heartbeatAt) <= idleMinutes * 60_000) {
      return keep({ ...row, reportedBytes: null, blockers: ['heartbeat-not-idle'], notes: [] });
    }
    const info = await this.inspect(row, { noDisk: true });
    if (idleMinutes !== undefined && info.blockers.some((item) => item === 'dirty-or-untracked' || item === 'command-running' || item.startsWith('git-state-unknown:') || item === 'missing-worktree')) return keep(info);
    let mergeChecked = false;
    let flagIgnored = landed !== undefined && info.remoteRefs?.length > 0;
    if (info.blockers.includes('head-not-in-local-remote-refs')) {
      mergeChecked = true;
      try {
        let evidence = await this.landing(info);
        flagIgnored = landed !== undefined && evidence !== null;
        if (!evidence && landed !== undefined) evidence = await this.landing(info, landed);
        if (evidence) { info.blockers = info.blockers.filter((item) => item !== 'head-not-in-local-remote-refs'); info.landing = evidence; }
      } catch (error) { info.blockers.push(`landing-unverified: ${error.message}`); }
    }
    if (flagIgnored) info.notes.push('Ignored --landed: current HEAD is already landed.');
    if (!retain) {
      // A pushed feature branch is recoverable, but is not proof of a
      // completed merge. Deletion always needs default-branch/PR evidence.
      try {
        const evidence = info.landing ?? (mergeChecked ? null : await this.landing(info) ?? (landed !== undefined ? await this.landing(info, landed) : null));
        if (evidence) {
          info.landing = evidence;
          info.blockers = info.blockers.filter((item) => item !== 'head-not-in-local-remote-refs');
        } else info.blockers.push('merge-not-verified');
      } catch (error) { info.blockers.push(`merge-unverified: ${error.message}`); }
      try {
        Object.assign(info, disposableIgnored(row.path));
        if (info.unknownIgnored.length) info.blockers.push('unknown-ignored-data');
        // Catch locked worktrees in the preview as well as Git's final check.
        let path;
        for (const field of git(row.repo, 'worktree', 'list', '--porcelain', '-z').split('\0')) {
          if (field.startsWith('worktree ')) path = field.slice(9);
          if (path === realpathSync(row.path) && (field === 'locked' || field.startsWith('locked '))) info.blockers.push('worktree-locked');
        }
        if (git(row.path, 'ls-files', '--stage', '-z').split('\0').some((entry) => entry.startsWith('160000 '))) info.blockers.push('submodules');
      } catch (error) { info.blockers.push(`ignored-data-unknown: ${error.message}`); }
    }
    acceptLandedBranch(info);
    // A known blocker already prohibits deletion; avoid a whole-machine lsof
    // scan for every preserved unknown/unmerged tree on each scheduler tick.
    if (info.blockers.length) return keep(info);
    try { if (this.openFiles(row.path)) info.blockers.push('open-files'); }
    catch (error) { info.blockers.push(error.message); }
    if (dryRun) return { ...info, dryRun: true, action: info.blockers.length ? 'keep' : retain ? 'move-to-retired' : 'delete-worktree' };
    if (info.blockers.length) {
      const error = new Error(`Keeping ${id}: ${info.blockers.join(', ')}`);
      error.blockers = info.blockers; throw error;
    }
    const deletionToken = 'delete-' + randomUUID();
    const deletionLease = join(this.root, 'jobs', deletionToken + '.json');
    const operation = await this.locked(async () => {
      const current = this.record(id);
      if (JSON.stringify(current) !== JSON.stringify(row)) throw new Error('Workspace changed during close checks; inspect it again.');
      const fresh = await this.inspect(current, { noDisk: true });
      const blockers = fresh.blockers.filter((item) => item !== 'head-not-in-local-remote-refs' && item !== 'branch-changed');
      if (fresh.head !== info.head || fresh.branchNow !== info.branchNow) blockers.push('head-or-branch-changed');
      if (!retain && disposableIgnored(row.path).unknownIgnored.length) blockers.push('unknown-ignored-data');
      if (blockers.length) {
        const error = new Error('Keeping ' + id + ': ' + blockers.join(', '));
        error.blockers = blockers; throw error;
      }
      if (!retain) {
        const receipt = { id, owner: row.owner, task: row.task, head: info.head, branch: row.branch, branchNow: info.branchNow, notes: info.notes, landing: info.landing, original: row.path, createdAt: now(), ignoredArtifacts: info.ignoredArtifacts, action: 'delete-worktree', note: 'Merged worktree and recognized generated artifacts deleted with Git. No recovery copy or extra Git history retained.' };
        // Reserve this checkout, then release the registry before potentially
        // slow filesystem removal. Other agents can continue using the tool.
        save(join(this.root, 'receipts', id + '.deletion-pending.json'), receipt);
        save(deletionLease, { token: deletionToken, id, repo: realpathSync(row.path), pid: process.pid, childPid: null, startedAt: now() });
        return receipt;
      }
      const destination = join(this.root, 'retired', row.id);
      if (existsSync(destination)) throw new Error('Retirement path already exists.');
      const receipt = { id, owner: row.owner, task: row.task, head: info.head, branch: row.branch, branchNow: info.branchNow, notes: info.notes, remoteRefs: info.remoteRefs, ...(info.landing ? { landing: info.landing } : {}), original: row.path, retired: destination, createdAt: now(), reportedBytes: info.reportedBytes, restore: ['git', '-C', row.repo, 'worktree', 'move', destination, row.path], note: 'Reversible relocation only; no disk space was reclaimed. All ignored artifacts remain available for review.' };
      save(join(this.root, 'receipts', `${id}.json`), receipt);
      // No force/remove/clean: submodules, locked trees and Git safety failures remain blockers.
      git(row.repo, 'worktree', 'move', row.path, destination);
      row.state = 'closed'; row.path = destination; row.closedAt = now(); this.write(row);
      return receipt;
    });
    if (!retain) {
      try {
        git(row.repo, 'worktree', 'remove', row.path);
        await this.locked(() => {
          const current = this.record(id);
          if (current.path !== row.path || current.commonDir !== row.commonDir) throw new Error('Workspace identity changed; inspect the pending deletion record.');
          save(join(this.root, 'receipts', id + '.json'), operation);
          unlinkSync(join(this.root, 'manifests', id + '.json'));
          unlinkSync(join(this.root, 'receipts', id + '.deletion-pending.json'));
        });
      } finally {
        await this.locked(() => { if (existsSync(deletionLease)) unlinkSync(deletionLease); });
      }
    }
    return operation;
  }
  async closeAllLanded({ dryRun = false, idleMinutes = 30, retain = false } = {}) {
    if (!Number.isFinite(idleMinutes) || idleMinutes < 0) throw new Error('--idle-minutes must be a non-negative number.');
    const closed = []; const kept = [];
    for (const row of this.records().filter((item) => item.state === 'active')) {
      try {
        const result = await this.close(row.id, { dryRun, idleMinutes, retain });
        if (result.action === 'keep') kept.push({ id: row.id, blockers: result.blockers, reason: result.blockers.join(', ') });
        else closed.push({ id: row.id, blockers: [], reason: retain ? dryRun ? 'would-retire' : 'retired' : dryRun ? 'would-delete' : 'deleted' });
      } catch (error) { kept.push({ id: row.id, blockers: error.blockers ?? [], reason: error.message }); }
    }
    return { dryRun, idleMinutes, closed, kept, counts: { closed: closed.length, kept: kept.length, total: closed.length + kept.length } };
  }
  // Mark records whose worktree folder no longer exists as `missing` so they
  // stop holding writer slots. Never deletes, moves or prunes anything; Git's
  // own worktree metadata is left for `git worktree prune` by the repo owner.
  async reconcile({ dryRun = false } = {}) {
    return this.locked(() => {
      const actions = this.records().map((row) => {
        const present = existsSync(row.path);
        if (row.state === 'missing') return { id: row.id, state: row.state, action: present ? 'review-reappeared' : 'none' };
        if (present) return { id: row.id, state: row.state, action: 'none' };
        if (row.state === 'closed') return { id: row.id, state: row.state, path: row.path, action: 'report-retired-folder-missing' };
        return { id: row.id, state: row.state, path: row.path, owner: row.owner, task: row.task, branch: row.branch, action: 'mark-missing' };
      });
      if (!dryRun) {
        for (const item of actions.filter((entry) => entry.action === 'mark-missing')) {
          const row = this.record(item.id);
          if (existsSync(row.path)) { item.action = 'none'; continue; }
          row.missingFrom = row.state; row.state = 'missing'; row.missingAt = now(); this.write(row);
        }
      }
      const changes = actions.filter((entry) => entry.action !== 'none');
      return { dryRun, changes, note: 'Only manifest state changes; no folder, branch or Git metadata is deleted.' };
    });
  }
  async gc({ apply = false, idleMinutes = 30 } = {}) {
    if (!Number.isFinite(idleMinutes) || idleMinutes < 0) throw new Error('--idle-minutes must be a non-negative number.');
    const workspaces = [];
    for (const row of this.records()) {
      if (row.state !== 'closed' || !existsSync(row.path)) {
        workspaces.push({ id: row.id, state: row.state, path: row.path, action: ['closed', 'missing'].includes(row.state) && !existsSync(row.path) ? 'record-only' : 'keep' });
        continue;
      }
      try {
        const result = await this.close(row.id, { dryRun: !apply, idleMinutes });
        workspaces.push({ id: row.id, state: apply ? 'deleted' : row.state, path: row.path, action: result.action, blockers: result.blockers ?? [], unknownIgnored: result.unknownIgnored ?? [] });
      } catch (error) {
        workspaces.push({ id: row.id, state: row.state, path: row.path, action: 'keep', blockers: error.blockers ?? [], reason: error.message });
      }
    }
    return { dryRun: !apply, workspaces, counts: { deleted: apply ? workspaces.filter((row) => row.action === 'delete-worktree').length : 0, eligible: workspaces.filter((row) => row.action === 'delete-worktree').length, kept: workspaces.filter((row) => row.action === 'keep').length }, note: 'Only clean, merged, idle worktrees with recognized disposable output qualify. Unknown data and active work are preserved; no disk scan or recovery copy.' };
  }
  async pruneStore({ apply = false } = {}) {
    this.initialize();
    const policy = this.policy();
    const beforeBytes = existsSync(policy.storeDir) ? await this.measuredBytes(policy.storeDir, 'shared store') : 0;
    const statePath = join(this.root, 'storage-maintenance.json');
    const previous = existsSync(statePath) ? json(statePath) : {};
    const overBudget = beforeBytes > policy.maxStoreBytes;
    const result = { storeDir: policy.storeDir, reportedBytesBefore: beforeBytes, maxStoreBytes: policy.maxStoreBytes, overBudget, action: 'keep' };
    // APFS clones have independent inodes. PNPM 10's native prune uses link
    // counts, so a timed prune can evict still-useful shared package contents.
    // Preserve the warm store until its byte budget actually requires eviction.
    if (!overBudget || !existsSync(policy.storeDir)) return { ...result, reason: 'Cache is within budget; reusable shared packages stay warm.' };
    if (!apply) return { ...result, action: 'would-prune', reason: 'Native pnpm prune only; no arbitrary cache file deletion.' };
    const token = 'storage-' + randomUUID();
    // Fill the existing heavy lease pool too: an older CLI already measuring
    // admission must also wait, even before it knows the storage-token rule.
    const leases = Array.from({ length: policy.maxHeavyJobs }, (_, index) => ({
      token: token + '-' + index, path: join(this.root, 'jobs', token + '-' + index + '.json'),
    }));
    try {
      const reserved = await this.locked(() => {
        if (this.policy().storeDir !== policy.storeDir) throw new Error('Shared store changed during maintenance.');
        if (this.jobs().some(jobAlive)) return false;
        if (this.externalStoreWriters()) return false;
        for (const lease of leases) save(lease.path, { token: lease.token, id: null, repo: policy.storeDir, pid: process.pid, childPid: null, startedAt: now() });
        return true;
      });
      if (!reserved) return { ...result, reason: 'Package or managed commands are active; maintenance will retry later.' };
      await this.pruneNativeStore(policy, this.root, async (pid) => {
        await this.locked(() => { for (const lease of leases) save(lease.path, { ...json(lease.path), childPid: pid ?? null }); });
      });
      const afterBytes = await this.measuredBytes(policy.storeDir, 'shared store');
      const lastPrunedAt = now();
      save(statePath, { ...previous, lastPrunedAt });
      return { ...result, action: 'pruned', reportedBytesAfter: afterBytes, overBudget: afterBytes > this.policy().maxStoreBytes, lastPrunedAt,
        note: 'Reported allocation is not physical recovery. Missing cached packages are downloaded on demand.' };
    } finally {
      await this.locked(() => { for (const lease of leases) if (existsSync(lease.path)) unlinkSync(lease.path); });
    }
  }
  async maintain({ apply = false, idleMinutes = 1440 } = {}) {
    const startedAt = now();
    const closed = await this.closeAllLanded({ dryRun: !apply, idleMinutes });
    const retired = await this.gc({ apply, idleMinutes });
    let store;
    try { store = await this.pruneStore({ apply }); }
    catch (error) { store = { action: 'keep', error: error.message }; }
    const result = { startedAt, finishedAt: now(), dryRun: !apply, idleMinutes, closed, retired, store,
      ...(apply && (store.error || store.overBudget) ? { exitCode: 1 } : {}) };
    if (apply) {
      const path = join(this.root, 'storage-maintenance.json');
      const previous = existsSync(path) ? json(path) : {};
      save(path, { ...previous, latest: result });
    }
    return result;
  }
  async install({ id, repo, offline = false }) {
    if (id) {
      const row = this.record(id);
      if (row.state !== 'active') throw new Error('Install requires an active workspace.');
      repo = row.path;
    }
    repo = realpathSync(resolve(repo));
    for (const path of [join(repo, 'node_modules'), join(repo, 'node_modules', '.pnpm')]) {
      if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Keep a separate node_modules layout in each checkout; a shared mutable directory is not supported.');
    }
    const manifest = json(join(repo, 'package.json'));
    const packageManager = manifest.packageManager;
    if (exactPnpmPin.test(packageManager ?? '')) {
      if (!existsSync(join(repo, 'pnpm-lock.yaml'))) throw new Error('Requires a pnpm lockfile; do not generate or replace a lockfile during agent setup.');
      const storeDir = this.policy().storeDir;
      mkdirSync(storeDir, { recursive: true });
      if (statSync(storeDir).dev !== statSync(repo).dev) throw new Error('The shared store and checkout must use the same filesystem.');
      await this.pruneStore({ apply: true });
      const args = ['pnpm', 'install', '--frozen-lockfile', '--store-dir', storeDir, '--package-import-method', this.policy().packageImportMethod, '--config.modules-cache-max-age=0'];
      if (offline) args.push('--offline');
      return this.run({ id, repo, argv: ['corepack', ...args], installing: true });
    }
    if (/^pnpm(?:@|$)/.test(packageManager ?? '')) throw new Error('Requires an exact pnpm packageManager pin; do not switch managers during agent setup.');
    const npmPin = packageManager?.match(/^npm@(\d+\.\d+\.\d+)$/)?.[1];
    if (packageManager !== undefined && !npmPin) throw new Error('Unsupported packageManager; preserve the repository manager instead of implicitly migrating.');
    const lockPath = join(repo, 'package-lock.json');
    let lock;
    try {
      if (!lstatSync(lockPath).isFile()) throw new Error('not a regular file');
      lock = json(lockPath);
    } catch { throw new Error('Requires a valid existing npm package-lock.json; do not generate or replace a lockfile during agent setup.'); }
    const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!object(lock) || ![1, 2, 3].includes(lock.lockfileVersion) ||
        (lock.lockfileVersion === 1 ? !object(lock.dependencies) : !object(lock.packages) || !object(lock.packages['']))) {
      throw new Error('Requires a valid existing npm package-lock.json with a supported lockfile version.');
    }
    if (npmPin) {
      const installedVersion = command('npm', ['--version'], repo);
      if (installedVersion !== npmPin) throw new Error(`Installed npm version ${installedVersion} does not match packageManager pin ${npmPin}.`);
    }
    // npm ci validates manifest/lock agreement and never rewrites the lockfile.
    // The native persistent cache is shared; mutable node_modules remains local.
    const args = ['npm', 'ci', '--cache', join(homedir(), '.npm')];
    if (offline) args.push('--offline');
    return this.run({ id, repo, argv: args, installing: true });
  }
  async lockfileOnly({ id, 'package-dir': packageDir }) {
    if (!id) throw new Error('Lockfile-only generation requires --id for a managed workspace.');
    const row = this.record(id);
    if (row.state !== 'active') throw new Error('Lockfile-only generation requires an active workspace.');
    const repo = realpathSync(resolve(row.path));
    const packageRoot = packageDir === undefined ? repo : independentPackageDirectory(repo, packageDir);
    for (const path of [join(packageRoot, 'node_modules'), join(packageRoot, 'node_modules', '.pnpm')]) {
      let pathStat;
      try { pathStat = lstatSync(path); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (pathStat.isSymbolicLink()) throw new Error('Keep a separate node_modules layout in each checkout; a shared mutable directory is not supported.');
    }
    const manifestPath = join(packageRoot, 'package.json');
    let manifestStat;
    try { manifestStat = lstatSync(manifestPath); }
    catch { throw new Error('Requires a regular package.json with an exact pnpm packageManager pin.'); }
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new Error('Requires a regular package.json with an exact pnpm packageManager pin.');
    const manifest = json(manifestPath);
    if (!exactPnpmPin.test(manifest.packageManager ?? '')) throw new Error('Requires an exact pnpm packageManager pin for lockfile-only generation.');
    const lockPath = join(packageRoot, 'pnpm-lock.yaml');
    let lockStat;
    try { lockStat = lstatSync(lockPath); }
    catch { throw new Error('Requires an existing regular pnpm-lock.yaml for lockfile-only generation.'); }
    if (!lockStat.isFile() || lockStat.isSymbolicLink()) throw new Error('Requires an existing regular pnpm-lock.yaml for lockfile-only generation.');
    const storeDir = this.policy().storeDir;
    mkdirSync(storeDir, { recursive: true });
    if (statSync(storeDir).dev !== statSync(packageRoot).dev) throw new Error('The shared store and checkout must use the same filesystem.');
    const prefix = packageDir === undefined ? ['pnpm'] : [manifest.packageManager, '--dir', packageRoot];
    const args = [...prefix, 'install', '--lockfile-only', '--ignore-scripts', '--store-dir', storeDir, '--package-import-method', this.policy().packageImportMethod];
    return this.run({ id, repo, argv: ['corepack', ...args], installing: true });
  }
  async run({ id, repo, argv, installing = false }) {
    if (!argv?.length) throw new Error('Provide a command after --.');
    const args = argv[0].endsWith('corepack') ? argv.slice(1) : argv;
    if (!installing && /^(?:pnpm|npm|yarn|bun)$/.test(args[0].split('/').at(-1)) && /^(?:install|i|ci|add|update|up|remove|uninstall)$/.test(args[1] ?? '')) {
      throw new Error('Use fleet-workspace install for frozen installs through the shared pnpm store.');
    }
    if (id) { const row = this.record(id); if (row.state !== 'active') throw new Error('Run requires an active workspace.'); repo = row.path; }
    repo = realpathSync(resolve(repo));
    const token = randomUUID();
    const storeBudget = { includeStore: installing && argv[0].endsWith('corepack') && /^pnpm(?:@|$)/.test(argv[1] ?? '') };
    const jobPath = join(this.root, 'jobs', `${token}.json`);
    await this.withFreshBudgets(repo, 'startup', () => {
      const active = this.jobs().filter(jobAlive);
      if (active.some((job) => job.token.startsWith('storage-'))) throw new Error('Shared store maintenance is in progress; retry this command shortly.');
      if (active.length >= this.policy().maxHeavyJobs) throw new Error('Heavy-command limit reached; wait for an existing job to finish.');
      if (active.some((job) => job.repo === repo)) throw new Error('Another managed command is using this checkout.');
      if (id && this.record(id).state !== 'active') throw new Error('Workspace was closed before the command started.');
      save(jobPath, { token, id: id ?? null, repo, pid: process.pid, childPid: null, startedAt: now() });
    }, storeBudget);
    let child;
    const signals = new Map();
    let timer;
    let budgetCheck = Promise.resolve();
    let checkingBudgets = false;
    let limitError;
    let primaryError;
    let heartbeatCheck = Promise.resolve();
    let heartbeating = false;
    const signalChild = (signal) => {
      if (!child?.pid) return;
      try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); }
      catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    try {
      child = spawn(argv[0], argv.slice(1), { cwd: repo, stdio: 'inherit', detached: process.platform !== 'win32', env: {
        ...process.env, COREPACK_ENABLE_AUTO_PIN: '0', npm_config_store_dir: this.policy().storeDir,
        npm_config_package_import_method: this.policy().packageImportMethod, npm_config_modules_cache_max_age: '0',
      } });
      const completion = new Promise((done, fail) => { child.once('error', fail); child.once('exit', (status, signal) => done(status ?? (signal ? 128 : 1))); });
      // Observe an immediate spawn failure while the lease update is awaited.
      completion.catch(() => {});
      await this.locked(() => save(jobPath, { ...json(jobPath), childPid: child.pid ?? null }));
      for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
        const handler = () => signalChild(signal);
        signals.set(signal, handler); process.on(signal, handler);
      }
      timer = setInterval(() => {
        if (limitError) return;
        // Metadata heartbeats remain independent while an async scan is in flight.
        if (id && !heartbeating) {
          heartbeating = true;
          heartbeatCheck = this.heartbeat(id).catch((error) => console.error(error.message)).finally(() => { heartbeating = false; });
        }
        if (checkingBudgets) return budgetCheck;
        checkingBudgets = true;
        budgetCheck = (async () => {
          await heartbeatCheck;
          await this.withFreshBudgets(repo, 'periodic', undefined, storeBudget);
        })().catch((error) => {
          limitError = error;
          console.error(error.message);
          try { signalChild('SIGTERM'); } catch (cleanup) { limitError = combinedError(error, cleanup); }
        }).finally(() => { checkingBudgets = false; });
        return budgetCheck;
      }, 15_000);
      const code = await completion;
      clearInterval(timer);
      await budgetCheck;
      if (limitError) throw limitError;
      await this.withFreshBudgets(repo, 'post-command', () => {
        if (id) { const row = this.record(id); row.heartbeatAt = now(); row.lastCommandAt = now(); row.lastExitCode = code; this.write(row); }
      }, storeBudget);
      return { exitCode: code, storeDir: this.policy().storeDir };
    } catch (error) {
      primaryError = error;
      throw error;
    } finally {
      clearInterval(timer);
      await budgetCheck;
      await heartbeatCheck;
      for (const [signal, handler] of signals) process.off(signal, handler);
      try { await this.locked(() => {
        // Keep the lease if a detached descendant is still using the process group.
        if (existsSync(jobPath) && !jobAlive({ pid: null, childPid: child?.pid, startedAt: json(jobPath).startedAt })) unlinkSync(jobPath);
      }); } catch (cleanup) { throw primaryError ? combinedError(primaryError, cleanup) : cleanup; }
    }
  }
}

export function inventory(path, { maxDepth = 3 } = {}) {
  path = realpathSync(resolve(path));
  const queue = [{ path, depth: 0 }];
  const entries = [];
  const unknowns = [];
  let visited = 0;
  const skip = new Set(['node_modules', '.git', '.build', 'target', 'dist', 'build', '.venv', 'Pods', 'DerivedData']);
  while (queue.length) {
    const current = queue.shift();
    if (++visited > 5_000) throw new Error('Inventory exceeded 5,000 directories; scan a narrower path.');
    if (current.depth > 0 && existsSync(join(current.path, '.git'))) {
      entries.push({ path: current.path, kind: lstatSync(join(current.path, '.git')).isFile() ? 'linked-worktree' : 'independent-checkout', owner: 'unknown', action: 'keep-unmanaged' });
      continue;
    }
    let children;
    try { children = readdirSync(current.path, { withFileTypes: true }); }
    catch (error) {
      if (!['EACCES', 'EPERM', 'ENOENT'].includes(error.code)) throw error;
      unknowns.push({ path: current.path, reason: error.code, action: 'keep-unreadable' }); continue;
    }
    for (const entry of children) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || skip.has(entry.name)) continue;
      const child = join(current.path, entry.name);
      if (/pnpm.*store|store.*pnpm/.test(entry.name) || (entry.name.endsWith('-store') && existsSync(join(child, 'v10')))) {
        entries.push({ path: child, kind: 'pnpm-store', owner: 'unknown', action: 'review-unmanaged-store' });
      } else if (current.depth < maxDepth) {
        queue.push({ path: child, depth: current.depth + 1 });
      }
    }
    if (entries.length + queue.length > 5_000) throw new Error('Inventory exceeded 5,000 directories; scan a narrower path.');
  }
  return { dryRun: true, root: path, entries, unknowns, visitedDirectories: visited, note: 'Unmanaged paths are never adopted, moved or deleted. Ownership and active use require separate verification.' };
}
