import {
  existsSync, mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync,
  readdirSync, unlinkSync, realpathSync, statSync, statfsSync, chmodSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export class StaleWorkspaceSnapshotError extends Error {
  constructor() {
    super('Workspace identities changed during disk measurement; retry with a fresh measurement.');
    this.name = 'StaleWorkspaceSnapshotError';
  }
}

export const GiB = 1024 ** 3;
export const defaults = Object.freeze({
  storeDir: join(homedir(), 'Library', 'pnpm', 'store'),
  maxWriters: 8, maxHeavyJobs: 2, maxWorkspaceBytes: 8 * GiB,
  maxTotalBytes: 40 * GiB, minFreeBytes: 20 * GiB, staleHours: 24,
});
const exactPnpmPin = /^pnpm@\d+\.\d+\.\d+(?:\+sha\d+\.[a-f0-9]+)?$/;
export const defaultRoot = join(homedir(), 'Library', 'Application Support', 'Fleet', 'Agent Workspaces.noindex');

function command(bin, args, cwd) {
  const result = spawnSync(bin, args, {
    cwd, encoding: 'utf8', timeout: bin === 'du' ? 180_000 : 60_000, maxBuffer: 32 * 1024 ** 2,
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
  if (typeof policy.storeDir !== 'string' || !policy.storeDir.startsWith('/') || policy.storeDir.includes('\0')) throw new Error('storeDir must be an absolute persistent path.');
  let ancestor = resolve(policy.storeDir);
  const tail = [];
  while (!existsSync(ancestor)) { tail.unshift(ancestor.split(sep).at(-1)); ancestor = dirname(ancestor); }
  const storePath = resolve(realpathSync(ancestor), ...tail);
  if ([resolve('/tmp'), '/private/tmp', '/var/folders', '/private/var/folders'].some((path) => storePath === path || storePath.startsWith(`${path}/`))) {
    throw new Error('The shared pnpm store cannot live in a temporary folder.');
  }
  for (const [key, value] of Object.entries(policy)) {
    if (key !== 'storeDir' && (!Number.isSafeInteger(value) || value < 1)) throw new Error(`Invalid policy value: ${key}`);
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
export function diskBytesAsync(path) {
  if (!existsSync(path)) return Promise.reject(new Error(`Missing path: ${path}`));
  return new Promise((done, fail) => {
    const child = spawn('du', ['-sk', path], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let failure;
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
    child.once('error', (error) => { clearTimeout(timer); fail(error); });
    child.once('close', (code) => {
      clearTimeout(timer);
      const bytes = Number(stdout.trim().split(/\s/)[0]) * 1024;
      if (failure) fail(failure);
      else if (code !== 0 && !(vanishedOnly(stderr) && stdout.trim())) fail(new Error(`du -sk failed (${code}): ${stderr.trim()}`));
      else if (!stdout.trim() || !Number.isSafeInteger(bytes) || bytes < 0) fail(new Error('du -sk returned an invalid measurement'));
      else done(bytes);
    });
  });
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

export class AgentWorkspaces {
  constructor({ root = defaultRoot, measure = diskBytes, freeBytes, openFiles = openFileCount } = {}) {
    this.root = resolve(root);
    this.measure = measure;
    this.freeBytes = freeBytes ?? (() => { const fs = statfsSync(this.root); return fs.bavail * fs.bsize; });
    this.openFiles = openFiles;
  }
  initialize() {
    if (this.root === sep || this.root === homedir() || existsSync(join(this.root, '.git'))) throw new Error('Choose a dedicated private state directory outside a Git checkout.');
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    for (const path of [this.root, ...['manifests', 'worktrees', 'retired', 'jobs', 'receipts'].map((name) => join(this.root, name))]) {
      mkdirSync(path, { recursive: true, mode: 0o700 });
      if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory()) throw new Error(`Unsafe state directory: ${path}`);
      chmodSync(path, 0o700);
    }
    const instructions = join(this.root, 'AGENTS.md');
    if (!existsSync(instructions)) {
      try {
        writeFileSync(instructions, `# Managed agent workspaces\n\nRead the owning repository's AGENTS.md before work. Use fleet-workspace for\nwriter creation, pinned frozen pnpm installs, heavy commands and task closeout.\nRead ${fileURLToPath(new URL('../docs/agent-workspaces.md', import.meta.url))}.\nReview-only agents reuse source. Do not create per-task stores or copy build/\ndependency folders. Respect shared limits and heartbeat long idle tasks.\nClose only verified clean work with retained remote commits; unknown, dirty\nor active work stays protected. gc is dry-run only. Do not commit, push,\ndeploy, migrate or release unless the owner explicitly requested it.\n`, { flag: 'wx', mode: 0o600 });
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
  async measureBudgets(path, phase) {
    this.initialize();
    const identities = this.identities();
    const measure = async (target, role) => {
      const started = Date.now();
      try {
        const bytes = await (this.measure === diskBytes ? diskBytesAsync(target) : this.measure(target));
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid disk measurement');
        return bytes;
      } catch (cause) {
        throw new Error(`Disk measurement failed (${phase}, ${role}, ${Date.now() - started}ms): ${cause.message}`, { cause });
      }
    };
    const bytes = existsSync(path) ? await measure(path, 'workspace') : 0;
    const active = await measure(join(this.root, 'worktrees'), 'active-worktrees');
    const retired = await measure(join(this.root, 'retired'), 'retired-worktrees');
    return { bytes, total: active + retired, identities };
  }
  validateBudgets(snapshot) {
    requireBytes(snapshot.bytes, 'workspace');
    requireBytes(snapshot.total, 'total');
    const policy = this.policy();
    if (snapshot.bytes > policy.maxWorkspaceBytes) throw new Error('Workspace exceeds its disk budget; review its artifacts before starting another command.');
    if (snapshot.total > policy.maxTotalBytes) throw new Error('Managed workspaces exceed the total disk budget (including retired worktrees).');
    if (requireBytes(this.freeBytes(), 'free-space') < policy.minFreeBytes) throw new Error('Available disk space is below the workspace reserve.');
    if (snapshot.identities !== undefined && snapshot.identities !== this.identities()) throw new StaleWorkspaceSnapshotError();
    return snapshot;
  }
  async withFreshBudgets(path, phase, action = () => {}) {
    // Only a changed identity snapshot is retriable. Unknown bytes, policy,
    // reserve, lock and command-admission failures remain conservative failures.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const snapshot = await this.measureBudgets(path, phase);
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
    const snapshot = await this.measureBudgets(path, 'create');
    return this.locked(() => {
      if (this.records().some((row) => row.id === id)) throw new Error('Workspace ID already exists; reuse it or choose another.');
      const policy = this.policy();
      // Closed and reconciled-missing records no longer hold a writer slot.
      if (this.records().filter((row) => !['closed', 'missing'].includes(row.state)).length >= policy.maxWriters) throw new Error('Writer workspace limit reached.');
      this.validateBudgets(snapshot);
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
  inspect(row) {
    const info = { ...row, reportedBytes: null, blockers: [] };
    if (existsSync(row.path)) {
      try { info.reportedBytes = requireBytes(this.measure(row.path), 'workspace'); }
      catch (error) { if (existsSync(row.path)) throw error; }
    }
    // A missing folder is reported, never fatal: other records stay inspectable.
    if (!existsSync(row.path)) { info.blockers.push('missing-worktree'); return info; }
    try {
      if (!lstatSync(join(row.path, '.git')).isFile()) throw new Error('Not a linked worktree');
      if (git(row.path, 'rev-parse', '--show-toplevel') !== realpathSync(row.path)) throw new Error('Worktree identity mismatch');
      if (git(row.path, 'rev-parse', '--path-format=absolute', '--git-common-dir') !== row.commonDir) throw new Error('Repository identity mismatch');
      info.head = git(row.path, 'rev-parse', 'HEAD');
      info.branchNow = git(row.path, 'symbolic-ref', '--short', 'HEAD');
      if (info.branchNow !== row.branch) info.blockers.push('branch-changed');
      if (git(row.path, 'status', '--porcelain=v1', '-z', '--untracked-files=all')) info.blockers.push('dirty-or-untracked');
      const remotes = git(row.path, 'for-each-ref', '--format=%(refname)', '--contains', info.head, 'refs/remotes/').split('\n').filter(Boolean);
      if (!remotes.length) info.blockers.push('head-not-in-local-remote-refs');
      info.remoteRefs = remotes;
    } catch (error) { info.blockers.push(`git-state-unknown: ${error.message}`); }
    if (this.jobs().some((job) => job.id === row.id && jobAlive(job))) info.blockers.push('command-running');
    return info;
  }
  status() {
    const policy = this.policy();
    const freeBytes = existsSync(this.root) ? requireBytes(this.freeBytes(), 'free-space') : null;
    const managedReportedBytes = existsSync(join(this.root, 'worktrees')) ? requireBytes(requireBytes(this.measure(join(this.root, 'worktrees')), 'active-worktrees') + requireBytes(this.measure(join(this.root, 'retired')), 'retired-worktrees'), 'total') : 0;
    return { policy, freeBytes, managedReportedBytes, belowFreeSpaceReserve: freeBytes !== null && freeBytes < policy.minFreeBytes, totalOverBudget: managedReportedBytes > policy.maxTotalBytes, workspaces: this.records().map((row) => {
      const info = this.inspect(row);
      info.stale = Date.now() - Date.parse(row.heartbeatAt) > policy.staleHours * 3_600_000;
      info.overBudget = info.reportedBytes > policy.maxWorkspaceBytes;
      return info;
    }), jobs: this.jobs().map((job) => ({ ...job, running: jobAlive(job) })) };
  }
  // A squash merge leaves the branch HEAD outside every remote ref. Treat the
  // work as landed when each path the branch changed (since its merge base with
  // the remote default branch) has identical content there, or when the
  // operator names a landed commit that a remote-tracking ref contains.
  landing(info, landed) {
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
    if (!ref) return null;
    const base = git(repo, 'merge-base', 'HEAD', ref);
    const changed = git(repo, 'diff', '--name-only', '-z', '--no-renames', base, 'HEAD').split('\0').filter(Boolean);
    if (!changed.length) return null;
    const diff = spawnSync('git', ['diff', '--quiet', '--no-renames', ref, 'HEAD', '--', ...changed.map((path) => `:(literal)${path}`)], { cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
    if (diff.status === 0) return { landedBy: 'content-equal', landedRef: ref, landedRefSha: git(repo, 'rev-parse', ref), changedPaths: changed.length };
    if (diff.status !== 1) throw new Error(`git diff failed: ${diff.stderr.trim()}`);
    return null;
  }
  async close(id, { dryRun = false, landed } = {}) {
    return this.locked(() => {
      const row = this.record(id);
      if (row.state !== 'active') throw new Error('Only active workspaces can be closed.');
      const info = this.inspect(row);
      if (info.blockers.includes('head-not-in-local-remote-refs')) {
        try {
          const evidence = this.landing(info, landed);
          if (evidence) { info.blockers = info.blockers.filter((item) => item !== 'head-not-in-local-remote-refs'); info.landing = evidence; }
        } catch (error) { info.blockers.push(`landing-unverified: ${error.message}`); }
      } else if (landed !== undefined) info.blockers.push('landing-flag-unneeded: HEAD is already in a remote ref');
      try { if (this.openFiles(row.path)) info.blockers.push('open-files'); }
      catch (error) { info.blockers.push(error.message); }
      if (dryRun) return { ...info, dryRun: true, action: info.blockers.length ? 'keep' : 'move-to-retired' };
      if (info.blockers.length) throw new Error(`Keeping ${id}: ${info.blockers.join(', ')}`);
      const destination = join(this.root, 'retired', row.id);
      if (existsSync(destination)) throw new Error('Retirement path already exists.');
      const receipt = { id, owner: row.owner, task: row.task, head: info.head, branch: row.branch, remoteRefs: info.remoteRefs, ...(info.landing ? { landing: info.landing } : {}), original: row.path, retired: destination, createdAt: now(), reportedBytes: info.reportedBytes, restore: ['git', '-C', row.repo, 'worktree', 'move', destination, row.path], note: 'Reversible relocation only; no disk space was reclaimed. All ignored artifacts remain available for review.' };
      save(join(this.root, 'receipts', `${id}.json`), receipt);
      // No force/remove/clean: submodules, locked trees and Git safety failures remain blockers.
      git(row.repo, 'worktree', 'move', row.path, destination);
      row.state = 'closed'; row.path = destination; row.closedAt = now(); this.write(row);
      return receipt;
    });
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
  gc() {
    return { dryRun: true, workspaces: this.status().workspaces.map((info) => ({
      id: info.id, owner: info.owner, task: info.task, state: info.state, path: info.path,
      reportedBytes: info.reportedBytes, stale: info.stale, blockers: info.blockers,
      action: info.state === 'closed' && !info.blockers.length ? 'review-retired-artifacts'
        : ['closed', 'missing'].includes(info.state) && info.blockers.includes('missing-worktree') ? 'record-only' : 'keep',
    })), note: 'No automatic deletion. Stale heartbeats never make source disposable. Reported sizes do not account for APFS shared blocks.' };
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
      const args = ['pnpm', 'install', '--frozen-lockfile', '--store-dir', storeDir, '--package-import-method', 'auto'];
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
  async lockfileOnly({ id }) {
    if (!id) throw new Error('Lockfile-only generation requires --id for a managed workspace.');
    const row = this.record(id);
    if (row.state !== 'active') throw new Error('Lockfile-only generation requires an active workspace.');
    const repo = realpathSync(resolve(row.path));
    for (const path of [join(repo, 'node_modules'), join(repo, 'node_modules', '.pnpm')]) {
      let pathStat;
      try { pathStat = lstatSync(path); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (pathStat.isSymbolicLink()) throw new Error('Keep a separate node_modules layout in each checkout; a shared mutable directory is not supported.');
    }
    const manifestPath = join(repo, 'package.json');
    let manifestStat;
    try { manifestStat = lstatSync(manifestPath); }
    catch { throw new Error('Requires a regular package.json with an exact pnpm packageManager pin.'); }
    if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new Error('Requires a regular package.json with an exact pnpm packageManager pin.');
    const manifest = json(manifestPath);
    if (!exactPnpmPin.test(manifest.packageManager ?? '')) throw new Error('Requires an exact pnpm packageManager pin for lockfile-only generation.');
    const lockPath = join(repo, 'pnpm-lock.yaml');
    let lockStat;
    try { lockStat = lstatSync(lockPath); }
    catch { throw new Error('Requires an existing regular pnpm-lock.yaml for lockfile-only generation.'); }
    if (!lockStat.isFile() || lockStat.isSymbolicLink()) throw new Error('Requires an existing regular pnpm-lock.yaml for lockfile-only generation.');
    const storeDir = this.policy().storeDir;
    mkdirSync(storeDir, { recursive: true });
    if (statSync(storeDir).dev !== statSync(repo).dev) throw new Error('The shared store and checkout must use the same filesystem.');
    const args = ['pnpm', 'install', '--lockfile-only', '--ignore-scripts', '--store-dir', storeDir, '--package-import-method', 'auto'];
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
    const jobPath = join(this.root, 'jobs', `${token}.json`);
    await this.withFreshBudgets(repo, 'startup', () => {
      const active = this.jobs().filter(jobAlive);
      if (active.length >= this.policy().maxHeavyJobs) throw new Error('Heavy-command limit reached; wait for an existing job to finish.');
      if (active.some((job) => job.repo === repo)) throw new Error('Another managed command is using this checkout.');
      if (id && this.record(id).state !== 'active') throw new Error('Workspace was closed before the command started.');
      save(jobPath, { token, id: id ?? null, repo, pid: process.pid, childPid: null, startedAt: now() });
    });
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
        ...process.env, COREPACK_ENABLE_AUTO_PIN: '0', npm_config_store_dir: this.policy().storeDir, npm_config_package_import_method: 'auto',
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
          await this.withFreshBudgets(repo, 'periodic');
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
      });
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
