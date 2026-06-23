#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const STATE_DIR = path.join(process.cwd(), '.symphony');
const RUNS_DIR = path.join(STATE_DIR, 'runs');
const USAGE_FILE = path.join(STATE_DIR, 'agent-usage.json');

function parseArgs(argv) {
  const args = {
    taskId: '',
    agent: 'unknown',
    runId: `${Date.now()}`,
    commandBase64: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task-id') args.taskId = argv[++i] || '';
    else if (arg === '--agent') args.agent = argv[++i] || 'unknown';
    else if (arg === '--run-id') args.runId = argv[++i] || args.runId;
    else if (arg === '--command-base64') args.commandBase64 = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.taskId) throw new Error('--task-id is required');
  if (!args.commandBase64) throw new Error('--command-base64 is required');
  return args;
}

function printHelp() {
  console.log(`Symphony agent execution wrapper

Usage:
  node scripts/symphony-agent-exec.mjs --task-id ID --agent AGENT --run-id RUN --command-base64 BASE64

Captures stdout/stderr/result metadata under .symphony/runs and updates
.symphony/agent-usage.json when the child emits Claude or Gemini JSON output.
`);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function append(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, text);
}

function safeKey(value) {
  return String(value || 'run').replace(/[^A-Za-z0-9._-]/g, '_');
}

function decodeCommand(commandBase64) {
  return Buffer.from(commandBase64, 'base64').toString('utf8');
}

function firstJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        // Continue to the broader object scan.
      }
    }
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function summarizeClaude(parsed, completedAt, agent = 'claude') {
  return {
    agent,
    available: true,
    ok: parsed?.subtype !== 'error_max_budget_usd' && parsed?.is_error !== true,
    status: parsed?.subtype || (parsed?.is_error ? 'failed' : 'success'),
    auth: null,
    requested_model: parsed?.model || null,
    total_cost_usd: typeof parsed?.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
    usage: parsed?.usage || null,
    model_usage: parsed?.modelUsage || null,
    error: Array.isArray(parsed?.errors) ? parsed.errors.join('; ') : null,
    sampled_at: completedAt,
  };
}

function summarizeGemini(parsed, completedAt) {
  return {
    agent: 'gemini',
    available: true,
    ok: true,
    status: 'success',
    session_id: parsed?.session_id || null,
    stats: parsed?.stats || null,
    error: null,
    sampled_at: completedAt,
  };
}

function updateUsageCache(agent, parsed, completedAt) {
  if (agent !== 'claude' && agent !== 'claude-work' && agent !== 'gemini') return null;
  const cache = readJson(USAGE_FILE, {
    sampled_at: completedAt,
    ttl_ms: 45 * 60 * 1000,
    agents: {},
  });

  cache.sampled_at = completedAt;
  cache.agents ||= {};
  cache.agents[agent] =
    agent === 'gemini'
      ? summarizeGemini(parsed, completedAt)
      : summarizeClaude(parsed, completedAt, agent);

  writeJson(USAGE_FILE, cache);
  return cache.agents[agent];
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const command = decodeCommand(args.commandBase64);
  const safeTaskId = safeKey(args.taskId);
  const safeRunId = safeKey(args.runId);
  const basePath = path.join(RUNS_DIR, `${safeTaskId}-${safeRunId}`);
  const logPath = `${basePath}.log`;
  const resultPath = `${basePath}.json`;
  const startedAt = new Date().toISOString();

  append(logPath, `[${startedAt}] starting ${args.agent} for ${args.taskId}\n`);
  append(logPath, `$ ${command}\n\n`);

  const child = spawn(command, {
    shell: true,
    cwd: process.cwd(),
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    append(logPath, text);
  });

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    append(logPath, text);
  });

  const exit = await new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });

  const completedAt = new Date().toISOString();
  const parsed = firstJsonObject(stdout) || firstJsonObject(stderr);
  const usage = updateUsageCache(args.agent, parsed, completedAt);
  const result = {
    task_id: args.taskId,
    agent: args.agent,
    run_id: args.runId,
    command,
    status: exit.code === 0 ? 'completed' : 'failed',
    exit_code: exit.code,
    signal: exit.signal,
    started_at: startedAt,
    completed_at: completedAt,
    log_path: logPath,
    stdout_tail: stdout.slice(-8000),
    stderr_tail: stderr.slice(-8000),
    parsed,
    usage,
  };

  writeJson(resultPath, result);
  append(
    logPath,
    `\n[${completedAt}] ${result.status} exit=${exit.code ?? 'signal'} signal=${exit.signal ?? ''}\n`
  );
  process.exit(exit.code ?? 1);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
