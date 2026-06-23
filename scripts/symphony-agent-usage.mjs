#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const STATE_DIR = path.join(process.cwd(), '.symphony');
const CACHE_FILE = path.join(STATE_DIR, 'agent-usage.json');
const PROVIDER_TELEMETRY_FILE = path.join(STATE_DIR, 'provider-telemetry.json');
const DEFAULT_TTL_MS = 45 * 60 * 1000;
const PROBE_PROMPT =
  'Symphony routing usage probe. Do not edit files or run commands. Return only JSON: {"ok":true}.';

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    refresh: false,
    json: false,
    ttlMs: Number(process.env.SYMPHONY_AGENT_USAGE_TTL_MS || DEFAULT_TTL_MS),
    claudeBudgetUsd: process.env.SYMPHONY_CLAUDE_PROBE_BUDGET_USD || '0.10',
    claudeModel: process.env.SYMPHONY_CLAUDE_PROBE_MODEL || 'haiku',
    claudeWorkBudgetUsd: process.env.SYMPHONY_CLAUDE_WORK_PROBE_BUDGET_USD || '0.25',
    claudeWorkModel: process.env.SYMPHONY_CLAUDE_WORK_PROBE_MODEL || 'sonnet',
    geminiModel: process.env.SYMPHONY_GEMINI_PROBE_MODEL || '',
    telemetryFile: process.env.SYMPHONY_PROVIDER_TELEMETRY_FILE || PROVIDER_TELEMETRY_FILE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--refresh') args.refresh = true;
    else if (arg === '--json') args.json = true;
    else if (arg === '--ttl-ms') args.ttlMs = Number(argv[++i] || DEFAULT_TTL_MS);
    else if (arg === '--claude-budget-usd')
      args.claudeBudgetUsd = argv[++i] || args.claudeBudgetUsd;
    else if (arg === '--claude-model') args.claudeModel = argv[++i] || args.claudeModel;
    else if (arg === '--claude-work-budget-usd')
      args.claudeWorkBudgetUsd = argv[++i] || args.claudeWorkBudgetUsd;
    else if (arg === '--claude-work-model')
      args.claudeWorkModel = argv[++i] || args.claudeWorkModel;
    else if (arg === '--gemini-model') args.geminiModel = argv[++i] || args.geminiModel;
    else if (arg === '--telemetry-file')
      args.telemetryFile = path.resolve(argv[++i] || args.telemetryFile);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Symphony agent usage sampler

Usage:
  pnpm symphony:agent-usage
  pnpm symphony:agent-usage --refresh
  pnpm symphony:agent-usage --json

Options:
  --refresh                 Ignore the cache and run fresh low-risk probes
  --ttl-ms VALUE            Cache freshness window, default 45 minutes
  --claude-budget-usd VALUE Max Claude probe spend, default 0.10
  --claude-model VALUE      Requested Claude probe model, default haiku
  --claude-work-budget-usd VALUE Max Claude Work probe spend, default 0.25
  --claude-work-model VALUE Requested Claude Work probe model, default sonnet
  --gemini-model VALUE      Optional Gemini probe model
  --telemetry-file VALUE    Optional provider telemetry JSON, default .symphony/provider-telemetry.json
  --json                    Print raw cache JSON
`);
}

function firstJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
  });
  return result.status === 0;
}

function runProbe(agent, command, args) {
  const env = { ...process.env, NO_COLOR: '1', TERM: process.env.TERM || 'dumb' };
  if (agent === 'claude-work')
    env.CLAUDE_CONFIG_DIR = path.join(process.env.HOME || '', '.claude-work');
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 90_000,
    env,
  });
  const completedAt = new Date().toISOString();
  const parsed = firstJsonObject(result.stdout);

  return {
    agent,
    available: result.status === 0 || Boolean(parsed),
    ok: result.status === 0,
    status: result.status,
    signal: result.signal,
    started_at: startedAt,
    completed_at: completedAt,
    error:
      result.error?.message ||
      (result.status === 0 ? null : String(result.stderr || '').trim() || null),
    parsed,
  };
}

function summarizeClaude(probe, agent = 'claude') {
  const parsed = probe.parsed || {};
  return {
    agent,
    available: probe.available,
    ok: probe.ok && parsed.subtype !== 'error_max_budget_usd',
    status: parsed.subtype || (probe.ok ? 'success' : 'failed'),
    auth: null,
    requested_model: parsed.model || null,
    total_cost_usd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : null,
    usage: parsed.usage || null,
    model_usage: parsed.modelUsage || null,
    error: parsed.errors?.join('; ') || probe.error,
    sampled_at: probe.completed_at,
  };
}

function summarizeGemini(probe) {
  const parsed = probe.parsed || {};
  return {
    agent: 'gemini',
    available: probe.available,
    ok: probe.ok,
    status: probe.ok ? 'success' : 'failed',
    session_id: parsed.session_id || null,
    stats: parsed.stats || null,
    error: probe.error,
    sampled_at: probe.completed_at,
  };
}

function sampleClaude(args, agent = 'claude') {
  if (!commandExists('claude')) {
    return {
      agent,
      available: false,
      ok: false,
      status: 'missing',
      error: 'claude command not found',
      sampled_at: new Date().toISOString(),
    };
  }

  const env =
    agent === 'claude-work'
      ? { ...process.env, CLAUDE_CONFIG_DIR: path.join(process.env.HOME || '', '.claude-work') }
      : process.env;
  const auth = spawnSync('claude', ['auth', 'status', '--json'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    env,
  });
  const authJson = firstJsonObject(auth.stdout);
  if (!authJson?.loggedIn) {
    return {
      agent,
      available: false,
      ok: false,
      status: 'unauthenticated',
      auth: authJson,
      error: auth.stderr?.trim() || null,
      sampled_at: new Date().toISOString(),
    };
  }

  const requestedModel = agent === 'claude-work' ? args.claudeWorkModel : args.claudeModel;
  const maxBudgetUsd = agent === 'claude-work' ? args.claudeWorkBudgetUsd : args.claudeBudgetUsd;
  const probe = runProbe(agent, 'claude', [
    '-p',
    PROBE_PROMPT,
    '--model',
    requestedModel,
    '--output-format',
    'json',
    '--permission-mode',
    'plan',
    '--max-budget-usd',
    maxBudgetUsd,
    '--no-session-persistence',
  ]);
  return { ...summarizeClaude(probe, agent), auth: authJson };
}

function sampleGemini(args) {
  if (!commandExists('gemini')) {
    return {
      agent: 'gemini',
      available: false,
      ok: false,
      status: 'missing',
      error: 'gemini command not found',
      sampled_at: new Date().toISOString(),
    };
  }

  const geminiArgs = [
    '-p',
    PROBE_PROMPT,
    '--output-format',
    'json',
    '--approval-mode',
    'plan',
    '--skip-trust',
  ];
  if (args.geminiModel) {
    geminiArgs.push('--model', args.geminiModel);
  }

  return summarizeGemini(runProbe('gemini', 'gemini', geminiArgs));
}

function isFresh(cache, ttlMs) {
  if (!cache?.sampled_at) return false;
  return Date.now() - Date.parse(cache.sampled_at) < ttlMs;
}

function sample(args) {
  const sampledAt = new Date().toISOString();
  const agents = {
    claude: sampleClaude(args, 'claude'),
    'claude-work': sampleClaude(args, 'claude-work'),
    gemini: sampleGemini(args),
  };

  const cache = {
    sampled_at: sampledAt,
    ttl_ms: args.ttlMs,
    agents,
  };
  const merged = mergeProviderTelemetry(cache, args.telemetryFile);
  writeJson(CACHE_FILE, merged);
  return merged;
}

function mergeProviderTelemetry(cache, telemetryFile) {
  const telemetry = readJson(telemetryFile);
  if (!telemetry?.agents || typeof telemetry.agents !== 'object') return cache;
  const merged = {
    ...cache,
    provider_telemetry_sampled_at: telemetry.sampled_at ?? null,
    agents: { ...(cache.agents ?? {}) },
  };

  for (const [agent, agentTelemetry] of Object.entries(telemetry.agents)) {
    merged.agents[agent] = {
      agent,
      available: true,
      ok: true,
      ...(merged.agents[agent] ?? {}),
      provider_telemetry: agentTelemetry,
    };
  }
  return merged;
}

function printSummary(cache) {
  console.log(`Agent usage snapshot: ${cache.sampled_at}`);
  for (const agent of Object.values(cache.agents || {})) {
    const details = [];
    if (agent.total_cost_usd != null) details.push(`cost $${agent.total_cost_usd.toFixed(4)}`);
    if (agent.stats?.models) {
      const totalTokens = Object.values(agent.stats.models).reduce(
        (sum, model) => sum + (model.tokens?.total || 0),
        0
      );
      details.push(`${totalTokens} tokens`);
    }
    if (agent.provider_telemetry?.worst_used_pct != null) {
      details.push(`${Math.round(agent.provider_telemetry.worst_used_pct)}% used`);
    }
    if (agent.provider_telemetry?.headroom_pct != null) {
      details.push(`${Math.round(agent.provider_telemetry.headroom_pct)}% headroom`);
    }
    if (agent.error) details.push(`error: ${agent.error}`);
    console.log(
      `- ${agent.agent}: ${agent.ok ? 'ok' : agent.available ? 'available with warning' : 'unavailable'}${details.length ? ` (${details.join(', ')})` : ''}`
    );
  }
  console.log(`Cache: ${CACHE_FILE}`);
}

const args = parseArgs(process.argv.slice(2));
const existing = readJson(CACHE_FILE);
const cache = !args.refresh && isFresh(existing, args.ttlMs) ? existing : sample(args);

if (args.json) {
  console.log(JSON.stringify(cache, null, 2));
} else {
  printSummary(cache);
}
