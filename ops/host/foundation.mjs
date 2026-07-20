import { createHash } from 'node:crypto';
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { inspectPostizReadiness, PostizReadinessError } from './postiz/readiness.mjs';

const ROLE_KEYS = new Set([
  'schemaVersion',
  'enabled',
  'hostId',
  'role',
  'checkoutRoot',
  'jobsFile',
  'systemJobsFile',
  'codexRunner',
  'systemRunner',
  'leaseFile',
  'receiptDir',
  'scheduleOutput',
  'postizConfigFile',
]);

const REQUIRED_PATH_KEYS = [
  'checkoutRoot',
  'jobsFile',
  'systemJobsFile',
  'codexRunner',
  'systemRunner',
  'leaseFile',
  'receiptDir',
  'scheduleOutput',
];

const SOURCE_PATH_KEYS = ['jobsFile', 'systemJobsFile', 'codexRunner', 'systemRunner'];

const JOB_HEADERS = [
  'id',
  'enabled',
  'cron',
  'name',
  'cwd',
  'model',
  'effort',
  'prompt_file',
  'lock_minutes',
  'source',
];
const SYSTEM_JOB_HEADERS = ['id', 'enabled', 'cron', 'name', 'command'];
const LEASE_KEYS = new Set([
  'schemaVersion',
  'role',
  'state',
  'holderFingerprint',
  'generation',
  'issuedAt',
  'updatedAt',
  'expiresAt',
]);

export class HostFoundationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HostFoundationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new HostFoundationError(code, message);
}

function safeJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(code, 'The local JSON file is missing or invalid.');
  }
}

function isWithin(parent, candidate) {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function requireMachineLocalPath(checkoutRoot, candidate) {
  if (isWithin(checkoutRoot, candidate)) {
    fail('TRACKED_PATH_REFUSED', 'Machine-local state must remain outside the checkout.');
  }
}

function validateRoleShape(role, roleFile) {
  if (!role || typeof role !== 'object' || Array.isArray(role)) {
    fail('ROLE_FILE_INVALID', 'The machine-local role file is invalid.');
  }
  if (Object.keys(role).some((key) => !ROLE_KEYS.has(key))) {
    fail('ROLE_FILE_FORBIDDEN_FIELD', 'The role file contains an unsupported field.');
  }
  if (role.schemaVersion !== 1 || role.enabled !== true || role.role !== 'primary') {
    fail('ROLE_FILE_DISABLED', 'The role file does not explicitly enable the primary role.');
  }
  if (typeof role.hostId !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(role.hostId)) {
    fail('ROLE_FILE_INVALID', 'The role file has an invalid host identity.');
  }
  for (const key of REQUIRED_PATH_KEYS) {
    if (typeof role[key] !== 'string' || !isAbsolute(role[key])) {
      fail('ROLE_FILE_INVALID', 'Every configured path must be explicit and absolute.');
    }
  }

  requireMachineLocalPath(role.checkoutRoot, roleFile);
  requireMachineLocalPath(role.checkoutRoot, role.leaseFile);
  requireMachineLocalPath(role.checkoutRoot, role.receiptDir);
  requireMachineLocalPath(role.checkoutRoot, role.scheduleOutput);
  for (const key of SOURCE_PATH_KEYS) {
    if (!isWithin(role.checkoutRoot, role[key])) {
      fail('SOURCE_PATH_REFUSED', 'Schedule registries and runners must remain inside the checkout.');
    }
  }
  if (role.postizConfigFile !== undefined) {
    if (typeof role.postizConfigFile !== 'string' || !isAbsolute(role.postizConfigFile)) {
      fail('ROLE_FILE_INVALID', 'The Postiz config file path must be explicit and absolute.');
    }
    requireMachineLocalPath(role.checkoutRoot, role.postizConfigFile);
  }
  return Object.freeze({ ...role });
}

export function loadRole(roleFile) {
  if (!roleFile) {
    fail('ROLE_FILE_REQUIRED', 'An explicit machine-local role file path is required.');
  }
  if (!isAbsolute(roleFile)) {
    fail('ROLE_FILE_PATH_INVALID', 'The role file path must be absolute.');
  }
  return validateRoleShape(safeJson(roleFile, 'ROLE_FILE_INVALID'), roleFile);
}

function fileCheck(name, path, executable = false) {
  try {
    if (!statSync(path).isFile()) throw new Error('not-file');
    if (executable) accessSync(path, constants.X_OK);
    return { name, ok: true, detail: executable ? 'executable' : 'present' };
  } catch {
    return { name, ok: false, detail: executable ? 'missing-or-not-executable' : 'missing' };
  }
}

function directoryCheck(name, path) {
  try {
    return { name, ok: statSync(path).isDirectory(), detail: 'present' };
  } catch {
    return { name, ok: false, detail: 'missing' };
  }
}

function parseRegistry(path, expectedHeaders, kind) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail('PREREQUISITES_MISSING', 'One or more schedule registries are unavailable.');
  }
  const lines = text.split(/\r?\n/u).filter((line) => line.trim() !== '');
  const headers = lines.shift()?.split('\t') ?? [];
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    fail('SCHEDULE_REGISTRY_INVALID', `The ${kind} schedule registry header is invalid.`);
  }

  const seen = new Set();
  return lines.map((line) => {
    const values = line.split('\t');
    if (values.length !== headers.length) {
      fail('SCHEDULE_REGISTRY_INVALID', `A ${kind} schedule row is invalid.`);
    }
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.id) || seen.has(row.id)) {
      fail('SCHEDULE_REGISTRY_INVALID', `A ${kind} job identity is invalid.`);
    }
    if (!['yes', 'no'].includes(row.enabled) || !/^[0-9*/,-]+(?: [0-9*/,-]+){4}$/.test(row.cron)) {
      fail('SCHEDULE_REGISTRY_INVALID', `A ${kind} job schedule is invalid.`);
    }
    seen.add(row.id);
    return row;
  });
}

export function doctor(roleFile, options = {}) {
  if (!roleFile) {
    return {
      schemaVersion: 1,
      command: 'doctor',
      ok: true,
      activation: 'disabled',
      reason: 'role-file-not-configured',
      checks: [],
    };
  }

  const role = loadRole(roleFile);
  const checks = [
    { name: 'node', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: 'version-supported' },
    directoryCheck('checkout-root', role.checkoutRoot),
    fileCheck('conversational-jobs', role.jobsFile),
    fileCheck('system-jobs', role.systemJobsFile),
    fileCheck('codex-runner', role.codexRunner, true),
    fileCheck('system-runner', role.systemRunner, true),
  ];

  if (checks.every((check) => check.ok)) {
    parseRegistry(role.jobsFile, JOB_HEADERS, 'conversational');
    parseRegistry(role.systemJobsFile, SYSTEM_JOB_HEADERS, 'system');
  }
  if (role.postizConfigFile) {
    const configCheck = fileCheck('postiz-readiness-config', role.postizConfigFile);
    checks.push(configCheck);
    if (configCheck.ok) {
      try {
        checks.push(...inspectPostizReadiness(role.postizConfigFile, {
          checkoutRoot: role.checkoutRoot,
          probes: options.postizProbes,
        }).checks);
      } catch (error) {
        if (error instanceof PostizReadinessError) fail(error.code, error.message);
        throw error;
      }
    }
  }
  const ok = checks.every((check) => check.ok);
  return {
    schemaVersion: 1,
    command: 'doctor',
    ok,
    activation: ok ? 'eligible' : 'disabled',
    reason: ok ? 'prerequisites-satisfied' : 'prerequisites-missing',
    checks,
  };
}

function requireDoctor(roleFile) {
  if (!roleFile) loadRole(roleFile);
  const report = doctor(roleFile);
  if (!report.ok || report.activation !== 'eligible') {
    fail('PREREQUISITES_MISSING', 'Host prerequisites are incomplete.');
  }
  return loadRole(roleFile);
}

function fingerprint(hostId) {
  return createHash('sha256').update(hostId).digest('hex').slice(0, 16);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function atomicWrite(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, contents, { mode: 0o600 });
  renameSync(temporary, path);
}

function normalizeNow(nowValue) {
  const date = nowValue === undefined ? new Date() : new Date(nowValue);
  if (!Number.isFinite(date.getTime())) fail('NOW_INVALID', 'The supplied fixture time is invalid.');
  return date;
}

function normalizeTtl(ttlSeconds) {
  const value = ttlSeconds === undefined ? 900 : Number(ttlSeconds);
  if (!Number.isInteger(value) || value < 1 || value > 86400) {
    fail('TTL_INVALID', 'Lease TTL must be between 1 and 86400 seconds.');
  }
  return value;
}

function validateLease(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('LEASE_INVALID', 'The lease file is invalid.');
  }
  if (Object.keys(value).some((key) => !LEASE_KEYS.has(key))) {
    fail('LEASE_INVALID', 'The lease file contains an unsupported field.');
  }
  const validState = ['active', 'paused', 'revoked'].includes(value.state);
  const validHost = typeof value.holderFingerprint === 'string' && /^[a-f0-9]{16}$/.test(value.holderFingerprint);
  const validGeneration = Number.isInteger(value.generation) && value.generation > 0;
  if (value.schemaVersion !== 1 || value.role !== 'primary' || !validState || !validHost || !validGeneration) {
    fail('LEASE_INVALID', 'The lease file is invalid.');
  }
  if (value.state === 'active' && typeof value.expiresAt !== 'string') {
    fail('LEASE_INVALID', 'The active lease has no expiration.');
  }
  return value;
}

function readLease(path) {
  if (!existsSync(path)) return null;
  return validateLease(safeJson(path, 'LEASE_INVALID'));
}

function leaseHealth(lease, now) {
  if (!lease || lease.state !== 'active') return false;
  const expiration = new Date(lease.expiresAt).getTime();
  if (!Number.isFinite(expiration)) fail('LEASE_INVALID', 'The lease expiration is invalid.');
  return expiration > now.getTime();
}

function publicLease(lease, now) {
  if (!lease) {
    return { state: 'absent', healthy: false, generation: 0, holderFingerprint: null, expiresAt: null };
  }
  return {
    state: lease.state,
    healthy: leaseHealth(lease, now),
    generation: lease.generation,
    holderFingerprint: lease.holderFingerprint,
    expiresAt: lease.expiresAt,
  };
}

function writeReceipt(role, action, result, lease, now, extra = {}) {
  const receipt = {
    schemaVersion: 1,
    action,
    result,
    role: 'primary',
    hostFingerprint: fingerprint(role.hostId),
    generation: lease?.generation ?? 0,
    state: lease?.state ?? 'absent',
    at: now.toISOString(),
    expiresAt: lease?.expiresAt ?? null,
    ...extra,
  };
  const timestamp = receipt.at.replaceAll(/[^0-9A-Za-z]/gu, '');
  const stem = `${timestamp}-${receipt.generation}-${action}-${receipt.hostFingerprint}`;
  let suffix = 0;
  let path = resolve(role.receiptDir, `${stem}.json`);
  while (existsSync(path)) {
    suffix += 1;
    path = resolve(role.receiptDir, `${stem}-${suffix}.json`);
  }
  atomicWrite(path, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function acquireLock(role, operation) {
  const lockPath = `${role.leaseFile}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  try {
    mkdirSync(lockPath);
  } catch {
    fail('LEASE_BUSY', 'Another local lease operation is in progress.');
  }
  try {
    return operation();
  } finally {
    rmdirSync(lockPath);
  }
}

function makeActiveLease(role, previous, now, ttlSeconds) {
  return {
    schemaVersion: 1,
    role: 'primary',
    state: 'active',
    holderFingerprint: fingerprint(role.hostId),
    generation: (previous?.generation ?? 0) + 1,
    issuedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  };
}

function persistLease(role, action, result, lease, now) {
  atomicWrite(role.leaseFile, `${JSON.stringify(lease, null, 2)}\n`);
  const receipt = writeReceipt(role, action, result, lease, now);
  return { schemaVersion: 1, command: action, ok: true, result, lease: publicLease(lease, now), receipt };
}

export function renderSchedule(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  const jobs = parseRegistry(role.jobsFile, JOB_HEADERS, 'conversational').filter((row) => row.enabled === 'yes');
  const systemJobs = parseRegistry(role.systemJobsFile, SYSTEM_JOB_HEADERS, 'system').filter((row) => row.enabled === 'yes');
  const lines = [
    '# Foundry designated operations host schedule',
    '# Rendered intent only. This file is not installed by hostctl.',
    ...jobs.map((row) => `${row.cron} ${shellQuote(role.codexRunner)} ${shellQuote(row.id)} >/dev/null 2>&1`),
    ...systemJobs.map((row) => `${row.cron} ${shellQuote(role.systemRunner)} ${shellQuote(row.id)} >/dev/null 2>&1`),
    '',
  ];
  atomicWrite(role.scheduleOutput, lines.join('\n'));
  const receipt = writeReceipt(role, 'render', 'rendered', null, now, {
    conversationalJobs: jobs.length,
    systemJobs: systemJobs.length,
  });
  return {
    schemaVersion: 1,
    command: 'render',
    ok: true,
    result: 'rendered',
    conversationalJobs: jobs.length,
    systemJobs: systemJobs.length,
    receipt,
  };
}

export function dryRun(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  const lease = readLease(role.leaseFile);
  const mine = fingerprint(role.hostId);
  const healthy = leaseHealth(lease, now);
  let result = 'would-promote';
  let ok = true;
  if (healthy && lease.holderFingerprint !== mine) {
    result = 'blocked-healthy-primary';
    ok = false;
  } else if (healthy && lease.holderFingerprint === mine) {
    result = 'already-primary';
  } else if (lease?.state === 'paused' && lease.holderFingerprint === mine) {
    result = 'would-resume';
  }
  return { schemaVersion: 1, command: 'dry-run', ok, result, lease: publicLease(lease, now) };
}

export function promote(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  const ttlSeconds = normalizeTtl(options.ttlSeconds);
  return acquireLock(role, () => {
    const current = readLease(role.leaseFile);
    const mine = fingerprint(role.hostId);
    if (leaseHealth(current, now) && current.holderFingerprint !== mine) {
      fail('LEASE_OVERLAP', 'A healthy primary lease already exists.');
    }
    if (leaseHealth(current, now) && current.holderFingerprint === mine) {
      const receipt = writeReceipt(role, 'promote', 'already-active', current, now);
      return { schemaVersion: 1, command: 'promote', ok: true, result: 'already-active', lease: publicLease(current, now), receipt };
    }
    if (current?.state === 'paused' && current.holderFingerprint === mine) {
      fail('LEASE_PAUSED', 'Use the explicit resume command for a paused lease.');
    }
    const lease = makeActiveLease(role, current, now, ttlSeconds);
    return persistLease(role, 'promote', current ? 'promoted-after-inactive-lease' : 'promoted', lease, now);
  });
}

export function pause(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  return acquireLock(role, () => {
    const current = readLease(role.leaseFile);
    const mine = fingerprint(role.hostId);
    if (!current || current.holderFingerprint !== mine) {
      fail('LEASE_NOT_OWNED', 'The configured host does not own the lease.');
    }
    if (current.state === 'paused') {
      const receipt = writeReceipt(role, 'pause', 'already-paused', current, now);
      return { schemaVersion: 1, command: 'pause', ok: true, result: 'already-paused', lease: publicLease(current, now), receipt };
    }
    if (current.state !== 'active') fail('LEASE_STATE_INVALID', 'Only an active lease can be paused.');
    const lease = {
      ...current,
      state: 'paused',
      generation: current.generation + 1,
      updatedAt: now.toISOString(),
      expiresAt: null,
    };
    return persistLease(role, 'pause', 'paused', lease, now);
  });
}

export function resume(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  const ttlSeconds = normalizeTtl(options.ttlSeconds);
  return acquireLock(role, () => {
    const current = readLease(role.leaseFile);
    const mine = fingerprint(role.hostId);
    if (!current || current.holderFingerprint !== mine) {
      if (leaseHealth(current, now)) fail('LEASE_OVERLAP', 'A healthy primary lease already exists.');
      fail('LEASE_NOT_OWNED', 'The configured host does not own the lease.');
    }
    if (leaseHealth(current, now)) {
      const receipt = writeReceipt(role, 'resume', 'already-active', current, now);
      return { schemaVersion: 1, command: 'resume', ok: true, result: 'already-active', lease: publicLease(current, now), receipt };
    }
    if (!['active', 'paused'].includes(current.state)) {
      fail('LEASE_STATE_INVALID', 'A revoked lease cannot be resumed.');
    }
    const lease = makeActiveLease(role, current, now, ttlSeconds);
    return persistLease(role, 'resume', 'resumed', lease, now);
  });
}

export function revoke(roleFile, options = {}) {
  const role = requireDoctor(roleFile);
  const now = normalizeNow(options.now);
  return acquireLock(role, () => {
    const current = readLease(role.leaseFile);
    const mine = fingerprint(role.hostId);
    if (!current || current.holderFingerprint !== mine) {
      fail('LEASE_NOT_OWNED', 'The configured host does not own the lease.');
    }
    if (current.state === 'revoked') {
      const receipt = writeReceipt(role, 'revoke', 'already-revoked', current, now);
      return { schemaVersion: 1, command: 'revoke', ok: true, result: 'already-revoked', lease: publicLease(current, now), receipt };
    }
    const lease = {
      ...current,
      state: 'revoked',
      generation: current.generation + 1,
      updatedAt: now.toISOString(),
      expiresAt: null,
    };
    return persistLease(role, 'revoke', 'revoked', lease, now);
  });
}

export function status(roleFile, options = {}) {
  if (!roleFile) {
    return {
      schemaVersion: 1,
      command: 'status',
      ok: true,
      activation: 'disabled',
      reason: 'role-file-not-configured',
      lease: publicLease(null, normalizeNow(options.now)),
    };
  }
  const role = loadRole(roleFile);
  const now = normalizeNow(options.now);
  return {
    schemaVersion: 1,
    command: 'status',
    ok: true,
    activation: 'configured',
    configuredHostFingerprint: fingerprint(role.hostId),
    lease: publicLease(readLease(role.leaseFile), now),
  };
}
