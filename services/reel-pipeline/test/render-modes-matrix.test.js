import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createRenderer } from '../src/pipeline.js';
import { normalizeVideoBrief } from '../src/video-brief.js';
import { buildReport, runModeSmoke } from '../scripts/smoke-render-modes.js';

const matrix = JSON.parse(await readFile('config/render-modes.json', 'utf8'));

const baseBrief = {
  id: 'matrix-brief',
  projectSlug: 'linkchat',
  channel: 'youtube_shorts',
  title: 'Matrix mode check',
  hook: 'Every supported mode should stay wired.',
  body: [
    'Script: check mode wiring.',
    'Shot list: brief validation, renderer creation, readiness smoke.',
    'Captions: validate, create, smoke.',
    'Asset prompts: clean vertical product UI.',
  ].join('\n'),
};

test('render mode matrix entries have smoke metadata', () => {
  assert.equal(matrix.$schema, 'reel-pipeline.render-modes.v1');
  assert.ok(Array.isArray(matrix.modes));
  assert.ok(matrix.modes.length >= 1);
  for (const mode of matrix.modes) {
    assert.equal(typeof mode.id, 'string');
    assert.equal(typeof mode.provider, 'string');
    assert.equal(typeof mode.surface, 'string');
    assert.equal(typeof mode.smoke?.type, 'string');
  }
});

test('render-accepted matrix modes and aliases are accepted by Node pipeline', () => {
  const renderAcceptedModes = matrix.modes.filter((mode) => mode.surface === 'render-accepted');
  assert.ok(renderAcceptedModes.length >= 1);

  for (const mode of renderAcceptedModes) {
    for (const value of [mode.id, ...(mode.aliases ?? [])]) {
      const brief = normalizeVideoBrief({ ...baseBrief, renderMode: value });
      assert.equal(brief.renderMode, value);
      assert.doesNotThrow(() => createRenderer(value), value);
    }
  }
});

test('render mode smoke report is stable machine-readable evidence', () => {
  const report = buildReport({
    matrix,
    now: new Date('2026-07-09T00:00:00.000Z'),
    checks: [
      { name: 'mock', status: 'ok', detail: 'provider=mock status=completed manifest=/tmp/manifest.json' },
      { name: 'moneyprinterturbo', status: 'skip', hint: 'start service' },
    ],
  });

  assert.equal(report.schema, 'reel-pipeline.render-mode-smoke.v1');
  assert.equal(report.generatedAt, '2026-07-09T00:00:00.000Z');
  assert.equal(report.matrixSchema, 'reel-pipeline.render-modes.v1');
  assert.deepEqual(report.summary, { ok: 1, skip: 1 });
  assert.deepEqual(report.checks, [
    {
      name: 'mock',
      status: 'ok',
      detail: 'provider=mock status=completed manifest=/tmp/manifest.json',
      hint: null,
    },
    {
      name: 'moneyprinterturbo',
      status: 'skip',
      detail: null,
      hint: 'start service',
    },
  ]);
});

test('render mode smoke fails closed for unsupported smoke types', () => {
  assert.deepEqual(runModeSmoke({
    id: 'unknown-mode',
    provider: 'unknown',
    surface: 'render-accepted',
    smoke: { type: 'mystery' },
  }), {
    name: 'unknown-mode',
    status: 'fail',
    detail: 'unsupported smoke type: mystery',
  });
});

test('render mode command smoke times out as an optional skipped check', () => {
  const result = runModeSmoke({
    id: 'slow-mode',
    provider: 'slow',
    surface: 'worker-reel-id',
    smoke: {
      type: 'command',
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      timeoutMs: 10,
    },
  });

  assert.equal(result.name, 'slow-mode');
  assert.equal(result.status, 'skip');
  assert.equal(result.detail, 'timed out after 10ms');
});
