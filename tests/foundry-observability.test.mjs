import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  renderFoundryObservabilityMarkdown,
  scanFoundryObservability,
} from '../scripts/foundry-observability-core.mjs';

const CLI = path.resolve('scripts/foundry-observability-inventory.mjs');
const NOW = '2026-07-19T12:00:00.000Z';
const PUBLIC_KEY = 'phc_' + 'A'.repeat(32);

function fixture(t, manifest = { alpha: { maturity: 'maintained' } }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'foundry-observability-'));
  fs.writeFileSync(path.join(root, 'foundry.projects.json'), JSON.stringify(manifest));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('scans provider adapters per file and reports source integrity findings without key values', (t) => {
  const root = fixture(t);
  write(root, 'alpha/package.json', JSON.stringify({ dependencies: { 'posthog-js': '1.0.0' } }));
  write(
    root,
    'alpha/src/monitoring.ts',
    "import posthog from 'posthog-js';\n" +
      "const key = '" + PUBLIC_KEY + "';\n" +
      "posthog.capture('checkout_started', { project_id: 'alpha' });\n" +
      "const query = \"event = 'missing_event'\";\n"
  );
  write(
    root,
    'alpha/src/other.ts',
    "import posthog from 'posthog-js';\n" +
      "posthog.capture('checkout_started', { project_id: 'alpha' });\n"
  );
  write(
    root,
    'alpha/src/otel.ts',
    "import { trace } from '@opentelemetry/api';\n" +
      "trackEvent('checkout_completed', { project_id: 'alpha' });\n"
  );
  write(
    root,
    'alpha/node_modules/ignored/index.js',
    "posthog.capture('ignored_event', { project_id: 'alpha' }); const key = 'phc_" +
      'B'.repeat(32) +
      "';"
  );
  write(root, 'alpha/dist/ignored.js', "posthog.capture('dist_event', { project_id: 'alpha' });");

  const report = scanFoundryObservability({ root, now: NOW });
  const project = report.projects[0];
  assert.equal(project.verification.state, 'source-configured');
  assert.deepEqual(project.adapters.map((adapter) => adapter.provider.id), ['opentelemetry', 'posthog']);
  assert.ok(project.findings.some((finding) => finding.code === 'event-consumer-without-producer' && finding.event === 'missing_event'));
  assert.ok(project.findings.some((finding) => finding.code === 'duplicate-event-owner' && finding.event === 'checkout_started'));
  assert.ok(project.findings.some((finding) => finding.code === 'duplicate-event-family-owner' && finding.eventFamily === 'checkout'));
  assert.equal(project.findings.filter((finding) => finding.code === 'hardcoded-public-key').length, 1);
  assert.ok(!JSON.stringify(report).includes(PUBLIC_KEY));
  assert.ok(!JSON.stringify(report).includes('ignored_event'));
  assert.ok(!JSON.stringify(report).includes('dist_event'));
});

test('keeps fresh, stale, unknown, source-configured, and justified not-applicable distinct', (t) => {
  const root = fixture(t, {
    fresh: { maturity: 'maintained' },
    stale: { maturity: 'public-ready' },
    configured: { maturity: 'internal-first' },
    missing: { maturity: 'maintained' },
    retired: { maturity: 'maintained' },
  });
  write(root, 'fresh/src/monitoring.ts', "import posthog from 'posthog-js';");
  write(
    root,
    'fresh/observability-verification.json',
    JSON.stringify({ status: 'pass', verifiedAt: '2026-07-19T10:00:00.000Z' })
  );
  write(root, 'stale/src/monitoring.ts', "import posthog from 'posthog-js';");
  write(
    root,
    'stale/observability-verification.json',
    JSON.stringify({ ok: true, observedAt: '2026-06-01T00:00:00.000Z' })
  );
  write(root, 'configured/src/monitoring.ts', "import posthog from 'posthog-js';");
  write(
    root,
    'ops/config/automation-registry.json',
    JSON.stringify({
      entries: [{
        id: 'retired',
        repository: 'retired',
        attention: 'ignored',
        actionPolicy: 'excluded',
        exceptions: [{ contract: 'all', reason: 'Frozen by owner decision.' }],
      }],
    })
  );

  const report = scanFoundryObservability({ root, now: NOW, freshnessHours: 24 });
  const states = Object.fromEntries(report.projects.map((project) => [project.projectId, project.verification.state]));
  assert.deepEqual(states, {
    configured: 'source-configured',
    fresh: 'fresh-verified',
    missing: 'unknown',
    retired: 'not-applicable',
    stale: 'stale',
  });
  assert.equal(report.projects.find((project) => project.projectId === 'retired').verification.reason, 'Frozen by owner decision.');
});

test('detects missing identity and audit paths while remaining inside the project boundary', (t) => {
  const root = fixture(t);
  write(
    root,
    'alpha/src/monitoring.ts',
    "import posthog from 'posthog-js'; posthog.capture('account_created', { plan: 'free' });"
  );
  write(
    root,
    'alpha/.posthog-events.json',
    JSON.stringify([{ event: 'account_created', file: 'src/missing-producer.ts' }])
  );
  write(
    root,
    'alpha/package.json',
    JSON.stringify({ scripts: { 'monitoring:verify': 'node scripts/missing-verify.mjs' } })
  );
  write(
    root,
    'alpha/observability-verification.json',
    JSON.stringify({
      status: 'pass',
      verifiedAt: '2026-07-19T10:00:00.000Z',
      auditPath: 'reports/missing-audit.json',
    })
  );

  const report = scanFoundryObservability({ root, now: NOW });
  const codes = report.projects[0].findings.map((finding) => finding.code);
  assert.ok(codes.includes('missing-project-identity'));
  assert.equal(codes.filter((code) => code === 'audit-path-failure').length, 3);
  assert.equal(report.projects[0].verification.state, 'source-configured');
});

test('enforces file and byte bounds without concatenating project source', (t) => {
  const root = fixture(t);
  write(root, 'alpha/a.ts', "import posthog from 'posthog-js';");
  write(root, 'alpha/b.ts', "import posthog from 'posthog-js';");
  const report = scanFoundryObservability({
    root,
    now: NOW,
    limits: { maxFilesPerProject: 1, maxFileBytes: 1024, maxTotalBytesPerProject: 1024 },
  });
  assert.equal(report.projects[0].scan.truncated, true);
  assert.ok(report.projects[0].findings.some((finding) => finding.code === 'scan-limit-reached'));
});

test('CLI writes sanitized JSON and Markdown reports', (t) => {
  const root = fixture(t);
  write(
    root,
    'alpha/src/monitoring.ts',
    "import posthog from 'posthog-js'; const key = '" +
      PUBLIC_KEY +
      "'; posthog.capture('opened', { project_id: 'alpha' });"
  );
  const jsonOutput = path.join(root, 'reports', 'inventory.json');
  const markdownOutput = path.join(root, 'reports', 'inventory.md');
  execFileSync(process.execPath, [
    CLI,
    '--root',
    root,
    '--output',
    jsonOutput,
    '--markdown-output',
    markdownOutput,
    '--format',
    'json',
    '--now',
    NOW,
  ]);
  const parsed = JSON.parse(fs.readFileSync(jsonOutput, 'utf8'));
  const markdown = fs.readFileSync(markdownOutput, 'utf8');
  assert.equal(parsed.schemaVersion, 1);
  assert.match(markdown, /Foundry Observability Inventory/);
  assert.ok(!fs.readFileSync(jsonOutput, 'utf8').includes(PUBLIC_KEY));
  assert.ok(!markdown.includes(PUBLIC_KEY));
  assert.equal(renderFoundryObservabilityMarkdown(parsed).trimEnd(), markdown.trimEnd());
});
