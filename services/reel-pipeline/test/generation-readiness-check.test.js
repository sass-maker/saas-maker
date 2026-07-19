import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildReport,
  buildGenerationCaseReadiness,
  buildTargetHostNextActions,
  checkReport,
  formatCheckLabel,
  formatGenerationCaseReadiness,
  formatTargetHostNextAction,
  runReadinessCheck,
  shouldExitNonZero,
} from '../scripts/check-generation-readiness.js';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const readinessMatrix = JSON.parse(await readFile('config/live-generation-readiness.json', 'utf8'));
const generationCaseMatrix = JSON.parse(await readFile('config/generation-cases.json', 'utf8'));
const targetHostAcceptanceExample = JSON.parse(await readFile('config/target-host-acceptance.example.json', 'utf8'));

test('generation readiness matrix references existing package scripts', () => {
  for (const entry of readinessMatrix.checks) {
    const scriptNames = npmRunScriptsForEntry(entry);
    for (const scriptName of scriptNames) {
      assert.ok(packageJson.scripts[scriptName], `${entry.id} references missing package script ${scriptName}`);
    }
  }
});

test('readiness package aliases point at consolidated gates', () => {
  assert.equal(
    packageJson.scripts['ready:local'],
    'npm run smoke:generation-cases',
  );
  assert.equal(
    packageJson.scripts['ready:proofs'],
    'npm run check:generation-readiness -- --refresh --strict',
  );
  assert.equal(
    packageJson.scripts['ready:target'],
    'npm run check:generation-readiness -- --refresh --strict --fail-unresolved',
  );
});

test('generation readiness matrix maps checks to declared generation cases', () => {
  const declaredCaseIds = new Set(generationCaseMatrix.cases.map((entry) => entry.id));
  const referencedCaseIds = new Set();

  for (const entry of readinessMatrix.checks) {
    assert.ok(Array.isArray(entry.generationCases), `${entry.id} must declare generationCases`);
    assert.ok(entry.generationCases.length > 0, `${entry.id} must cover at least one generation case`);
    for (const caseId of entry.generationCases) {
      assert.ok(declaredCaseIds.has(caseId), `${entry.id} references unknown generation case ${caseId}`);
      referencedCaseIds.add(caseId);
    }
  }

  assert.deepEqual([...referencedCaseIds].sort(), [...declaredCaseIds].sort());
});

test('target host acceptance example matches readiness acceptance contract', () => {
  assert.equal(targetHostAcceptanceExample.$schema, 'reel-pipeline.target-host-acceptance.v1');
  assert.equal(typeof targetHostAcceptanceExample.targetHost, 'string');
  assert.ok(targetHostAcceptanceExample.targetHost.length > 0);
  assert.ok(Array.isArray(targetHostAcceptanceExample.acceptedUnresolved));
  assert.ok(targetHostAcceptanceExample.acceptedUnresolved.length > 0);
  for (const entry of targetHostAcceptanceExample.acceptedUnresolved) {
    assert.equal(typeof entry.name, 'string');
    assert.equal(typeof entry.reason, 'string');
    assert.equal(typeof entry.evidence, 'string');
    assert.ok(entry.name.length > 0);
    assert.ok(entry.reason.length > 0);
    assert.ok(entry.evidence.length > 0);
  }
});

test('generation readiness check labels include generation case coverage', () => {
  assert.equal(formatCheckLabel({
    name: 'render-pro-live-proof',
    generationCases: ['worker-render-pro'],
  }), 'render-pro-live-proof [worker-render-pro]');
  assert.equal(formatCheckLabel({
    name: 'legacy-check',
  }), 'legacy-check');
});

test('generation case readiness formatter shows open and accepted checks', () => {
  assert.equal(formatGenerationCaseReadiness({
    name: 'lesson-video',
    targetHostReady: false,
    openChecks: [{ name: 'lesson-live-prereqs' }],
    acceptedChecks: [],
  }), 'case lesson-video targetHostReady=false open=lesson-live-prereqs accepted=none');
  assert.equal(formatGenerationCaseReadiness({
    name: 'creator-mvp',
    targetHostReady: true,
    openChecks: [],
    acceptedChecks: [{ name: 'creator-mvp-reviewed' }],
  }), 'case creator-mvp targetHostReady=true open=none accepted=creator-mvp-reviewed');
});

test('target host next actions preserve commands and docs links', () => {
  const checks = [
    {
      name: 'local-generation-cases',
      status: 'ok',
      requiredForFullReadiness: true,
      generationCases: ['marketing-render-modes'],
      command: 'npm run smoke:generation-cases',
    },
    {
      name: 'render-pro-live-proof',
      status: 'manual',
      requiredForFullReadiness: false,
      generationCases: ['worker-render-pro'],
      detail: 'manual proof required',
      command: 'npm run render:pro -- <approved-reel-id>',
      docs: 'docs/operations/runbooks/target-host-readiness.md#render-pro-live-proof',
    },
    {
      name: 'lesson-live-prereqs',
      status: 'missing',
      requiredForFullReadiness: false,
      generationCases: ['lesson-video'],
      detail: 'missing env DEEPSEEK_API_KEY',
      command: 'npm run lesson:render',
      docs: 'docs/operations/runbooks/target-host-readiness.md#lesson-live-prereqs',
    },
  ];

  const actions = buildTargetHostNextActions({
    checks,
    blocking: [],
    unresolved: checks.slice(1),
  });

  assert.deepEqual(actions, [
    {
      name: 'render-pro-live-proof',
      status: 'manual',
      requiredForFullReadiness: false,
      generationCases: ['worker-render-pro'],
      detail: 'manual proof required',
      command: 'npm run render:pro -- <approved-reel-id>',
      docs: 'docs/operations/runbooks/target-host-readiness.md#render-pro-live-proof',
    },
    {
      name: 'lesson-live-prereqs',
      status: 'missing',
      requiredForFullReadiness: false,
      generationCases: ['lesson-video'],
      detail: 'missing env DEEPSEEK_API_KEY',
      command: 'npm run lesson:render',
      docs: 'docs/operations/runbooks/target-host-readiness.md#lesson-live-prereqs',
    },
  ]);
  assert.equal(
    formatTargetHostNextAction(actions[0]),
    'next render-pro-live-proof [worker-render-pro]: manual proof required command=npm run render:pro -- <approved-reel-id> docs=docs/operations/runbooks/target-host-readiness.md#render-pro-live-proof',
  );
});

test('generation readiness report records strict blockers', () => {
  const report = buildReport({
    strict: true,
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'local-generation-cases',
        status: 'ok',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
        command: 'npm run smoke:generation-cases',
      },
      {
        name: 'moneyprinter-real-mp4',
        status: 'missing',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
        detail: 'missing report',
        command: 'npm run canary:moneyprinter',
      },
      {
        name: 'creator-mvp-reviewed',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
      },
    ],
  });

  assert.equal(report.schema, 'reel-pipeline.generation-readiness-report.v1');
  assert.equal(report.generatedAt, '2026-07-09T00:00:00.000Z');
  assert.equal(report.refresh, false);
  assert.equal(report.failUnresolved, false);
  assert.equal(report.strictReady, false);
  assert.equal(report.targetHostReady, false);
  assert.equal(report.acceptanceSchema, null);
  assert.equal(report.acceptanceTargetHost, null);
  assert.deepEqual(report.summary, { ok: 1, missing: 1, manual: 1 });
  assert.deepEqual(report.refreshes, []);
  assert.deepEqual(report.blocking, [
    {
      name: 'moneyprinter-real-mp4',
      status: 'missing',
      generationCases: ['marketing-render-modes'],
      detail: 'missing report',
      command: 'npm run canary:moneyprinter',
    },
  ]);
  assert.deepEqual(report.unresolved, [
    {
      name: 'moneyprinter-real-mp4',
      status: 'missing',
      requiredForFullReadiness: true,
      generationCases: ['marketing-render-modes'],
      detail: 'missing report',
      command: 'npm run canary:moneyprinter',
    },
    {
      name: 'creator-mvp-reviewed',
      status: 'manual',
      requiredForFullReadiness: false,
      generationCases: ['creator-mvp'],
      detail: null,
      command: null,
    },
  ]);
  assert.deepEqual(report.acceptedUnresolved, []);
  assert.deepEqual(report.invalidAcceptances, []);
  assert.deepEqual(report.generationCaseReadiness, [
    {
      name: 'marketing-render-modes',
      targetHostReady: false,
      checks: [
        {
          name: 'local-generation-cases',
          status: 'ok',
          requiredForFullReadiness: true,
        },
        {
          name: 'moneyprinter-real-mp4',
          status: 'missing',
          requiredForFullReadiness: true,
        },
      ],
      openChecks: [
        {
          name: 'moneyprinter-real-mp4',
          status: 'missing',
          blocking: true,
          unresolved: true,
          detail: 'missing report',
          command: 'npm run canary:moneyprinter',
        },
      ],
      acceptedChecks: [],
    },
    {
      name: 'creator-mvp',
      targetHostReady: false,
      checks: [
        {
          name: 'creator-mvp-reviewed',
          status: 'manual',
          requiredForFullReadiness: false,
        },
      ],
      openChecks: [
        {
          name: 'creator-mvp-reviewed',
          status: 'manual',
          blocking: false,
          unresolved: true,
          detail: null,
          command: null,
        },
      ],
      acceptedChecks: [],
    },
  ]);
  assert.deepEqual(report.targetHostNextActions.map((entry) => entry.name), [
    'moneyprinter-real-mp4',
    'creator-mvp-reviewed',
  ]);
});

function npmRunScriptsForEntry(entry) {
  const commands = [entry.command, entry.refreshCommand].filter(Boolean);
  const scripts = [];
  for (const command of commands) {
    const match = String(command).match(/(?:^|\s)npm\s+run\s+([^\s]+)/);
    if (match?.[1]) scripts.push(match[1]);
  }
  return scripts;
}

test('generation readiness report records fail-unresolved mode', () => {
  const report = buildReport({
    failUnresolved: true,
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'required-ok',
        status: 'ok',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
      },
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
    ],
  });

  assert.equal(report.failUnresolved, true);
  assert.equal(report.targetHostReady, false);
  assert.deepEqual(report.unresolved, [
    {
      name: 'manual-proof',
      status: 'manual',
      requiredForFullReadiness: false,
      generationCases: ['creator-mvp'],
      detail: 'manual proof required',
      command: 'npm run proof',
    },
  ]);
});

test('generation readiness report keeps target host unready for blocking failures without unresolved checks', () => {
  const report = buildReport({
    failUnresolved: true,
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'required-failed',
        status: 'fail',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
        detail: 'required report failed',
        command: 'npm run proof',
      },
    ],
  });

  assert.equal(report.targetHostReady, false);
  assert.deepEqual(report.unresolved, []);
  assert.deepEqual(report.blocking, [
    {
      name: 'required-failed',
      status: 'fail',
      generationCases: ['marketing-render-modes'],
      detail: 'required report failed',
      command: 'npm run proof',
    },
  ]);
});

test('generation readiness exit policy uses final readiness for fail-unresolved', () => {
  assert.equal(shouldExitNonZero({
    strict: false,
    failUnresolved: true,
  }, {
    strictReady: null,
    targetHostReady: false,
  }), true);
  assert.equal(shouldExitNonZero({
    strict: false,
    failUnresolved: true,
  }, {
    strictReady: null,
    targetHostReady: true,
  }), false);
  assert.equal(shouldExitNonZero({
    strict: true,
    failUnresolved: false,
  }, {
    strictReady: false,
    targetHostReady: false,
  }), true);
});

test('generation case readiness summarizes open and accepted checks', () => {
  const cases = buildGenerationCaseReadiness({
    checks: [
      {
        name: 'required-ok',
        status: 'ok',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
      },
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['marketing-render-modes', 'creator-mvp'],
      },
      {
        name: 'lesson-env',
        status: 'missing',
        requiredForFullReadiness: false,
        generationCases: ['lesson-video'],
      },
    ],
    blocking: [],
    unresolved: [
      {
        name: 'lesson-env',
        status: 'missing',
      },
    ],
    acceptedUnresolved: [
      {
        name: 'manual-proof',
        status: 'manual',
        reason: 'Target host excludes this channel.',
        evidence: 'release-notes#manual-proof',
        acceptedBy: 'ops@example.com',
        acceptedAt: '2026-07-10T00:00:00.000Z',
      },
    ],
  });

  assert.deepEqual(cases, [
    {
      name: 'marketing-render-modes',
      targetHostReady: true,
      checks: [
        {
          name: 'required-ok',
          status: 'ok',
          requiredForFullReadiness: true,
        },
        {
          name: 'manual-proof',
          status: 'manual',
          requiredForFullReadiness: false,
        },
      ],
      openChecks: [],
      acceptedChecks: [
        {
          name: 'manual-proof',
          status: 'manual',
          reason: 'Target host excludes this channel.',
          evidence: 'release-notes#manual-proof',
          acceptedBy: 'ops@example.com',
          acceptedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    },
    {
      name: 'creator-mvp',
      targetHostReady: true,
      checks: [
        {
          name: 'manual-proof',
          status: 'manual',
          requiredForFullReadiness: false,
        },
      ],
      openChecks: [],
      acceptedChecks: [
        {
          name: 'manual-proof',
          status: 'manual',
          reason: 'Target host excludes this channel.',
          evidence: 'release-notes#manual-proof',
          acceptedBy: 'ops@example.com',
          acceptedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    },
    {
      name: 'lesson-video',
      targetHostReady: false,
      checks: [
        {
          name: 'lesson-env',
          status: 'missing',
          requiredForFullReadiness: false,
        },
      ],
      openChecks: [
        {
          name: 'lesson-env',
          status: 'missing',
          blocking: false,
          unresolved: true,
          detail: null,
          command: null,
        },
      ],
      acceptedChecks: [],
    },
  ]);
});

test('generation readiness report applies documented unresolved acceptance', () => {
  const report = buildReport({
    failUnresolved: true,
    acceptancePath: 'config/target-host-acceptance.json',
    acceptance: {
      $schema: 'reel-pipeline.target-host-acceptance.v1',
      targetHost: 'target-prod',
      acceptedUnresolved: [
        {
          name: 'manual-proof',
          reason: 'Target host excludes this channel.',
          evidence: 'release-notes#manual-proof',
          acceptedBy: 'ops@example.com',
          acceptedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          name: 'missing-evidence',
          reason: '',
          evidence: 'ignored because reason is empty',
        },
      ],
    },
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
      {
        name: 'missing-evidence',
        status: 'missing',
        requiredForFullReadiness: false,
        generationCases: ['lesson-video'],
        detail: 'missing env',
        command: 'npm run missing',
      },
    ],
  });

  assert.equal(report.acceptancePath, 'config/target-host-acceptance.json');
  assert.equal(report.acceptanceSchema, 'reel-pipeline.target-host-acceptance.v1');
  assert.equal(report.acceptanceTargetHost, 'target-prod');
  assert.equal(report.targetHostReady, false);
  assert.deepEqual(report.acceptedUnresolved, [
    {
      name: 'manual-proof',
      status: 'manual',
      requiredForFullReadiness: false,
      generationCases: ['creator-mvp'],
      reason: 'Target host excludes this channel.',
      evidence: 'release-notes#manual-proof',
      acceptedBy: 'ops@example.com',
      acceptedAt: '2026-07-10T00:00:00.000Z',
    },
  ]);
  assert.deepEqual(report.unresolved, [
    {
      name: 'missing-evidence',
      status: 'missing',
      requiredForFullReadiness: false,
      generationCases: ['lesson-video'],
      detail: 'missing env',
      command: 'npm run missing',
    },
  ]);
  assert.deepEqual(report.invalidAcceptances, [
    {
      index: 1,
      name: 'missing-evidence',
      reason: 'missing reason',
    },
  ]);
  assert.deepEqual(report.generationCaseReadiness.find((entry) => entry.name === 'creator-mvp').acceptedChecks, [
    {
      name: 'manual-proof',
      status: 'manual',
      reason: 'Target host excludes this channel.',
      evidence: 'release-notes#manual-proof',
      acceptedBy: 'ops@example.com',
      acceptedAt: '2026-07-10T00:00:00.000Z',
    },
  ]);
});

test('generation readiness report rejects stale acceptance entries', () => {
  const report = buildReport({
    failUnresolved: true,
    acceptance: {
      $schema: 'reel-pipeline.target-host-acceptance.v1',
      targetHost: 'legacy-host',
      acceptedUnresolved: [
        {
          name: 'old-check-name',
          reason: 'This used to exist.',
          evidence: 'old-release-notes',
        },
      ],
    },
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
    ],
  });

  assert.deepEqual(report.acceptedUnresolved, []);
  assert.deepEqual(report.invalidAcceptances, [
    {
      index: 0,
      name: 'old-check-name',
      reason: 'does not match a current unresolved check',
    },
  ]);
  assert.deepEqual(report.unresolved.map((entry) => entry.name), ['manual-proof']);
});

test('generation readiness report rejects acceptance files with the wrong schema', () => {
  const report = buildReport({
    failUnresolved: true,
    acceptance: {
      $schema: 'wrong.schema',
      targetHost: 'target-prod',
      acceptedUnresolved: [
        {
          name: 'manual-proof',
          reason: 'Target host intentionally excludes this case.',
          evidence: 'host-runbook#excluded-generation-cases',
        },
      ],
    },
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
    ],
  });

  assert.equal(report.acceptanceSchema, 'wrong.schema');
  assert.equal(report.targetHostReady, false);
  assert.deepEqual(report.invalidAcceptances, [
    {
      index: -1,
      name: '$schema',
      reason: 'expected reel-pipeline.target-host-acceptance.v1',
    },
  ]);
  assert.deepEqual(report.acceptedUnresolved.map((entry) => entry.name), ['manual-proof']);
});

test('generation readiness report rejects acceptance files without target host attribution', () => {
  const report = buildReport({
    failUnresolved: true,
    acceptance: {
      $schema: 'reel-pipeline.target-host-acceptance.v1',
      acceptedUnresolved: [
        {
          name: 'manual-proof',
          reason: 'Target host intentionally excludes this case.',
          evidence: 'host-runbook#excluded-generation-cases',
        },
      ],
    },
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
    ],
  });

  assert.equal(report.acceptanceTargetHost, null);
  assert.equal(report.targetHostReady, false);
  assert.deepEqual(report.invalidAcceptances, [
    {
      index: -1,
      name: 'targetHost',
      reason: 'missing targetHost',
    },
  ]);
  assert.deepEqual(report.acceptedUnresolved.map((entry) => entry.name), ['manual-proof']);
});

test('generation readiness report marks target host ready when unresolved checks are accepted', () => {
  const report = buildReport({
    strict: true,
    failUnresolved: true,
    acceptance: {
      $schema: 'reel-pipeline.target-host-acceptance.v1',
      targetHost: 'excluded-channel-host',
      acceptedUnresolved: [
        {
          name: 'manual-proof',
          reason: 'Target host intentionally excludes this case.',
          evidence: 'host-runbook#excluded-generation-cases',
        },
      ],
    },
    matrixPath: 'config/live-generation-readiness.json',
    matrix: { $schema: 'reel-pipeline.live-generation-readiness.v1' },
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      {
        name: 'required-ok',
        status: 'ok',
        requiredForFullReadiness: true,
        generationCases: ['marketing-render-modes'],
      },
      {
        name: 'manual-proof',
        status: 'manual',
        requiredForFullReadiness: false,
        generationCases: ['creator-mvp'],
        detail: 'manual proof required',
        command: 'npm run proof',
      },
    ],
  });

  assert.equal(report.strictReady, true);
  assert.equal(report.targetHostReady, true);
  assert.equal(report.acceptanceSchema, 'reel-pipeline.target-host-acceptance.v1');
  assert.equal(report.acceptanceTargetHost, 'excluded-channel-host');
  assert.deepEqual(report.unresolved, []);
  assert.deepEqual(report.invalidAcceptances, []);
  assert.deepEqual(report.acceptedUnresolved.map((entry) => entry.name), ['manual-proof']);
});

test('failed refresh blocks stale report validation', () => {
  const check = runReadinessCheck({
    id: 'moneyprinter-real-mp4',
    type: 'report',
    report: 'tmp/moneyprinter-canary-result.json',
    schema: 'reel-pipeline.moneyprinter-canary.v1',
    requiredForFullReadiness: true,
    command: 'npm run canary:moneyprinter',
  }, {
    name: 'moneyprinter-real-mp4',
    status: 'fail',
    detail: 'server not ready',
    command: 'npm run canary:moneyprinter',
  });

  assert.deepEqual(check, {
    name: 'moneyprinter-real-mp4',
    requiredForFullReadiness: true,
    generationCases: [],
    command: 'npm run canary:moneyprinter',
    report: 'tmp/moneyprinter-canary-result.json',
    status: 'fail',
    detail: 'refresh failed: server not ready',
  });
});

test('generation readiness command checks time out instead of hanging', () => {
  const check = runReadinessCheck({
    id: 'slow-command',
    type: 'command',
    command: process.execPath,
    args: ['-e', 'setTimeout(() => {}, 1000)'],
    timeoutMs: 10,
    requiredForFullReadiness: true,
  });

  assert.deepEqual(check, {
    name: 'slow-command',
    requiredForFullReadiness: true,
    generationCases: [],
    command: `${process.execPath} -e setTimeout(() => {}, 1000)`,
    report: null,
    status: 'fail',
    detail: 'timed out after 10ms',
  });
});

test('generation readiness command failures prefer structured JSON error output', () => {
  const check = runReadinessCheck({
    id: 'json-failing-command',
    type: 'command',
    command: process.execPath,
    args: [
      '-e',
      'console.error(JSON.stringify({ schema: "x", ok: false, error: "server not ready" }, null, 2)); process.exit(1);',
    ],
    requiredForFullReadiness: true,
  });

  assert.equal(check.status, 'fail');
  assert.equal(check.detail, 'server not ready');
});

test('successful refresh requires the report to be rewritten after refresh start', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'generation-refresh-'));
  try {
    const reportPath = path.join(dir, 'report.json');
    await writeFile(reportPath, JSON.stringify({
      schema: 'custom.schema',
      ok: true,
    }));

    const check = runReadinessCheck({
      id: 'refreshable-report',
      type: 'report',
      report: reportPath,
      schema: 'custom.schema',
      requiredForFullReadiness: true,
      command: 'npm run fake',
    }, {
      name: 'refreshable-report',
      status: 'ok',
      detail: 'refreshed',
      command: 'npm run fake',
      startedAt: new Date(Date.now() + 60_000).toISOString(),
    });

    assert.deepEqual(check, {
      name: 'refreshable-report',
      requiredForFullReadiness: true,
      generationCases: [],
      command: 'npm run fake',
      report: reportPath,
      status: 'fail',
      detail: `report ${reportPath} was not refreshed by npm run fake`,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('readiness report check validates schema, failed child checks, and expectations', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'generation-readiness-'));
  try {
    const okPath = path.join(dir, 'ok.json');
    await writeFile(okPath, JSON.stringify({
      schema: 'custom.schema',
      ok: true,
      outputSize: 2048,
      checks: [{ name: 'mock', status: 'ok' }],
    }));

    assert.deepEqual(checkReport({
      id: 'ok-report',
      type: 'report',
      report: okPath,
      schema: 'custom.schema',
      expect: [
        { path: 'ok', equals: true },
        { path: 'outputSize', min: 1024 },
      ],
      requiredForFullReadiness: true,
    }), {
      name: 'ok-report',
      requiredForFullReadiness: true,
      generationCases: [],
      command: null,
      report: okPath,
      status: 'ok',
      detail: `validated ${okPath}`,
    });

    const failedPath = path.join(dir, 'failed.json');
    await writeFile(failedPath, JSON.stringify({
      schema: 'custom.schema',
      checks: [{ name: 'stock', status: 'fail' }],
    }));
    assert.equal(checkReport({
      id: 'failed-report',
      type: 'report',
      report: failedPath,
      schema: 'custom.schema',
    }).status, 'fail');

    const tooSmallPath = path.join(dir, 'small.json');
    await writeFile(tooSmallPath, JSON.stringify({
      schema: 'custom.schema',
      ok: true,
      outputSize: 12,
    }));
    const tooSmall = checkReport({
      id: 'small-report',
      type: 'report',
      report: tooSmallPath,
      schema: 'custom.schema',
      expect: [{ path: 'outputSize', min: 1024 }],
    });
    assert.equal(tooSmall.status, 'fail');
    assert.equal(tooSmall.detail, 'outputSize expected >= 1024, got 12');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
