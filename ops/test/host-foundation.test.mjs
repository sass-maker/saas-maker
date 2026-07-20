import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const cli = resolve(import.meta.dirname, '../host/hostctl.mjs');
const JOB_HEADER = 'id\tenabled\tcron\tname\tcwd\tmodel\teffort\tprompt_file\tlock_minutes\tsource';
const SYSTEM_JOB_HEADER = 'id\tenabled\tcron\tname\tcommand';

function writeExecutable(path, body = '#!/bin/sh\nexit 97\n') {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  chmodSync(path, 0o755);
}

function createFixture(t, secret = 'fixture-secret-value-should-never-appear') {
  const root = mkdtempSync(resolve(tmpdir(), 'foundry-host-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const checkoutRoot = resolve(root, 'checkout');
  const machineRoot = resolve(root, 'machine-local');
  const jobsFile = resolve(checkoutRoot, 'ops/automation/codex-cron/jobs.tsv');
  const systemJobsFile = resolve(checkoutRoot, 'ops/automation/codex-cron/system-jobs.tsv');
  const codexRunner = resolve(checkoutRoot, 'ops/scripts/agent-bin/run-codex-cron');
  const systemRunner = resolve(checkoutRoot, 'ops/scripts/agent-bin/run-system-cron');
  const leaseFile = resolve(machineRoot, 'state/primary-lease.json');
  const receiptDir = resolve(machineRoot, 'receipts');
  const sentinel = resolve(machineRoot, 'service-command-was-called');
  const fakeBin = resolve(root, 'fake-bin');

  mkdirSync(dirname(jobsFile), { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  writeFileSync(
    jobsFile,
    `${JOB_HEADER}\n` +
      `fleet-health\tyes\t0 8 * * *\t${secret}\t@fleet\tgpt-fixture\tlow\tprompts/fixture.md\t30\t${secret}\n` +
      'disabled-job\tno\t5 8 * * *\tDisabled fixture\t@fleet\tgpt-fixture\tlow\tprompts/disabled.md\t30\tfixture\n',
  );
  writeFileSync(
    systemJobsFile,
    `${SYSTEM_JOB_HEADER}\nnightly-sync\tyes\t15 2 * * *\t${secret}\t@fleet/ops/scripts/nightly-sync\n`,
  );
  writeExecutable(codexRunner);
  writeExecutable(systemRunner);
  for (const command of ['crontab', 'launchctl', 'systemctl']) {
    writeExecutable(resolve(fakeBin, command), `#!/bin/sh\nprintf called > '${sentinel}'\nexit 96\n`);
  }

  const baseRole = {
    schemaVersion: 1,
    enabled: true,
    hostId: 'fixture-primary-a',
    role: 'primary',
    checkoutRoot,
    jobsFile,
    systemJobsFile,
    codexRunner,
    systemRunner,
    leaseFile,
    receiptDir,
    scheduleOutput: resolve(machineRoot, 'rendered/foundry.schedule'),
  };

  function writeRole(name, overrides = {}) {
    const path = resolve(machineRoot, `${name}.role.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({ ...baseRole, ...overrides }, null, 2)}\n`);
    return path;
  }

  function run(command, { roleFile, now, ttlSeconds, env = {} } = {}) {
    const args = [cli, command];
    if (roleFile) args.push('--role-file', roleFile);
    if (now) args.push('--now', now);
    if (ttlSeconds !== undefined) args.push('--ttl-seconds', String(ttlSeconds));
    const result = spawnSync(process.execPath, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: resolve(root, 'unused-home'),
        PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
        HOST_FOUNDATION_TEST_SECRET: secret,
        ...env,
      },
    });
    const output = result.stdout.trim() || result.stderr.trim();
    return { ...result, json: output ? JSON.parse(output) : null };
  }

  return {
    root,
    checkoutRoot,
    machineRoot,
    jobsFile,
    leaseFile,
    receiptDir,
    scheduleOutput: baseRole.scheduleOutput,
    sentinel,
    secret,
    writeRole,
    run,
  };
}

function readReceipts(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().map((name) => readFileSync(resolve(dir, name), 'utf8'));
}

test('fresh clone is inert until an external role file and explicit activation command are supplied', (t) => {
  const fixture = createFixture(t);

  const doctor = fixture.run('doctor');
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal(doctor.json.activation, 'disabled');
  assert.equal(doctor.json.reason, 'role-file-not-configured');

  const status = fixture.run('status');
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.json.activation, 'disabled');
  assert.equal(status.json.lease.state, 'absent');

  const activationWithoutRole = fixture.run('promote');
  assert.equal(activationWithoutRole.status, 1);
  assert.equal(activationWithoutRole.json.error, 'ROLE_FILE_REQUIRED');
  assert.equal(existsSync(fixture.leaseFile), false);
  assert.equal(existsSync(fixture.receiptDir), false);
  assert.equal(existsSync(fixture.sentinel), false);
});

test('doctor reports missing prerequisites without writing state or revealing paths', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('missing-runner', {
    codexRunner: resolve(fixture.checkoutRoot, 'missing/codex-runner'),
  });

  const doctor = fixture.run('doctor', { roleFile });
  assert.equal(doctor.status, 1);
  assert.equal(doctor.json.ok, false);
  assert.equal(doctor.json.reason, 'prerequisites-missing');
  assert.ok(doctor.json.checks.some((check) => check.name === 'codex-runner' && !check.ok));
  assert.doesNotMatch(doctor.stdout, new RegExp(fixture.root.replaceAll('/', '\\/')));

  const promote = fixture.run('promote', { roleFile });
  assert.equal(promote.status, 1);
  assert.equal(promote.json.error, 'PREREQUISITES_MISSING');
  assert.equal(existsSync(fixture.leaseFile), false);
  assert.equal(existsSync(fixture.receiptDir), false);
});

test('doctor, schedule rendering, and primary promotion are explicit and idempotent', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('primary-a');
  const start = '2026-07-19T10:00:00.000Z';

  const doctor = fixture.run('doctor', { roleFile });
  assert.equal(doctor.status, 0, doctor.stderr);
  assert.equal(doctor.json.activation, 'eligible');

  const dryRun = fixture.run('dry-run', { roleFile, now: start, ttlSeconds: 60 });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(dryRun.json.result, 'would-promote');
  assert.equal(existsSync(fixture.leaseFile), false);
  assert.equal(existsSync(fixture.receiptDir), false);

  const firstRender = fixture.run('render', { roleFile, now: start });
  assert.equal(firstRender.status, 0, firstRender.stderr);
  assert.equal(firstRender.json.conversationalJobs, 1);
  assert.equal(firstRender.json.systemJobs, 1);
  const rendered = readFileSync(fixture.scheduleOutput, 'utf8');
  assert.match(rendered, /Rendered intent only/);
  assert.match(rendered, /run-codex-cron' 'fleet-health'/);
  assert.equal(rendered.match(/run-codex-cron' 'fleet-health'/g)?.length, 1);
  assert.match(rendered, /run-system-cron' 'nightly-sync'/);
  assert.doesNotMatch(rendered, /disabled-job/);
  const secondRender = fixture.run('render', { roleFile, now: '2026-07-19T10:00:01.000Z' });
  assert.equal(secondRender.status, 0, secondRender.stderr);
  assert.equal(readFileSync(fixture.scheduleOutput, 'utf8'), rendered);
  assert.equal(readReceipts(fixture.receiptDir).filter((value) => value.includes('"action": "render"')).length, 2);

  const promoted = fixture.run('promote', { roleFile, now: start, ttlSeconds: 60 });
  assert.equal(promoted.status, 0, promoted.stderr);
  assert.equal(promoted.json.result, 'promoted');
  assert.equal(promoted.json.lease.state, 'active');
  assert.equal(promoted.json.lease.healthy, true);
  const originalLease = readFileSync(fixture.leaseFile, 'utf8');

  const promotedAgain = fixture.run('promote', {
    roleFile,
    now: '2026-07-19T10:00:30.000Z',
    ttlSeconds: 60,
  });
  assert.equal(promotedAgain.status, 0, promotedAgain.stderr);
  assert.equal(promotedAgain.json.result, 'already-active');
  assert.equal(promotedAgain.json.lease.generation, 1);
  assert.equal(readFileSync(fixture.leaseFile, 'utf8'), originalLease);
  assert.equal(readReceipts(fixture.receiptDir).filter((value) => value.includes('"action": "promote"')).length, 2);

  const status = fixture.run('status', { roleFile, now: '2026-07-19T10:00:30.000Z' });
  assert.equal(status.status, 0, status.stderr);
  assert.equal(status.json.lease.healthy, true);
  assert.equal(status.json.lease.generation, 1);
  assert.equal(existsSync(fixture.sentinel), false, 'cron/service commands must never be invoked');
});

test('healthy primary overlap is rejected and an expired lease permits explicit failover', (t) => {
  const fixture = createFixture(t);
  const primaryA = fixture.writeRole('primary-a');
  const primaryB = fixture.writeRole('primary-b', {
    hostId: 'fixture-primary-b',
    scheduleOutput: resolve(fixture.machineRoot, 'rendered/primary-b.schedule'),
  });

  const first = fixture.run('promote', {
    roleFile: primaryA,
    now: '2026-07-19T10:00:00.000Z',
    ttlSeconds: 60,
  });
  assert.equal(first.status, 0, first.stderr);
  const holderA = first.json.lease.holderFingerprint;

  const blockedDryRun = fixture.run('dry-run', {
    roleFile: primaryB,
    now: '2026-07-19T10:00:30.000Z',
  });
  assert.equal(blockedDryRun.status, 1);
  assert.equal(blockedDryRun.json.result, 'blocked-healthy-primary');

  const blocked = fixture.run('promote', {
    roleFile: primaryB,
    now: '2026-07-19T10:00:30.000Z',
    ttlSeconds: 60,
  });
  assert.equal(blocked.status, 1);
  assert.equal(blocked.json.error, 'LEASE_OVERLAP');
  assert.equal(JSON.parse(readFileSync(fixture.leaseFile, 'utf8')).holderFingerprint, holderA);

  const failover = fixture.run('promote', {
    roleFile: primaryB,
    now: '2026-07-19T10:01:01.000Z',
    ttlSeconds: 60,
  });
  assert.equal(failover.status, 0, failover.stderr);
  assert.equal(failover.json.result, 'promoted-after-inactive-lease');
  assert.equal(failover.json.lease.generation, 2);
  assert.notEqual(failover.json.lease.holderFingerprint, holderA);
  assert.equal(failover.json.lease.healthy, true);
});

test('pause, resume, and revoke transitions are guarded and idempotent', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('primary-a');

  assert.equal(fixture.run('promote', {
    roleFile,
    now: '2026-07-19T10:00:00.000Z',
    ttlSeconds: 60,
  }).status, 0);

  const paused = fixture.run('pause', { roleFile, now: '2026-07-19T10:00:01.000Z' });
  assert.equal(paused.status, 0, paused.stderr);
  assert.equal(paused.json.lease.state, 'paused');
  assert.equal(paused.json.lease.healthy, false);
  assert.equal(paused.json.lease.generation, 2);

  const pausedAgain = fixture.run('pause', { roleFile, now: '2026-07-19T10:00:02.000Z' });
  assert.equal(pausedAgain.status, 0, pausedAgain.stderr);
  assert.equal(pausedAgain.json.result, 'already-paused');
  assert.equal(pausedAgain.json.lease.generation, 2);

  const resumed = fixture.run('resume', {
    roleFile,
    now: '2026-07-19T10:00:03.000Z',
    ttlSeconds: 60,
  });
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(resumed.json.lease.state, 'active');
  assert.equal(resumed.json.lease.healthy, true);
  assert.equal(resumed.json.lease.generation, 3);

  const revoked = fixture.run('revoke', { roleFile, now: '2026-07-19T10:00:04.000Z' });
  assert.equal(revoked.status, 0, revoked.stderr);
  assert.equal(revoked.json.lease.state, 'revoked');
  assert.equal(revoked.json.lease.healthy, false);
  assert.equal(revoked.json.lease.generation, 4);

  const revokedAgain = fixture.run('revoke', { roleFile, now: '2026-07-19T10:00:05.000Z' });
  assert.equal(revokedAgain.status, 0, revokedAgain.stderr);
  assert.equal(revokedAgain.json.result, 'already-revoked');
  assert.equal(revokedAgain.json.lease.generation, 4);

  const resumeRevoked = fixture.run('resume', {
    roleFile,
    now: '2026-07-19T10:00:06.000Z',
    ttlSeconds: 60,
  });
  assert.equal(resumeRevoked.status, 1);
  assert.equal(resumeRevoked.json.error, 'LEASE_STATE_INVALID');

  const promotedAgain = fixture.run('promote', {
    roleFile,
    now: '2026-07-19T10:00:07.000Z',
    ttlSeconds: 60,
  });
  assert.equal(promotedAgain.status, 0, promotedAgain.stderr);
  assert.equal(promotedAgain.json.lease.generation, 5);
  assert.equal(promotedAgain.json.lease.state, 'active');
});

test('doctor output, status, schedules, errors, and receipts contain no secret values', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('primary-a');
  const outputs = [];

  for (const [command, options] of [
    ['doctor', { roleFile }],
    ['render', { roleFile, now: '2026-07-19T10:00:00.000Z' }],
    ['promote', { roleFile, now: '2026-07-19T10:00:00.000Z', ttlSeconds: 60 }],
    ['status', { roleFile, now: '2026-07-19T10:00:01.000Z' }],
  ]) {
    const result = fixture.run(command, options);
    assert.equal(result.status, 0, result.stderr);
    outputs.push(result.stdout, result.stderr);
  }

  const forbiddenRole = fixture.writeRole('forbidden', {
    apiToken: fixture.secret,
  });
  const rejected = fixture.run('doctor', { roleFile: forbiddenRole });
  assert.equal(rejected.status, 1);
  assert.equal(rejected.json.error, 'ROLE_FILE_FORBIDDEN_FIELD');
  outputs.push(rejected.stdout, rejected.stderr);

  const generated = [
    readFileSync(fixture.scheduleOutput, 'utf8'),
    readFileSync(fixture.leaseFile, 'utf8'),
    ...readReceipts(fixture.receiptDir),
  ];
  assert.doesNotMatch([...outputs, ...generated].join('\n'), new RegExp(fixture.secret));

  for (const raw of readReceipts(fixture.receiptDir)) {
    const receipt = JSON.parse(raw);
    assert.deepEqual(
      Object.keys(receipt).sort(),
      Object.keys(receipt).filter((key) => [
        'schemaVersion', 'action', 'result', 'role', 'hostFingerprint', 'generation',
        'state', 'at', 'expiresAt', 'conversationalJobs', 'systemJobs',
      ].includes(key)).sort(),
    );
    assert.equal(Object.values(receipt).includes(fixture.root), false);
  }
  assert.equal(existsSync(fixture.sentinel), false);
});

test('machine-local mutable paths are refused when they point inside the checkout', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('tracked-state', {
    leaseFile: resolve(fixture.root, 'checkout/ops/host/local-lease.json'),
  });

  const result = fixture.run('doctor', { roleFile });
  assert.equal(result.status, 1);
  assert.equal(result.json.error, 'TRACKED_PATH_REFUSED');
  assert.equal(existsSync(resolve(fixture.root, 'checkout/ops/host/local-lease.json')), false);
});

test('schedule registries and runners are refused when they point outside the checkout', (t) => {
  const fixture = createFixture(t);
  const outsideJobs = resolve(fixture.machineRoot, 'jobs.tsv');
  mkdirSync(dirname(outsideJobs), { recursive: true });
  writeFileSync(outsideJobs, `${JOB_HEADER}\n`);
  const roleFile = fixture.writeRole('outside-source', { jobsFile: outsideJobs });

  const result = fixture.run('doctor', { roleFile });
  assert.equal(result.status, 1);
  assert.equal(result.json.error, 'SOURCE_PATH_REFUSED');
});

test('lease files with unsupported private fields fail closed without echoing values', (t) => {
  const fixture = createFixture(t);
  const roleFile = fixture.writeRole('primary-a');
  mkdirSync(dirname(fixture.leaseFile), { recursive: true });
  writeFileSync(fixture.leaseFile, `${JSON.stringify({
    schemaVersion: 1,
    role: 'primary',
    state: 'active',
    holderFingerprint: '0123456789abcdef',
    generation: 1,
    issuedAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    expiresAt: '2026-07-19T10:01:00.000Z',
    privateToken: fixture.secret,
  }, null, 2)}\n`);

  const result = fixture.run('status', { roleFile, now: '2026-07-19T10:00:01.000Z' });
  assert.equal(result.status, 1);
  assert.equal(result.json.error, 'LEASE_INVALID');
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(fixture.secret));
});
