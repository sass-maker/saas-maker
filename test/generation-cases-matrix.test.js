import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildReport, runCaseSmoke, validateDeclaredReport } from '../scripts/smoke-generation-cases.js';

const matrix = JSON.parse(await readFile('config/generation-cases.json', 'utf8'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

test('generation cases matrix entries have smoke metadata', () => {
  assert.equal(matrix.$schema, 'reel-pipeline.generation-cases.v1');
  assert.ok(Array.isArray(matrix.cases));
  assert.ok(matrix.cases.length >= 1);
  for (const entry of matrix.cases) {
    assert.equal(typeof entry.id, 'string');
    assert.equal(typeof entry.description, 'string');
    assert.equal(typeof entry.smoke?.type, 'string');
  }
});

test('generation case command smokes reference existing package scripts', () => {
  for (const entry of matrix.cases) {
    const smoke = entry.smoke ?? {};
    if (smoke.type !== 'command') continue;
    if (smoke.command !== 'npm') continue;
    if (smoke.args?.[0] !== 'run') continue;

    const scriptName = smoke.args[1];
    assert.ok(packageJson.scripts[scriptName], `${entry.id} references missing package script ${scriptName}`);
  }
});

test('generation cases smoke report is stable machine-readable evidence', () => {
  const report = buildReport({
    matrix,
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      { name: 'marketing-render-modes', status: 'ok', report: 'tmp/render-mode-smoke/report.json' },
      { name: 'creator-mvp', status: 'manual', detail: '5 files present' },
    ],
  });

  assert.equal(report.schema, 'reel-pipeline.generation-cases-smoke.v1');
  assert.equal(report.generatedAt, '2026-07-09T00:00:00.000Z');
  assert.equal(report.matrixSchema, 'reel-pipeline.generation-cases.v1');
  assert.deepEqual(report.summary, { ok: 1, manual: 1 });
  assert.deepEqual(report.checks, [
    {
      name: 'marketing-render-modes',
      status: 'ok',
      detail: null,
      hint: null,
      report: 'tmp/render-mode-smoke/report.json',
    },
    {
      name: 'creator-mvp',
      status: 'manual',
      detail: '5 files present',
      hint: null,
      report: null,
    },
  ]);
});

test('generation case smoke fails closed for unsupported smoke types', () => {
  assert.deepEqual(runCaseSmoke({
    id: 'unknown-case',
    description: 'Unknown case',
    smoke: { type: 'mystery' },
  }), {
    name: 'unknown-case',
    status: 'fail',
    detail: 'unsupported smoke type: mystery',
  });
});

test('generation case command smoke times out instead of hanging', () => {
  const result = runCaseSmoke({
    id: 'slow-case',
    description: 'Slow command',
    smoke: {
      type: 'command',
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      timeoutMs: 10,
    },
  });

  assert.equal(result.name, 'slow-case');
  assert.equal(result.status, 'fail');
  assert.equal(result.detail, 'timed out after 10ms');
});

test('generation case report validation catches missing malformed and failed nested reports', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'generation-report-'));
  try {
    const missing = path.join(dir, 'missing.json');
    assert.deepEqual(validateDeclaredReport(missing), {
      ok: false,
      detail: `missing report ${missing}`,
    });

    const malformed = path.join(dir, 'malformed.json');
    await writeFile(malformed, '{ nope');
    const malformedResult = validateDeclaredReport(malformed);
    assert.equal(malformedResult.ok, false);
    assert.match(malformedResult.detail, /^invalid report /);

    const failed = path.join(dir, 'failed.json');
    await writeFile(failed, JSON.stringify({
      schema: 'reel-pipeline.render-mode-smoke.v1',
      checks: [
        { name: 'mock', status: 'ok' },
        { name: 'stock', status: 'fail' },
      ],
    }));
    assert.deepEqual(validateDeclaredReport(failed), {
      ok: false,
      detail: `report ${failed} has failed checks: stock`,
    });

    const lesson = path.join(dir, 'lesson.json');
    await writeFile(lesson, JSON.stringify({
      schema: 'reel-pipeline.lesson-local-smoke.v1',
      ok: true,
    }));
    assert.deepEqual(validateDeclaredReport(lesson), {
      ok: true,
      detail: `report ${lesson} validated`,
    });

    assert.deepEqual(validateDeclaredReport(lesson, {
      freshAfterMs: Date.now() + 60_000,
      command: 'npm run smoke:lesson-local',
    }), {
      ok: false,
      detail: `report ${lesson} was not refreshed by npm run smoke:lesson-local`,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
