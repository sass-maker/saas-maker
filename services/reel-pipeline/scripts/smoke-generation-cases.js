#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CASE_MATRIX = 'config/generation-cases.json';
const REPORT_PATH = process.env.GENERATION_CASE_SMOKE_REPORT ?? 'tmp/generation-cases-smoke/report.json';
const DEFAULT_COMMAND_TIMEOUT_MS = parsePositiveInt(process.env.GENERATION_CASE_SMOKE_TIMEOUT_MS, 10 * 60 * 1000);

if (isMain()) {
  main();
}

function main() {
  const matrix = JSON.parse(readFileSync(CASE_MATRIX, 'utf8'));
  const checks = matrix.cases.map(runCaseSmoke);
  const report = buildReport({ matrix, checks });
  writeReport(REPORT_PATH, report);

  let failed = false;
  for (const check of checks) {
    if (check.status === 'fail') failed = true;
    const detail = check.detail ? `: ${check.detail}` : '';
    console.log(`${check.status} ${check.name}${detail}`);
    if (check.hint) console.log(`  ${check.hint}`);
  }
  console.log(`report ${REPORT_PATH}`);

  if (failed) process.exit(1);
}

export function buildReport({ matrix, checks, now = new Date() }) {
  const summary = checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    schema: 'reel-pipeline.generation-cases-smoke.v1',
    generatedAt: now.toISOString(),
    matrixSchema: matrix.$schema ?? null,
    matrixPath: CASE_MATRIX,
    summary,
    checks: checks.map((check) => ({
      name: check.name,
      status: check.status,
      detail: check.detail ?? null,
      hint: check.hint ?? null,
      report: check.report ?? null,
    })),
  };
}

export function runCaseSmoke(entry) {
  const smoke = entry.smoke ?? {};
  if (smoke.type === 'command') {
    return commandCheck(entry, smoke);
  }
  if (smoke.type === 'files') {
    return filesCheck(entry, smoke);
  }
  return {
    name: entry.id,
    status: 'fail',
    detail: `unsupported smoke type: ${smoke.type ?? 'none'}`,
  };
}

function commandCheck(entry, smoke) {
  const startedAtMs = Date.now();
  const result = spawnSync(smoke.command, smoke.args ?? [], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    timeout: commandTimeoutMs(smoke),
  });
  if (result.status !== 0) {
    return {
      name: entry.id,
      status: 'fail',
      detail: commandFailureDetail(result, commandTimeoutMs(smoke)),
      hint: smoke.hint,
      report: smoke.report,
    };
  }
  const reportCheck = validateDeclaredReport(smoke.report, {
    freshAfterMs: startedAtMs,
    command: `${smoke.command} ${(smoke.args ?? []).join(' ')}`.trim(),
  });
  if (reportCheck && !reportCheck.ok) {
    return {
      name: entry.id,
      status: 'fail',
      detail: reportCheck.detail,
      hint: smoke.hint,
      report: smoke.report,
    };
  }
  return {
    name: entry.id,
    status: smoke.status ?? 'ok',
    detail: [
      `${smoke.command} ${(smoke.args ?? []).join(' ')}`,
      reportCheck?.detail,
    ].filter(Boolean).join('; '),
    hint: smoke.hint,
    report: smoke.report,
  };
}

function filesCheck(entry, smoke) {
  const missing = (smoke.paths ?? []).filter((filePath) => !existsSync(filePath));
  if (missing.length) {
    return {
      name: entry.id,
      status: 'fail',
      detail: `missing ${missing.join(', ')}`,
      hint: smoke.hint,
    };
  }
  return {
    name: entry.id,
    status: smoke.status ?? 'ok',
    detail: `${smoke.paths.length} files present`,
    hint: smoke.hint,
  };
}

function writeReport(reportPath, payload) {
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function validateDeclaredReport(reportPath, options = {}) {
  if (!reportPath) return null;
  if (!existsSync(reportPath)) {
    return { ok: false, detail: `missing report ${reportPath}` };
  }

  if (Number.isFinite(options.freshAfterMs)) {
    const stat = statSync(reportPath);
    if (stat.mtimeMs + 100 < options.freshAfterMs) {
      const command = options.command ? ` by ${options.command}` : '';
      return { ok: false, detail: `report ${reportPath} was not refreshed${command}` };
    }
  }

  let payload;
  try {
    payload = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch (error) {
    return { ok: false, detail: `invalid report ${reportPath}: ${formatError(error)}` };
  }

  if (Array.isArray(payload.checks)) {
    const failed = payload.checks
      .filter((check) => check?.status === 'fail')
      .map((check) => check.name ?? 'unknown');
    if (failed.length) {
      return { ok: false, detail: `report ${reportPath} has failed checks: ${failed.join(', ')}` };
    }
  }

  if (payload.schema === 'reel-pipeline.lesson-local-smoke.v1' && payload.ok !== true) {
    return { ok: false, detail: `report ${reportPath} has ok=${payload.ok}` };
  }

  return { ok: true, detail: `report ${reportPath} validated` };
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  return String(error);
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

function commandFailureDetail(result, timeoutMs) {
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    return `timed out after ${timeoutMs}ms`;
  }
  return lastUsefulLine(result);
}

function commandTimeoutMs(config) {
  return parsePositiveInt(config.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
