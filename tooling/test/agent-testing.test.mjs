import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateManifest } from '../agent-testing/lib/manifest.mjs';
import { executeBenchmark, runPhase } from '../agent-testing/lib/runner.mjs';
import { median, observedP95 } from '../agent-testing/lib/statistics.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(testDirectory, '../agent-testing/fixtures');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

test('strict manifest validation rejects unknown fields, shell commands and invalid counts', async () => {
  const manifestPath = path.join(fixtures, 'good.manifest.json');
  const manifest = await readJson(manifestPath);
  assert.equal(validateManifest(manifest, manifestPath).id, 'fixture.good');
  assert.throws(() => validateManifest({ ...manifest, secret: 'no' }, manifestPath), /unknown field secret/);
  assert.throws(
    () => validateManifest({ ...manifest, runs: { warm: 101, cold: 0 } }, manifestPath),
    /between 0 and 100/,
  );
  assert.throws(
    () =>
      validateManifest(
        { ...manifest, phases: { ...manifest.phases, workflow: { command: ['sh', '-c', 'true'], timeoutMs: 1000 } } },
        manifestPath,
      ),
    /must not invoke a shell/,
  );
});

test('good fixture records warm and cold passes with allowlisted metrics only', async () => {
  const manifestPath = path.join(fixtures, 'good.manifest.json');
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'agent-testing-good-'));
  const marker = 'dummy-secret-must-not-be-serialized-7b98c';
  process.env.AGENT_TESTING_DUMMY_SECRET = marker;
  let result;
  try {
    result = await executeBenchmark(await readJson(manifestPath), { manifestPath, outputDirectory });
  } finally {
    delete process.env.AGENT_TESTING_DUMMY_SECRET;
  }
  assert.equal(result.summary.qualification.status, 'qualified');
  assert.equal(result.summary.warm.passed, 2);
  assert.equal(result.summary.cold.passed, 1);
  assert.equal(result.summary.warm.modelCalls, 2);
  assert.equal(result.summary.warm.metricMedianMs.modelMs, 7);
  assert.equal(result.summary.warm.seededDefectsMissed, 0);
  assert.deepEqual(result.receipt.runs[0].artifacts, ['evidence/checkpoint.png']);
  const serialized = await readFile(path.join(outputDirectory, 'receipt.json'), 'utf8');
  assert.doesNotMatch(serialized, /fixture workflow output/);
  assert.doesNotMatch(serialized, new RegExp(marker));
});

test('green workflow with a failed oracle is an incorrect completion', async () => {
  const manifestPath = path.join(fixtures, 'broken.manifest.json');
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'agent-testing-broken-'));
  const result = await executeBenchmark(await readJson(manifestPath), { manifestPath, outputDirectory });
  assert.equal(result.receipt.runs[0].phases.workflow.status, 'passed');
  assert.equal(result.receipt.runs[0].phases.verification.status, 'failed');
  assert.equal(result.receipt.runs[0].status, 'incorrect');
  assert.equal(result.summary.qualification.status, 'not-qualified');
});

test('bounded execution marks and terminates a hung phase', async () => {
  const result = await runPhase({
    name: 'workflow',
    phase: { command: ['node', 'adapter.mjs', 'hang'], timeoutMs: 100 },
    cwd: fixtures,
    environment: {},
  });
  assert.equal(result.status, 'timed_out');
  assert.equal(result.reason, 'timeout');
  assert.ok(result.durationMs < 2_000);
});

test('invalid adapter counters fail closed without retaining command output', async () => {
  const result = await runPhase({
    name: 'workflow',
    phase: { command: ['node', 'adapter.mjs', 'invalid-counter'], timeoutMs: 2_000 },
    cwd: fixtures,
    environment: {},
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'invalid-adapter-output');
  assert.equal('metrics' in result, false);
});

test('library API refuses to overwrite a non-empty output directory', async () => {
  const manifestPath = path.join(fixtures, 'good.manifest.json');
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'agent-testing-existing-'));
  await writeFile(path.join(outputDirectory, 'keep.txt'), 'preserve me');
  await assert.rejects(
    executeBenchmark(await readJson(manifestPath), { manifestPath, outputDirectory }),
    /new or empty directory/,
  );
  assert.equal(await readFile(path.join(outputDirectory, 'keep.txt'), 'utf8'), 'preserve me');
});

test('median and observed p95 retain exact small-sample semantics', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(observedP95([4, 1, 3, 2]), 4);
  assert.equal(median([]), null);
  assert.equal(observedP95([]), null);
});
