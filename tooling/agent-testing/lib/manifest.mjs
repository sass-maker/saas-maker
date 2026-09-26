import { dirname, resolve } from 'node:path';

export const MANIFEST_SCHEMA_VERSION = 'fleet.agent-testing.manifest.v1';
export const RECEIPT_SCHEMA_VERSION = 'fleet.agent-testing.receipt.v1';

const topLevelKeys = new Set([
  'schemaVersion',
  'id',
  'platform',
  'journey',
  'candidate',
  'sample',
  'workingDirectory',
  'runs',
  'phases',
]);
const runKeys = new Set(['warm', 'cold']);
const phaseNames = [
  'setup',
  'reset',
  'readiness',
  'observation',
  'workflow',
  'verification',
  'teardown',
];
const phaseKeys = new Set(['command', 'timeoutMs']);
const allowedPlatforms = new Set(['web', 'ios', 'android', 'desktop', 'other']);
const allowedSamples = new Set(['screening', 'qualification', 'exploration']);
const shellExecutables = new Set([
  'bash',
  'cmd',
  'cmd.exe',
  'csh',
  'fish',
  'powershell',
  'powershell.exe',
  'pwsh',
  'sh',
  'tcsh',
  'zsh',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function rejectUnknownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label} contains unknown field ${key}`);
  }
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(value)) {
    throw new Error(`${label} must be a lowercase portable identifier`);
  }
}

function validateRunCount(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be an integer between 0 and 100`);
  }
}

function validatePhase(phase, name) {
  assertPlainObject(phase, `phases.${name}`);
  rejectUnknownKeys(phase, phaseKeys, `phases.${name}`);
  if (!Array.isArray(phase.command) || phase.command.length === 0) {
    throw new Error(`phases.${name}.command must be a non-empty string array`);
  }
  if (phase.command.some((part) => typeof part !== 'string' || part.length === 0)) {
    throw new Error(`phases.${name}.command must contain only non-empty strings`);
  }
  const executable = phase.command[0].split('/').at(-1).toLowerCase();
  if (shellExecutables.has(executable)) {
    throw new Error(`phases.${name}.command must not invoke a shell`);
  }
  if (!Number.isInteger(phase.timeoutMs) || phase.timeoutMs < 100 || phase.timeoutMs > 600_000) {
    throw new Error(`phases.${name}.timeoutMs must be between 100 and 600000`);
  }
}

export function validateManifest(manifest, manifestPath = process.cwd()) {
  assertPlainObject(manifest, 'manifest');
  rejectUnknownKeys(manifest, topLevelKeys, 'manifest');
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`);
  }
  for (const field of ['id', 'journey', 'candidate']) assertIdentifier(manifest[field], field);
  if (!allowedPlatforms.has(manifest.platform)) {
    throw new Error(`platform must be one of ${[...allowedPlatforms].join(', ')}`);
  }
  if (!allowedSamples.has(manifest.sample)) {
    throw new Error(`sample must be one of ${[...allowedSamples].join(', ')}`);
  }
  if (typeof manifest.workingDirectory !== 'string' || manifest.workingDirectory.length === 0) {
    throw new Error('workingDirectory must be a non-empty string');
  }
  assertPlainObject(manifest.runs, 'runs');
  rejectUnknownKeys(manifest.runs, runKeys, 'runs');
  validateRunCount(manifest.runs.warm, 'runs.warm');
  validateRunCount(manifest.runs.cold, 'runs.cold');
  if (manifest.runs.warm + manifest.runs.cold === 0) {
    throw new Error('at least one warm or cold run is required');
  }
  assertPlainObject(manifest.phases, 'phases');
  rejectUnknownKeys(manifest.phases, new Set(phaseNames), 'phases');
  if (!manifest.phases.workflow || !manifest.phases.verification) {
    throw new Error('phases.workflow and phases.verification are required');
  }
  for (const name of phaseNames) {
    if (manifest.phases[name]) validatePhase(manifest.phases[name], name);
  }

  return {
    ...manifest,
    resolvedWorkingDirectory: resolve(dirname(manifestPath), manifest.workingDirectory),
  };
}

export function publicManifest(manifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    platform: manifest.platform,
    journey: manifest.journey,
    candidate: manifest.candidate,
    sample: manifest.sample,
    runs: { ...manifest.runs },
  };
}

export const PHASE_NAMES = Object.freeze(phaseNames);
