import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { doctor } from '../host/foundation.mjs';
import { PostizReadinessError, inspectPostizReadiness } from '../host/postiz/readiness.mjs';
import { runDisposableRehearsal } from '../host/postiz/rehearsal.mjs';

const JOB_HEADER = 'id\tenabled\tcron\tname\tcwd\tmodel\teffort\tprompt_file\tlock_minutes\tsource';
const SYSTEM_JOB_HEADER = 'id\tenabled\tcron\tname\tcommand';
const STATE_DIRECTORIES = [
  'postiz-config',
  'postiz-uploads',
  'postgres',
  'redis',
  'temporal-postgres',
  'temporal-elasticsearch',
];

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'postiz-host-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const checkoutRoot = resolve(root, 'checkout');
  const machineRoot = resolve(root, 'machine');
  const dataRoot = resolve(machineRoot, 'postiz-data');
  const backupRoot = resolve(machineRoot, 'backups');
  const restoreReceiptFile = resolve(backupRoot, 'restore-rehearsal-receipt.json');
  const jobsFile = resolve(checkoutRoot, 'ops/automation/codex-cron/jobs.tsv');
  const systemJobsFile = resolve(checkoutRoot, 'ops/automation/codex-cron/system-jobs.tsv');
  const codexRunner = resolve(checkoutRoot, 'ops/scripts/agent-bin/run-codex-cron');
  const systemRunner = resolve(checkoutRoot, 'ops/scripts/agent-bin/run-system-cron');

  mkdirSync(dirname(jobsFile), { recursive: true });
  writeFileSync(jobsFile, `${JOB_HEADER}\n`);
  writeFileSync(systemJobsFile, `${SYSTEM_JOB_HEADER}\n`);
  for (const runner of [codexRunner, systemRunner]) {
    mkdirSync(dirname(runner), { recursive: true });
    writeFileSync(runner, '#!/bin/sh\nexit 97\n');
    chmodSync(runner, 0o755);
  }
  for (const name of STATE_DIRECTORIES) mkdirSync(resolve(dataRoot, name), { recursive: true });
  mkdirSync(backupRoot, { recursive: true });
  writeFileSync(restoreReceiptFile, `${JSON.stringify({
    schemaVersion: 1,
    kind: 'postiz-restore-rehearsal',
    result: 'verified',
    sourceRelease: 'v2.21.10',
    verifiedAt: '2026-07-20T10:00:00.000Z',
  })}\n`);

  const configFile = resolve(machineRoot, 'postiz-readiness.json');
  const config = {
    schemaVersion: 1,
    dataRoot,
    backupRoot,
    restoreReceiptFile,
    healthUrl: 'http://127.0.0.1:4007/',
    apiCompatibilityUrl: 'http://127.0.0.1:4007/api/public/v1/integrations',
    privateReachabilityUrl: 'http://127.0.0.1:4007/',
  };
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  const roleFile = resolve(machineRoot, 'role.json');
  writeFileSync(roleFile, `${JSON.stringify({
    schemaVersion: 1,
    enabled: true,
    hostId: 'postiz-fixture-host',
    role: 'primary',
    checkoutRoot,
    jobsFile,
    systemJobsFile,
    codexRunner,
    systemRunner,
    leaseFile: resolve(machineRoot, 'lease.json'),
    receiptDir: resolve(machineRoot, 'receipts'),
    scheduleOutput: resolve(machineRoot, 'schedule'),
    postizConfigFile: configFile,
  }, null, 2)}\n`);

  const passingProbes = {
    resources: () => ({ cpuCount: 4, memoryBytes: 4 * 1024 ** 3 }),
    freeDiskBytes: () => 40 * 1024 ** 3,
    http: (url) => ({ reachable: true, status: url.includes('/api/') ? 401 : 200 }),
    privateReachability: () => true,
  };
  return { root, checkoutRoot, machineRoot, dataRoot, config, configFile, roleFile, passingProbes };
}

test('official Postiz manifest, compose contract, and schedules stay pinned and inert', () => {
  const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, '../host/postiz/images.json'), 'utf8'));
  const compose = readFileSync(resolve(import.meta.dirname, '../host/postiz/compose.yaml'), 'utf8');
  const schedules = JSON.parse(readFileSync(resolve(import.meta.dirname, '../config/postiz-schedules.json'), 'utf8'));

  assert.equal(manifest.postizRelease, 'v2.21.10');
  assert.equal(
    manifest.images.postiz,
    'ghcr.io/gitroomhq/postiz-app:v2.21.10@sha256:1d5a5dc6b896747d1483c01dc2562165bd313ad601b32f6cabb7f7dd08a911a9',
  );
  assert.deepEqual(Object.values(manifest.images).slice(1), [
    'postgres:17-alpine',
    'redis:7.2',
    'temporalio/auto-setup:1.28.1',
    'postgres:16',
    'elasticsearch:7.17.27',
  ]);
  for (const image of Object.values(manifest.images)) assert.match(compose, new RegExp(image.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  assert.doesNotMatch(compose, /:latest\b/u);
  assert.doesNotMatch(compose, /^\s*environment:/mu);
  assert.match(compose, /profiles: \[postiz-manual\]/u);
  assert.match(compose, /networks: \[postiz, temporal, egress\]/u);
  assert.match(compose, /^  postiz:\n    driver: bridge\n    internal: true$/mu);
  assert.match(compose, /^  temporal:\n    driver: bridge\n    internal: true$/mu);
  assert.match(compose, /^  egress:\n    driver: bridge$/mu);
  assert.deepEqual([...compose.matchAll(/^\s+- ([^\n]+):(?:5000|7233)$/gmu)].map((match) => match[1]), [
    '127.0.0.1:4007',
    '127.0.0.1:7233',
  ]);
  for (const name of STATE_DIRECTORIES) assert.match(compose, new RegExp(`source: \\$\\{POSTIZ_DATA_ROOT[^\\n]+/${name}`));

  assert.equal(schedules.status, 'inert');
  assert.equal(schedules.schedulesActive, false);
  assert.deepEqual(schedules.schedules.map((schedule) => schedule.id), [
    'postiz-evidence-sync',
    'postiz-queued-distribution',
  ]);
  assert.ok(schedules.schedules.every((schedule) => schedule.enabled === false));
});

test('Foundry doctor includes injected Postiz resource, persistence, backup, API, and private checks', (t) => {
  const value = fixture(t);
  const report = doctor(value.roleFile, { postizProbes: value.passingProbes });
  assert.equal(report.ok, true);
  assert.equal(report.activation, 'eligible');
  assert.deepEqual(report.checks.filter((item) => item.name.startsWith('postiz-')).map((item) => item.name), [
    'postiz-readiness-config',
    'postiz-cpu',
    'postiz-memory',
    'postiz-disk',
    'postiz-persistent-paths',
    'postiz-backup-readiness',
    'postiz-health-endpoint',
    'postiz-api-compatibility',
    'postiz-private-reachability',
  ]);
});

test('every Postiz readiness lane fails closed through an injectable fixture probe', (t) => {
  const value = fixture(t);
  const cases = [
    ['postiz-cpu', { resources: () => ({ cpuCount: 1, memoryBytes: 4 * 1024 ** 3 }) }],
    ['postiz-memory', { resources: () => ({ cpuCount: 4, memoryBytes: 1024 ** 3 }) }],
    ['postiz-disk', { freeDiskBytes: () => 10 * 1024 ** 3 }],
    ['postiz-persistent-paths', { pathReady: () => false }],
    ['postiz-backup-readiness', { backupReady: () => false }],
    ['postiz-health-endpoint', { http: (url) => ({ reachable: true, status: url.includes('/api/') ? 401 : 503 }) }],
    ['postiz-api-compatibility', { http: (url) => ({ reachable: true, status: url.includes('/api/') ? 404 : 200 }) }],
    ['postiz-private-reachability', { privateReachability: () => false }],
  ];
  for (const [name, override] of cases) {
    const report = inspectPostizReadiness(value.configFile, {
      checkoutRoot: value.checkoutRoot,
      probes: { ...value.passingProbes, ...override },
    });
    assert.equal(report.ok, false, name);
    assert.equal(report.checks.find((item) => item.name === name)?.ok, false, name);
  }
});

test('public or credential-shaped Postiz probe configuration is rejected without echoing it', (t) => {
  const value = fixture(t);
  const secret = 'fixture-private-token';
  writeFileSync(value.configFile, `${JSON.stringify({
    ...value.config,
    healthUrl: `https://user:${secret}@example.com/health`,
  })}\n`);
  assert.throws(
    () => inspectPostizReadiness(value.configFile, { checkoutRoot: value.checkoutRoot, probes: value.passingProbes }),
    (error) => error instanceof PostizReadinessError && error.code === 'POSTIZ_PUBLIC_ENDPOINT_REFUSED' && !error.message.includes(secret),
  );
});

test('backup, candidate restore, and rollback are verified against disposable state without Docker', (t) => {
  const root = mkdtempSync(resolve(tmpdir(), 'postiz-rehearsal-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const receipt = runDisposableRehearsal(root, { now: '2026-07-20T12:00:00.000Z' });
  assert.equal(receipt.result, 'verified');
  assert.equal(receipt.sourceRelease, 'v2.21.10');
  assert.equal(receipt.stateDirectories, 6);
  assert.equal(receipt.filesVerified, 6);
  assert.equal(JSON.parse(readFileSync(resolve(root, 'restore-rehearsal-receipt.json'), 'utf8')).result, 'verified');
});
