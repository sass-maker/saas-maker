#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_MATRIX = 'config/live-generation-readiness.json';
const DEFAULT_REPORT = process.env.GENERATION_READINESS_REPORT ?? 'tmp/generation-readiness/report.json';
const DEFAULT_COMMAND_TIMEOUT_MS = parsePositiveInt(process.env.GENERATION_READINESS_TIMEOUT_MS, 10 * 60 * 1000);
const ACCEPTANCE_SCHEMA = 'reel-pipeline.target-host-acceptance.v1';

if (isMain()) {
  main();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrixPath = args.matrix ?? DEFAULT_MATRIX;
  const reportPath = args.report ?? DEFAULT_REPORT;
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
  const acceptance = args.acceptance ? readAcceptance(args.acceptance) : null;
  const refreshes = args.refresh ? matrix.checks.map((entry) => runRefresh(entry)) : [];
  const refreshByName = new Map(refreshes.map((refresh) => [refresh.name, refresh]));
  const checks = matrix.checks.map((entry) => runReadinessCheck(entry, refreshByName.get(entry.id)));
  const report = buildReport({
    matrix,
    matrixPath,
    checks,
    refreshes,
    strict: args.strict,
    refresh: args.refresh,
    failUnresolved: args.failUnresolved,
    acceptance,
    acceptancePath: args.acceptance ?? null,
  });

  if (!args.noWrite) writeReport(reportPath, report);

  for (const refresh of refreshes) {
    const detail = refresh.detail ? `: ${refresh.detail}` : '';
    console.log(`${refresh.status} refresh ${refresh.name}${detail}`);
  }
  for (const check of checks) {
    const detail = check.detail ? `: ${check.detail}` : '';
    console.log(`${check.status} ${formatCheckLabel(check)}${detail}`);
    if (check.command) console.log(`  ${check.command}`);
  }
  for (const accepted of report.acceptedUnresolved) {
    console.log(`accepted ${formatCheckLabel(accepted)}: ${accepted.reason}`);
    console.log(`  ${accepted.evidence}`);
  }
  for (const invalid of report.invalidAcceptances) {
    console.log(`invalid acceptance ${invalid.index}: ${invalid.name ?? 'unknown'}: ${invalid.reason}`);
  }
  for (const entry of report.generationCaseReadiness) {
    console.log(formatGenerationCaseReadiness(entry));
  }
  for (const action of report.targetHostNextActions) {
    console.log(formatTargetHostNextAction(action));
  }
  console.log([
    `strictReady=${String(report.strictReady)}`,
    `targetHostReady=${String(report.targetHostReady)}`,
    `blocking=${report.blocking.length}`,
    `unresolved=${report.unresolved.length}`,
    `acceptedUnresolved=${report.acceptedUnresolved.length}`,
    `invalidAcceptances=${report.invalidAcceptances.length}`,
  ].join(' '));
  if (!args.noWrite) console.log(`report ${reportPath}`);

  if (shouldExitNonZero(args, report)) {
    process.exit(1);
  }
}

export function shouldExitNonZero(args, report) {
  if (args.strict && report.strictReady === false) return true;
  if (args.failUnresolved && report.targetHostReady === false) return true;
  return false;
}

export function buildReport({
  matrix,
  matrixPath = DEFAULT_MATRIX,
  checks,
  refreshes = [],
  strict = false,
  refresh = false,
  failUnresolved = false,
  acceptance = null,
  acceptancePath = null,
  now = new Date(),
}) {
  const summary = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  }, {});
  const blocking = checks.filter((check) => check.requiredForFullReadiness && check.status !== 'ok');
  const allUnresolved = checks.filter((check) => ['manual', 'missing'].includes(check.status));
  const acceptanceValidation = validateAcceptance(acceptance, allUnresolved);
  const acceptedByName = acceptanceValidation.acceptedByName;
  const acceptedUnresolved = allUnresolved
    .filter((check) => acceptedByName.has(check.name))
    .map((check) => acceptedUnresolvedEntry(check, acceptedByName.get(check.name)));
  const unresolved = allUnresolved.filter((check) => !acceptedByName.has(check.name));
  const targetHostReady = blocking.length === 0
    && unresolved.length === 0
    && acceptanceValidation.invalid.length === 0;
  const generationCaseReadiness = buildGenerationCaseReadiness({
    checks,
    blocking,
    unresolved,
    acceptedUnresolved,
  });
  const targetHostNextActions = buildTargetHostNextActions({ checks, blocking, unresolved });
  return {
    schema: 'reel-pipeline.generation-readiness-report.v1',
    generatedAt: now.toISOString(),
    matrixSchema: matrix.$schema ?? null,
    matrixPath,
    strict,
    refresh,
    failUnresolved,
    acceptancePath,
    acceptanceSchema: acceptance?.$schema ?? null,
    acceptanceTargetHost: acceptance?.targetHost ?? null,
    strictReady: strict ? blocking.length === 0 : null,
    targetHostReady,
    targetHostNextActions,
    generationCaseReadiness,
    summary,
    refreshes: refreshes.map((entry) => ({
      name: entry.name,
      status: entry.status,
      detail: entry.detail ?? null,
      command: entry.command ?? null,
      startedAt: entry.startedAt ?? null,
    })),
    blocking: blocking.map((check) => ({
      name: check.name,
      status: check.status,
      generationCases: check.generationCases,
      detail: check.detail ?? null,
      command: check.command ?? null,
      ...optionalDocs(check),
    })),
    unresolved: unresolved.map((check) => ({
      name: check.name,
      status: check.status,
      requiredForFullReadiness: Boolean(check.requiredForFullReadiness),
      generationCases: check.generationCases,
      detail: check.detail ?? null,
      command: check.command ?? null,
      ...optionalDocs(check),
    })),
    acceptedUnresolved,
    invalidAcceptances: acceptanceValidation.invalid,
    checks: checks.map((check) => ({
      name: check.name,
      status: check.status,
      requiredForFullReadiness: Boolean(check.requiredForFullReadiness),
      generationCases: check.generationCases,
      detail: check.detail ?? null,
      command: check.command ?? null,
      report: check.report ?? null,
      ...optionalDocs(check),
    })),
  };
}

export function buildTargetHostNextActions({ checks, blocking, unresolved }) {
  const openNames = new Set([
    ...blocking.map((check) => check.name),
    ...unresolved.map((check) => check.name),
  ]);
  return checks
    .filter((check) => openNames.has(check.name))
    .map((check) => ({
      name: check.name,
      status: check.status,
      requiredForFullReadiness: Boolean(check.requiredForFullReadiness),
      generationCases: check.generationCases,
      detail: check.detail ?? null,
      command: check.command ?? null,
      ...optionalDocs(check),
    }));
}

export function buildGenerationCaseReadiness({ checks, blocking, unresolved, acceptedUnresolved }) {
  const caseNames = [];
  const byCase = new Map();
  const ensureCase = (name) => {
    if (!byCase.has(name)) {
      caseNames.push(name);
      byCase.set(name, {
        name,
        targetHostReady: true,
        checks: [],
        openChecks: [],
        acceptedChecks: [],
      });
    }
    return byCase.get(name);
  };

  const blockingNames = new Set(blocking.map((check) => check.name));
  const unresolvedNames = new Set(unresolved.map((check) => check.name));
  const acceptedByName = new Map(acceptedUnresolved.map((check) => [check.name, check]));

  for (const check of checks) {
    for (const caseName of check.generationCases ?? []) {
      const entry = ensureCase(caseName);
      entry.checks.push({
        name: check.name,
        status: check.status,
        requiredForFullReadiness: Boolean(check.requiredForFullReadiness),
      });
      if (blockingNames.has(check.name) || unresolvedNames.has(check.name)) {
        entry.targetHostReady = false;
        entry.openChecks.push({
          name: check.name,
          status: check.status,
          blocking: blockingNames.has(check.name),
          unresolved: unresolvedNames.has(check.name),
          detail: check.detail ?? null,
          command: check.command ?? null,
          ...optionalDocs(check),
        });
      }
      if (acceptedByName.has(check.name)) {
        const accepted = acceptedByName.get(check.name);
        entry.acceptedChecks.push({
          name: check.name,
          status: check.status,
          reason: accepted.reason ?? null,
          evidence: accepted.evidence ?? null,
          acceptedBy: accepted.acceptedBy ?? null,
          acceptedAt: accepted.acceptedAt ?? null,
        });
      }
    }
  }

  return caseNames.map((name) => byCase.get(name));
}

export function runReadinessCheck(entry, refresh = null) {
  if (refresh?.status === 'fail') {
    return baseResult(entry, {
      status: 'fail',
      detail: `refresh failed: ${refresh.detail}`,
    });
  }
  if (refresh?.status === 'ok' && entry.type === 'report') {
    const freshness = validateReportFreshness(entry, refresh);
    if (!freshness.ok) {
      return baseResult(entry, {
        status: 'fail',
        detail: freshness.detail,
      });
    }
  }
  if (entry.type === 'report') return checkReport(entry);
  if (entry.type === 'command') return checkCommand(entry);
  if (entry.type === 'env') return checkEnv(entry);
  if (entry.type === 'envAnyGroup') return checkEnvAnyGroup(entry);
  if (entry.type === 'manual') {
    return baseResult(entry, {
      status: 'manual',
      detail: entry.description ?? 'manual proof required',
    });
  }
  return baseResult(entry, {
    status: 'fail',
    detail: `unsupported readiness check type: ${entry.type ?? 'none'}`,
  });
}

function runRefresh(entry) {
  if (!entry.refreshable) {
    return {
      name: entry.id,
      status: 'skip',
      detail: 'not refreshable',
      command: displayCommand(entry),
    };
  }
  const command = entry.refreshCommand ?? displayCommand(entry);
  if (!command) {
    return {
      name: entry.id,
      status: 'skip',
      detail: 'no refresh command',
      command: null,
    };
  }
  const startedAtMs = Date.now();
  const timeoutMs = commandTimeoutMs(entry);
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    return {
      name: entry.id,
      status: 'fail',
      detail: commandFailureDetail(result, timeoutMs),
      command,
      startedAt: new Date(startedAtMs).toISOString(),
    };
  }
  return {
    name: entry.id,
    status: 'ok',
    detail: 'refreshed',
    command,
    startedAt: new Date(startedAtMs).toISOString(),
  };
}

function validateReportFreshness(entry, refresh) {
  if (!entry.report) return { ok: true };
  let stat;
  try {
    stat = statSync(entry.report);
  } catch {
    return { ok: false, detail: `refresh did not produce report ${entry.report}` };
  }
  const startedAtMs = Date.parse(refresh.startedAt);
  if (Number.isFinite(startedAtMs) && stat.mtimeMs + 100 < startedAtMs) {
    return {
      ok: false,
      detail: `report ${entry.report} was not refreshed by ${refresh.command}`,
    };
  }
  return { ok: true };
}

export function checkReport(entry) {
  if (!entry.report) {
    return baseResult(entry, { status: 'fail', detail: 'report path is required' });
  }
  if (!existsSync(entry.report)) {
    return baseResult(entry, { status: 'missing', detail: `missing report ${entry.report}` });
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(entry.report, 'utf8'));
  } catch (error) {
    return baseResult(entry, {
      status: 'fail',
      detail: `invalid report ${entry.report}: ${formatError(error)}`,
    });
  }

  if (entry.schema && payload.schema !== entry.schema) {
    return baseResult(entry, {
      status: 'fail',
      detail: `expected schema ${entry.schema}, got ${payload.schema ?? 'none'}`,
    });
  }

  const failed = Array.isArray(payload.checks)
    ? payload.checks.filter((check) => check?.status === 'fail').map((check) => check.name ?? 'unknown')
    : [];
  if (failed.length) {
    return baseResult(entry, {
      status: 'fail',
      detail: `report has failed checks: ${failed.join(', ')}`,
    });
  }

  const expectation = validateExpectations(payload, entry.expect ?? []);
  if (!expectation.ok) {
    return baseResult(entry, {
      status: 'fail',
      detail: expectation.detail,
    });
  }

  return baseResult(entry, {
    status: 'ok',
    detail: `validated ${entry.report}`,
  });
}

function checkCommand(entry) {
  const timeoutMs = commandTimeoutMs(entry);
  const result = spawnSync(entry.command, entry.args ?? [], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.status !== 0) {
    return baseResult(entry, {
      status: 'fail',
      detail: commandFailureDetail(result, timeoutMs),
    });
  }
  return baseResult(entry, {
    status: 'ok',
    detail: `${entry.command} ${(entry.args ?? []).join(' ')}`.trim(),
  });
}

function checkEnv(entry) {
  const missing = (entry.env ?? []).filter((name) => !process.env[name]);
  if (missing.length) {
    return baseResult(entry, {
      status: 'missing',
      detail: `missing env ${missing.join(', ')}`,
    });
  }
  return baseResult(entry, {
    status: 'ok',
    detail: `${entry.env.length} env vars present`,
  });
}

function checkEnvAnyGroup(entry) {
  const groups = entry.groups ?? [];
  const satisfied = groups.find((group) => group.every((name) => process.env[name]));
  if (satisfied) {
    return baseResult(entry, {
      status: 'ok',
      detail: `env group present: ${satisfied.join(', ')}`,
    });
  }
  const descriptions = groups.map((group) => group.join('+')).join(' or ');
  return baseResult(entry, {
    status: 'missing',
    detail: `missing env group: ${descriptions}`,
  });
}

function validateExpectations(payload, expectations) {
  for (const expectation of expectations) {
    const actual = getPath(payload, expectation.path);
    if ('equals' in expectation && actual !== expectation.equals) {
      return {
        ok: false,
        detail: expectationFailureDetail(payload, expectation, actual),
      };
    }
    if ('min' in expectation && !(Number(actual) >= Number(expectation.min))) {
      return {
        ok: false,
        detail: `${expectation.path} expected >= ${expectation.min}, got ${JSON.stringify(actual)}`,
      };
    }
  }
  return { ok: true };
}

function expectationFailureDetail(payload, expectation, actual) {
  const base = `${expectation.path} expected ${JSON.stringify(expectation.equals)}, got ${JSON.stringify(actual)}`;
  return payload?.error ? `${base}: ${payload.error}` : base;
}

function getPath(payload, dottedPath) {
  return String(dottedPath ?? '').split('.').filter(Boolean).reduce((value, key) => {
    if (value === null || value === undefined) return undefined;
    return value[key];
  }, payload);
}

function baseResult(entry, fields) {
  return {
    name: entry.id,
    requiredForFullReadiness: Boolean(entry.requiredForFullReadiness),
    generationCases: Array.isArray(entry.generationCases) ? entry.generationCases : [],
    command: displayCommand(entry),
    report: entry.report ?? null,
    ...optionalDocs(entry),
    ...fields,
  };
}

function optionalDocs(entry) {
  return entry.docs ? { docs: entry.docs } : {};
}

export function formatCheckLabel(check) {
  const generationCases = Array.isArray(check.generationCases)
    ? check.generationCases.filter(Boolean)
    : [];
  if (!generationCases.length) return check.name;
  return `${check.name} [${generationCases.join(', ')}]`;
}

export function formatGenerationCaseReadiness(entry) {
  const open = entry.openChecks.map((check) => check.name).join(', ') || 'none';
  const accepted = entry.acceptedChecks.map((check) => check.name).join(', ') || 'none';
  return [
    `case ${entry.name}`,
    `targetHostReady=${String(entry.targetHostReady)}`,
    `open=${open}`,
    `accepted=${accepted}`,
  ].join(' ');
}

export function formatTargetHostNextAction(action) {
  const docs = action.docs ? ` docs=${action.docs}` : '';
  const command = action.command ? ` command=${action.command}` : '';
  return `next ${formatCheckLabel(action)}: ${action.detail ?? action.status}${command}${docs}`;
}

function displayCommand(entry) {
  if (!entry.command) return null;
  if (Array.isArray(entry.args) && entry.args.length) {
    return `${entry.command} ${entry.args.join(' ')}`;
  }
  return entry.command;
}

function writeReport(reportPath, payload) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = { strict: false, refresh: false, failUnresolved: false, noWrite: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--refresh') args.refresh = true;
    else if (arg === '--fail-unresolved') args.failUnresolved = true;
    else if (arg === '--no-write') args.noWrite = true;
    else if (arg === '--matrix') args.matrix = argv[++index];
    else if (arg === '--report') args.report = argv[++index];
    else if (arg === '--acceptance') args.acceptance = argv[++index];
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  npm run check:generation-readiness
  npm run check:generation-readiness -- --strict
  npm run check:generation-readiness -- --refresh --strict
  npm run check:generation-readiness -- --refresh --strict --fail-unresolved
  npm run check:generation-readiness -- --refresh --strict --fail-unresolved --acceptance config/target-host-acceptance.json

Options:
  --strict        Exit non-zero unless every required local/live proof is ok.
  --refresh       Run refreshable commands before validating their reports.
  --fail-unresolved
                  Exit non-zero unless targetHostReady is true.
  --acceptance PATH
                  Read documented target-host acceptances for manual/missing checks.
  --matrix PATH   Read a different readiness matrix.
  --report PATH   Write the report to a different path.
  --no-write      Print checks without writing the report.

Each command uses a 10 minute default timeout. Set timeoutMs on a matrix entry
or GENERATION_READINESS_TIMEOUT_MS in the environment to override it.`);
}

function readAcceptance(acceptancePath) {
  try {
    return JSON.parse(readFileSync(acceptancePath, 'utf8'));
  } catch (error) {
    throw new Error(`could not read acceptance file ${acceptancePath}: ${formatError(error)}`);
  }
}

function validateAcceptance(acceptance, allUnresolved) {
  const entries = Array.isArray(acceptance?.acceptedUnresolved)
    ? acceptance.acceptedUnresolved
    : [];
  const accepted = new Map();
  const invalid = [];
  if (acceptance && acceptance.$schema !== ACCEPTANCE_SCHEMA) {
    invalid.push({ index: -1, name: '$schema', reason: `expected ${ACCEPTANCE_SCHEMA}` });
  }
  if (acceptance && (typeof acceptance.targetHost !== 'string' || acceptance.targetHost.trim() === '')) {
    invalid.push({ index: -1, name: 'targetHost', reason: 'missing targetHost' });
  }
  const unresolvedNames = new Set(allUnresolved.map((check) => check.name));
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry.name !== 'string' || entry.name.trim() === '') {
      invalid.push({ index, name: entry?.name ?? null, reason: 'missing name' });
      continue;
    }
    if (!unresolvedNames.has(entry.name)) {
      invalid.push({ index, name: entry.name, reason: 'does not match a current unresolved check' });
      continue;
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      invalid.push({ index, name: entry.name, reason: 'missing reason' });
      continue;
    }
    if (typeof entry.evidence !== 'string' || entry.evidence.trim() === '') {
      invalid.push({ index, name: entry.name, reason: 'missing evidence' });
      continue;
    }
    accepted.set(entry.name, entry);
  }
  return { acceptedByName: accepted, invalid };
}

function acceptedUnresolvedEntry(check, acceptance) {
  return {
    name: check.name,
    status: check.status,
    requiredForFullReadiness: Boolean(check.requiredForFullReadiness),
    generationCases: check.generationCases,
    reason: acceptance.reason,
    evidence: acceptance.evidence,
    acceptedBy: acceptance.acceptedBy ?? null,
    acceptedAt: acceptance.acceptedAt ?? null,
  };
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function commandFailureDetail(result, timeoutMs) {
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return `timed out after ${timeoutMs}ms`;
  }
  const jsonDetail = jsonFailureDetail(result);
  if (jsonDetail) return jsonDetail;
  return lastUsefulLine(result);
}

function jsonFailureDetail(result) {
  const payload = parseTrailingJson([result.stderr, result.stdout].filter(Boolean).join('\n'));
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (Array.isArray(payload.checks)) {
    const failed = payload.checks
      .filter((check) => check?.status === 'fail')
      .map((check) => [check.name, check.detail].filter(Boolean).join(': '));
    if (failed.length) return `failed checks: ${failed.join(', ')}`;
  }
  return null;
}

function parseTrailingJson(output) {
  const trimmed = String(output ?? '').trim();
  if (!trimmed) return null;
  const candidates = [];
  if (trimmed.startsWith('{')) candidates.push(trimmed);
  const objectStart = trimmed.lastIndexOf('\n{');
  if (objectStart >= 0) candidates.push(trimmed.slice(objectStart + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function commandTimeoutMs(entry) {
  return parsePositiveInt(entry.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function lastUsefulLine(result) {
  return [result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-1)[0] ?? `exit ${result.status}`;
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
