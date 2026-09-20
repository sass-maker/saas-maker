import { spawn } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import {
  PHASE_NAMES,
  RECEIPT_SCHEMA_VERSION,
  publicManifest,
  validateManifest,
} from './manifest.mjs';
import { summarizeReceipt } from './statistics.mjs';

const metricKeys = new Set([
  'setupMs',
  'resetMs',
  'readinessMs',
  'observationMs',
  'modelMs',
  'controlMs',
  'applicationWaitMs',
  'controlAndApplicationWaitMs',
  'verificationMs',
  'unassignedMs',
  'modelCalls',
  'inputTokens',
  'outputTokens',
  'imageInputs',
  'apiSpendUsd',
  'subscriptionUnits',
  'seededDefectsDetected',
  'seededDefectsMissed',
  'falseAlarms',
  'retries',
  'manualInterventions',
]);
const counterMetricKeys = new Set([
  'modelCalls',
  'inputTokens',
  'outputTokens',
  'imageInputs',
  'seededDefectsDetected',
  'seededDefectsMissed',
  'falseAlarms',
  'retries',
  'manualInterventions',
]);
const adapterOutputKeys = new Set(['metrics', 'artifacts']);
const maximumCapturedBytes = 64 * 1024;

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}`);
  }
}

function validateAdapterOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('adapter output must be an object');
  }
  rejectUnknownKeys(value, adapterOutputKeys, 'adapter output');
  const metrics = value.metrics ?? {};
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new Error('adapter output metrics must be an object');
  }
  rejectUnknownKeys(metrics, metricKeys, 'adapter output metrics');
  for (const [key, metric] of Object.entries(metrics)) {
    if (!Number.isFinite(metric) || metric < 0) {
      throw new Error(`adapter output metric ${key} must be a non-negative finite number`);
    }
    if (counterMetricKeys.has(key) && !Number.isInteger(metric)) {
      throw new Error(`adapter output metric ${key} must be an integer`);
    }
  }
  const artifacts = value.artifacts ?? [];
  if (!Array.isArray(artifacts) || artifacts.length > 100) {
    throw new Error('adapter output artifacts must be an array with at most 100 entries');
  }
  for (const artifact of artifacts) {
    if (
      typeof artifact !== 'string'
      || artifact.length === 0
      || isAbsolute(artifact)
      || artifact.split(/[\\/]/).includes('..')
    ) {
      throw new Error('adapter artifact references must be relative paths without parent traversal');
    }
  }
  return { metrics, artifacts };
}

function parseAdapterOutput(stdout) {
  const marker = 'FLEET_AGENT_TEST_RESULT=';
  const line = stdout
    .split(/\r?\n/)
    .filter((candidate) => candidate.startsWith(marker))
    .at(-1);
  if (!line) return { metrics: {}, artifacts: [] };
  return validateAdapterOutput(JSON.parse(line.slice(marker.length)));
}

function appendBoundedTail(current, chunk) {
  return (current + chunk).slice(-maximumCapturedBytes);
}

export async function runPhase({ name, phase, cwd, environment }) {
  const started = nowMs();
  return await new Promise((resolvePhase) => {
    let stdout = '';
    let timedOut = false;
    let settled = false;
    const child = spawn(phase.command[0], phase.command.slice(1), {
      cwd,
      env: { ...process.env, ...environment },
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout = appendBoundedTail(stdout, chunk);
    });

    const stop = (signal) => {
      try {
        if (process.platform === 'win32') child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch {}
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      stop('SIGTERM');
      setTimeout(() => stop('SIGKILL'), 500).unref();
    }, phase.timeoutMs);

    const finish = (exitCode, spawnError = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result = {
        status: timedOut ? 'timed_out' : exitCode === 0 && !spawnError ? 'passed' : 'failed',
        durationMs: nowMs() - started,
        exitCode: Number.isInteger(exitCode) ? exitCode : null,
      };
      if (spawnError) result.reason = 'spawn-error';
      else if (timedOut) result.reason = 'timeout';
      else if (exitCode !== 0) result.reason = 'nonzero-exit';
      if (result.status === 'passed') {
        try {
          Object.assign(result, parseAdapterOutput(stdout));
        } catch {
          result.status = 'failed';
          result.reason = 'invalid-adapter-output';
        }
      }
      // stdout is intentionally never serialized or printed.
      stdout = '';
      resolvePhase(result);
    };

    child.on('error', () => finish(null, true));
    child.on('close', (code) => finish(code));
  });
}

function mergeMetrics(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = (target[key] ?? 0) + value;
}

function runEnvironment(outputRoot, runDirectory, temperature, iteration) {
  return {
    FLEET_AGENT_TEST_OUTPUT_ROOT: outputRoot,
    FLEET_AGENT_TEST_RUN_DIR: runDirectory,
    FLEET_AGENT_TEST_TEMPERATURE: temperature,
    FLEET_AGENT_TEST_ITERATION: String(iteration),
  };
}

async function executeOneRun(manifest, outputRoot, temperature, iteration) {
  const runId = `${temperature}-${String(iteration).padStart(2, '0')}`;
  const runDirectory = resolve(outputRoot, 'runs', runId);
  await mkdir(runDirectory, { recursive: true });
  const environment = runEnvironment(outputRoot, runDirectory, temperature, iteration);
  const phases = {};
  const metrics = {};
  const artifacts = [];
  const started = nowMs();
  let workflowPassed = false;
  let verificationPassed = false;
  let stoppedEarly = false;

  for (const name of ['reset', 'readiness', 'observation', 'workflow', 'verification']) {
    const phase = manifest.phases[name];
    if (!phase) continue;
    if (stoppedEarly) {
      phases[name] = { status: 'skipped', durationMs: 0, exitCode: null, reason: 'earlier-phase-failed' };
      continue;
    }
    const result = await runPhase({ name, phase, cwd: manifest.resolvedWorkingDirectory, environment });
    phases[name] = {
      status: result.status,
      durationMs: result.durationMs,
      exitCode: result.exitCode,
      ...(result.reason ? { reason: result.reason } : {}),
    };
    mergeMetrics(metrics, result.metrics);
    artifacts.push(...(result.artifacts ?? []));
    if (name === 'workflow') workflowPassed = result.status === 'passed';
    if (name === 'verification') verificationPassed = result.status === 'passed';
    if (result.status !== 'passed') stoppedEarly = true;
  }

  const phaseResults = Object.values(phases);
  const timedOut = phaseResults.some((phase) => phase.status === 'timed_out');
  const status = timedOut
    ? 'timed_out'
    : workflowPassed && !verificationPassed
      ? 'incorrect'
      : workflowPassed && verificationPassed
        ? 'passed'
        : 'failed';
  return {
    runId,
    temperature,
    iteration,
    status,
    totalMs: nowMs() - started,
    phases,
    metrics,
    artifacts: [...new Set(artifacts)],
  };
}

export async function executeBenchmark(rawManifest, { manifestPath, outputDirectory }) {
  const manifest = validateManifest(rawManifest, manifestPath);
  const outputRoot = resolve(outputDirectory);
  await mkdir(outputRoot, { recursive: true });
  if ((await readdir(outputRoot)).length > 0) {
    throw new Error('outputDirectory must be a new or empty directory');
  }
  const receipt = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    benchmark: publicManifest(manifest),
    startedAt: new Date().toISOString(),
    setup: null,
    teardown: null,
    runs: [],
  };
  const sharedEnvironment = {
    FLEET_AGENT_TEST_OUTPUT_ROOT: outputRoot,
    FLEET_AGENT_TEST_RUN_DIR: outputRoot,
    FLEET_AGENT_TEST_TEMPERATURE: 'shared',
    FLEET_AGENT_TEST_ITERATION: '0',
  };

  try {
    if (manifest.phases.setup) {
      receipt.setup = await runPhase({
        name: 'setup',
        phase: manifest.phases.setup,
        cwd: manifest.resolvedWorkingDirectory,
        environment: sharedEnvironment,
      });
    }
    if (!receipt.setup || receipt.setup.status === 'passed') {
      for (const temperature of ['cold', 'warm']) {
        const count = manifest.runs[temperature];
        for (let iteration = 1; iteration <= count; iteration += 1) {
          receipt.runs.push(await executeOneRun(manifest, outputRoot, temperature, iteration));
        }
      }
    }
  } finally {
    if (manifest.phases.teardown) {
      receipt.teardown = await runPhase({
        name: 'teardown',
        phase: manifest.phases.teardown,
        cwd: manifest.resolvedWorkingDirectory,
        environment: sharedEnvironment,
      });
    }
  }

  receipt.completedAt = new Date().toISOString();
  const summary = summarizeReceipt(receipt);
  await writeFile(resolve(outputRoot, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  await writeFile(resolve(outputRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return { receipt, summary, outputRoot };
}

export function relativeOutputPath(base, target) {
  return relative(base, target) || '.';
}

export { PHASE_NAMES };
