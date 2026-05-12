#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));
const repo = required(args.repo, 'repo');
const promptFile = required(args['prompt-file'], 'prompt-file');
const model = args.model || 'deepseek/deepseek-v4-pro';
const maxPasses = clampNumber(args['max-passes'], 1, 6, 3);
const idleTimeoutMs = clampNumber(args['idle-timeout'], 30, 600, 120) * 1000;
const passTimeoutMs = clampNumber(args['pass-timeout'], 60, 1800, 300) * 1000;
const validation = args.validation || 'git add -N . && git diff --check -- .';
const opencode = args.opencode || 'opencode';

const basePrompt = await readFile(promptFile, 'utf8');
let lastRun = null;

log('supervisor_start', {
  repo,
  model,
  max_passes: maxPasses,
  idle_timeout_seconds: idleTimeoutMs / 1000,
  pass_timeout_seconds: passTimeoutMs / 1000,
});

for (let pass = 1; pass <= maxPasses; pass += 1) {
  const prompt = pass === 1 ? basePrompt : retryPrompt(basePrompt, pass, lastRun);
  lastRun = await runOpenCode({ phase: 'build', pass, prompt });

  if (lastRun.exitCode === 0 && await hasDiff()) break;
  if (pass === maxPasses) {
    log('supervisor_no_diff', {
      pass,
      exit_code: lastRun.exitCode,
      stdout_tail: tail(lastRun.stdout),
      stderr_tail: tail(lastRun.stderr),
    });
    process.exit(lastRun.exitCode === 0 ? 2 : lastRun.exitCode);
  }
}

if (await hasDiff()) {
  const review = await runOpenCode({
    phase: 'review',
    pass: 1,
    prompt: await reviewPrompt(basePrompt),
  });
  lastRun = review;
  if (review.exitCode !== 0) {
    log('supervisor_review_failed', {
      exit_code: review.exitCode,
      stdout_tail: tail(review.stdout),
      stderr_tail: tail(review.stderr),
    });
    process.exit(review.exitCode);
  }
}

const validationResult = await runShell('validation', validation, {
  idleTimeoutMs,
  timeoutMs: passTimeoutMs,
});
if (validationResult.exitCode !== 0) {
  log('supervisor_validation_failed', {
    command: validation,
    exit_code: validationResult.exitCode,
    stdout_tail: tail(validationResult.stdout),
    stderr_tail: tail(validationResult.stderr),
  });
  process.exit(validationResult.exitCode);
}

const status = await runShell('git_status', 'git status --short && git diff --stat -- .', {
  idleTimeoutMs,
  timeoutMs: 30000,
});
log('supervisor_finish', {
  changed: await hasDiff(),
  validation: validation,
  git_summary: tail(status.stdout, 8000),
});

process.exit(0);

async function runOpenCode({ phase, pass, prompt }) {
  log('pass_start', { phase, pass });
  const childArgs = [
    'run',
    '--pure',
    '--format',
    'json',
    '--print-logs',
    '--log-level',
    'DEBUG',
    '--agent',
    'build',
    '--model',
    model,
    '--dangerously-skip-permissions',
    '--dir',
    '.',
    prompt,
  ];
  const result = await runProcess(`${phase}_${pass}`, opencode, childArgs, {
    cwd: repo,
    env: process.env,
    idleTimeoutMs,
    timeoutMs: passTimeoutMs,
  });
  log('pass_finish', {
    phase,
    pass,
    exit_code: result.exitCode,
    timed_out: result.timedOut,
    idle_timed_out: result.idleTimedOut,
    changed: await hasDiff(),
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  });
  return result;
}

async function runShell(label, command, { idleTimeoutMs, timeoutMs }) {
  log('shell_start', { label, command });
  const result = await runProcess(label, 'bash', ['-lc', command], {
    cwd: repo,
    env: process.env,
    idleTimeoutMs,
    timeoutMs,
  });
  log('shell_finish', {
    label,
    exit_code: result.exitCode,
    stdout_tail: tail(result.stdout),
    stderr_tail: tail(result.stderr),
  });
  return result;
}

function runProcess(label, command, commandArgs, { cwd, env, idleTimeoutMs, timeoutMs }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let finished = false;
    let timedOut = false;
    let idleTimedOut = false;
    let stopping = false;
    let lastOutputAt = Date.now();
    let heartbeatAt = Date.now();

    const child = spawn(command, commandArgs, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const heartbeat = setInterval(() => {
      const now = Date.now();
      if (now - heartbeatAt >= 15000) {
        heartbeatAt = now;
        log('process_heartbeat', {
          label,
          pid: child.pid ?? null,
          elapsed_ms: now - startedAt,
          idle_ms: now - lastOutputAt,
          stdout_bytes: stdout.length,
          stderr_bytes: stderr.length,
        });
      }
      if (now - lastOutputAt >= idleTimeoutMs) {
        idleTimedOut = true;
        beginStop('idle_timeout');
      }
      if (now - startedAt >= timeoutMs) {
        timedOut = true;
        beginStop('timeout');
      }
    }, 1000);

    child.stdout.on('data', (chunk) => {
      lastOutputAt = Date.now();
      const value = chunk.toString();
      stdout = trim(stdout + value);
      process.stdout.write(value);
    });
    child.stderr.on('data', (chunk) => {
      lastOutputAt = Date.now();
      const value = chunk.toString();
      stderr = trim(stderr + value);
      process.stderr.write(value);
    });
    child.on('error', (error) => {
      stderr = trim(`${stderr}\n${error.message}`);
    });
    child.on('close', (code, signal) => {
      finish({
        exitCode: code ?? (signal ? 128 : 1),
        signal,
        timedOut,
        idleTimedOut,
        stdout,
        stderr,
      });
    });

    function beginStop(reason) {
      if (stopping || finished) return;
      stopping = true;
      log('process_stop', {
        label,
        reason,
        pid: child.pid ?? null,
        elapsed_ms: Date.now() - startedAt,
        idle_ms: Date.now() - lastOutputAt,
      });
      stopChild('SIGTERM');
      setTimeout(() => {
        if (finished) return;
        stopChild('SIGKILL');
        finish({
          exitCode: 124,
          signal: 'SIGKILL',
          timedOut,
          idleTimedOut,
          stdout,
          stderr: trim(`${stderr}\nDroid supervisor stopped ${label} after ${reason}.`),
        });
      }, 5000);
    }

    function finish(result) {
      if (finished) return;
      finished = true;
      clearInterval(heartbeat);
      resolve(result);
    }

    function stopChild(signal) {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          // Process may have already exited.
        }
      }
    }
  });
}

async function hasDiff() {
  const result = await runProcess('has_diff', 'git', ['status', '--porcelain', '--', '.'], {
    cwd: repo,
    env: process.env,
    idleTimeoutMs: 10000,
    timeoutMs: 30000,
  });
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}

async function reviewPrompt(originalPrompt) {
  await runShell('intent_to_add', 'git add -N .', {
    idleTimeoutMs: 10000,
    timeoutMs: 30000,
  });
  const diff = await runProcess('diff_for_review', 'git', ['diff', '--patch', '--', '.'], {
    cwd: repo,
    env: process.env,
    idleTimeoutMs: 10000,
    timeoutMs: 30000,
  });
  return [
    'Review the current uncommitted diff against the original task.',
    'Fix concrete issues only. Do not broaden scope.',
    'If the diff already satisfies the task, make no changes and stop.',
    '',
    'Original task:',
    originalPrompt,
    '',
    'Current diff:',
    diff.stdout,
  ].join('\n');
}

function retryPrompt(originalPrompt, pass, lastRun) {
  return [
    originalPrompt,
    '',
    `This is retry pass ${pass}. The previous opencode pass did not produce an acceptable diff or did not complete cleanly.`,
    'Continue autonomously. Make the smallest useful code changes for the task, then stop.',
    '',
    'Previous stdout tail:',
    tail(lastRun?.stdout ?? ''),
    '',
    'Previous stderr tail:',
    tail(lastRun?.stderr ?? ''),
  ].join('\n');
}

function log(type, data = {}) {
  process.stderr.write(`${JSON.stringify({ type, timestamp: new Date().toISOString(), ...data })}\n`);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function required(value, name) {
  if (!value) {
    process.stderr.write(`Missing --${name}\n`);
    process.exit(64);
  }
  return value;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

function tail(value, length = 4000) {
  return value.length > length ? value.slice(value.length - length) : value;
}

function trim(value, length = 200000) {
  return value.length > length ? value.slice(value.length - length) : value;
}
