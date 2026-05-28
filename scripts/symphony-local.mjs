#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findNextTask, isTaskBlocked, sortTasksRunnableFirst, normalizeDependencies } from './symphony-tasks.mjs';
import {
  buildRunLedgerRecord,
  buildRunAuditEvent,
  DISPATCH_AUDIT_ACTION,
  PICK_AUDIT_ACTION,
} from './lib/symphony-audit.mjs';
import {
  buildTaskPassSummary,
  findReadmeDuplicateTaskWarnings,
  formatTaskPassSummary,
} from './lib/symphony-reporting.mjs';

const STATUS_ORDER = ['todo', 'in_progress', 'done'];
const LOCAL_STATE_DIR = path.join(process.cwd(), '.symphony');
const LOCAL_TASK_CACHE = path.join(LOCAL_STATE_DIR, 'tasks.json');
const LOCAL_MEMORY_FILE = path.join(LOCAL_STATE_DIR, 'memory.md');
const LOCAL_AGENT_USAGE_CACHE = path.join(LOCAL_STATE_DIR, 'agent-usage.json');
const DEFAULT_CLI_COMMAND = 'pnpm --dir packages/cli exec tsx src/index.ts';
const DEFAULT_AGENT_COMMANDS = {
  codex: 'codex exec --dangerously-bypass-approvals-and-sandbox {prompt}',
  claude: 'claude --dangerously-skip-permissions -p {prompt} --output-format json --no-session-persistence',
  'claude-work': 'CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude --dangerously-skip-permissions -p {prompt} --model ${SYMPHONY_CLAUDE_WORK_MODEL:-sonnet} --output-format json --no-session-persistence',
  gemini: 'npx -y @google/gemini-cli --model ${SYMPHONY_GEMINI_MODEL:-gemini-2.5-pro} --yolo -p {prompt} --output-format json --skip-trust',
  grok: '${SYMPHONY_GROK_COMMAND:-grok} --permission-mode bypassPermissions --prompt-file {promptFile} --output-format json --no-alt-screen',
  cursor: 'agent --print --force --trust --output-format json {prompt}',
};

const DEFAULT_AGENT_PRIORITY = ['gemini', 'codex', 'claude', 'claude-work', 'grok', 'cursor'];
const CLAUDE_WORK_MIN_HEADROOM_PCT = 25;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getGlobalConfig() {
  return (
    readJson(path.join(os.homedir(), '.foundry', 'config.json')) ??
    readJson(path.join(os.homedir(), '.saasmaker', 'config.json')) ??
    {}
  );
}

function splitCommand(value) {
  return value.trim().split(/\s+/).filter(Boolean);
}

function parseJsonEnv(name) {
  const value = process.env[name];
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveAgentCommands(globalConfig) {
  return {
    ...DEFAULT_AGENT_COMMANDS,
    ...(globalConfig.symphonyAgentCommands ?? {}),
    ...(globalConfig.symphonyAgentProfiles ?? {}),
    ...parseJsonEnv('SYMPHONY_AGENT_COMMANDS'),
  };
}

function resolveAgentEnv(globalConfig) {
  return {
    ...(globalConfig.symphonyAgentEnv ?? {}),
    ...parseJsonEnv('SYMPHONY_AGENT_ENV'),
  };
}

function resolveForwardedEnv(globalConfig) {
  const configured = globalConfig.symphonyAgentEnvVars ?? [];
  const fromEnv = (process.env.SYMPHONY_AGENT_ENV_VARS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return [...configured, ...fromEnv];
}

function parseArgs(argv) {
  const globalConfig = getGlobalConfig();
  const args = {
    command: 'list',
    apiBase: process.env.FND_API_URL || process.env.SAASMAKER_API_URL || globalConfig.apiBaseUrl,
    cliCommand: process.env.SYMPHONY_CLI_COMMAND || globalConfig.symphonyCliCommand || DEFAULT_CLI_COMMAND,
    json: false,
    commands: false,
    dispatch: null,
    ids: [],
    watch: false,
    id: null,
    title: null,
    description: null,
    project: null,
    priority: 'medium',
    taskType: null,
    status: null,
    noCache: false,
    since: null,
    memory: '',
    memoryPush: false,
    memoryPull: false,
    agent: process.env.SYMPHONY_AGENT || globalConfig.symphonyAgent || 'auto',
    agentCommand: process.env.SYMPHONY_AGENT_COMMAND || null,
    agentCommands: resolveAgentCommands(globalConfig),
    agentEnv: resolveAgentEnv(globalConfig),
    forwardedEnv: resolveForwardedEnv(globalConfig),
    usageRefresh: false,
    usageMaxAgeMinutes: null,
    dryRun: false,
    limit: null,
  };

  const commands = new Set(['list', 'pull', 'sync', 'create', 'claim', 'done', 'reopen', 'type', 'dispatch', 'pick', 'delete', 'memory', 'audit', 'summary', 'usage', 'backfill-changelog']);
  if (argv[0] && !argv[0].startsWith('-') && commands.has(argv[0])) {
    args.command = argv.shift();
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--commands') args.commands = true;
    else if (arg === '--watch') args.watch = true;
    else if (arg === '--no-cache') args.noCache = true;
    else if (arg === '--push') args.memoryPush = true;
    else if (arg === '--pull') args.memoryPull = true;
    else if (arg === '--refresh') args.usageRefresh = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--max-age-minutes') args.usageMaxAgeMinutes = argv[++i] ?? null;
    else if (arg === '--limit') args.limit = Number.parseInt(argv[++i] ?? '', 10);
    else if (arg === '--dispatch') args.dispatch = argv[++i] ?? null;
    else if (arg === '--api-base') args.apiBase = argv[++i];
    else if (arg === '--cli-command') args.cliCommand = argv[++i] ?? DEFAULT_CLI_COMMAND;
    else if (arg === '--description' || arg === '-d') args.description = argv[++i] ?? '';
    else if (arg === '--project' || arg === '-p') args.project = argv[++i] ?? '';
    else if (arg === '--priority') args.priority = argv[++i] ?? 'medium';
    else if (arg === '--since') args.since = argv[++i] ?? null;
    else if (arg === '--blocked-on-user') args.blockedOnUser = true;
    else if (arg === '--status') args.status = argv[++i] ?? null;
    else if (arg === '--agent') args.agent = argv[++i] ?? 'auto';
    else if (arg === '--agent-command') args.agentCommand = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (args.command === 'dispatch') {
      args.ids.push(arg);
      args.id ||= arg;
    } else if (!args.id && ['claim', 'done', 'reopen', 'type', 'delete', 'audit'].includes(args.command)) {
      args.id = arg;
    } else if (args.command === 'type' && !args.taskType) {
      args.taskType = arg;
    } else if (args.command === 'create') {
      args.title = args.title ? `${args.title} ${arg}` : arg;
    }
  }

  args.agentCommand ||= globalConfig.symphonyAgentCommand || null;
  return args;
}

function printHelp() {
  console.log(`Foundry Symphony local runner

Usage:
  pnpm symphony                         Pull production tasks and list by status
  pnpm symphony --commands              Include isolated agent commands
  pnpm symphony dispatch ID             Print one task's agent command
  pnpm symphony dispatch ID ID ...      Print batch commands, routed at task level
  pnpm symphony dispatch ID --agent claude
  pnpm symphony dispatch ID --agent grok
  pnpm symphony dispatch ID --agent codex-work
  pnpm symphony dispatch ID --agent-command 'my-agent run --prompt-file {promptFile}'
  pnpm symphony pick --agent claude     Claim the next runnable todo task (skips tasks with unfinished prerequisites)
  pnpm symphony pick --agent gemini     Claim the next runnable todo task (skips tasks with unfinished prerequisites)
  pnpm symphony claim ID                Move a production task to in_progress
  pnpm symphony done ID                 Move a production task to done (auto-creates changelog draft for feature/bug tasks)
  pnpm symphony reopen ID               Move a production task back to todo
  pnpm symphony type ID bug             Set task type: feature, bug, chore, docs, research, cleanup, other
  pnpm symphony create "Title"          Create a production task
  pnpm symphony delete ID               Delete a production task
  pnpm symphony audit                   Show recent Symphony audit events
  pnpm symphony audit ID                Show audit events for one task
  pnpm symphony summary                 Summarize task pass status and changelog coverage
  pnpm symphony backfill-changelog      Create missing changelog drafts from old done feature/bug tasks
  pnpm symphony backfill-changelog --dry-run
  pnpm symphony usage                   Check cached/refreshable agent usage stats
  pnpm symphony memory                  Show local Symphony operating memory
  pnpm symphony memory --pull           Pull production memory into .symphony/memory.md
  pnpm symphony memory --push           Push .symphony/memory.md to production
  pnpm symphony --watch                 Refresh the task list every 30s

After task batches:
  Check the fleet changelog in Cockpit Daily Log, or run pnpm symphony list, to confirm done tasks produced the expected product log entries.

Options:
  --api-base URL   API base URL override passed to the Foundry CLI as FND_API_URL
  --cli-command    Foundry CLI command, default: ${DEFAULT_CLI_COMMAND}
  --description    Description for create
  --project SLUG   Project slug for create
  --priority VALUE low, medium, or high for create
  --since DATE      With summary: only include tasks updated on/after YYYY-MM-DD
  --dry-run         With backfill-changelog: show what would be created
  --limit N         With backfill-changelog: cap created entries
  --refresh         With usage: force a fresh agent usage probe
  --max-age-minutes With usage: accepted cache age before probing
  --blocked-on-user Mark created task as waiting on a user decision/config
  --agent NAME     Agent profile for dispatch: auto, codex, claude, claude-work, gemini, grok, cursor, or a configured profile
  --agent-command  Command template for custom agents; supports {prompt}, {promptFile}, {workspace}, {taskId}
  --push           With memory: push .symphony/memory.md to production
  --pull           With memory: pull production memory into .symphony/memory.md
  --json           Print raw task JSON
  --no-cache       Do not write the pulled board to .symphony/tasks.json

Auth:
  Local sync shells out through the Foundry CLI, so use fnd login for this account.
  Symphony does not accept or pass API keys directly.

Profiles:
  Built-in commands run with full permissions:
    auto    Prefer gemini first; codex/claude second by task shape; claude-work third with headroom; grok/cursor later
    codex   codex exec --dangerously-bypass-approvals-and-sandbox {prompt}
    claude  claude --dangerously-skip-permissions -p {prompt}
    claude-work
            CLAUDE_CONFIG_DIR="$HOME/.claude-work" claude --dangerously-skip-permissions -p {prompt} --model \${SYMPHONY_CLAUDE_WORK_MODEL:-sonnet} with structured JSON output for usage capture
    gemini  npx -y @google/gemini-cli --yolo -p {prompt}
    grok    grok --permission-mode bypassPermissions --prompt-file {promptFile} --output-format json --no-alt-screen
    cursor  agent --print --force --trust {prompt}

  Add more profiles in ~/.foundry/config.json:
    "symphonyAgentCommands": {
      "codex-work": "codex exec --profile work --dangerously-bypass-approvals-and-sandbox {prompt}",
      "claude-max": "claude --settings ~/.claude/max.json --dangerously-skip-permissions -p {prompt}"
    }

  Add environment for all generated agent commands:
    "symphonyAgentEnv": { "FOUNDRY_ACCOUNT": "sarthak" },
    "symphonyAgentEnvVars": ["CLAUDE_CONFIG_DIR", "CODEX_HOME"]
`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function isValidEnvName(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function shellVariableRef(name) {
  return `"$${name}"`;
}

function homePath(value) {
  return `"$HOME/${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function workspaceKey(task) {
  return task.id.replace(/[^A-Za-z0-9._-]/g, '_');
}

function resolveAgentCommand(args) {
  if (args.agentCommand) return args.agentCommand;
  const command = args.agentCommands[args.effectiveAgent ?? args.agent];
  if (!command) {
    throw new Error(`Unknown agent profile "${args.effectiveAgent ?? args.agent}". Use --agent-command or add it to symphonyAgentCommands in ~/.foundry/config.json.`);
  }
  return command;
}

function readAgentUsage() {
  return readJson(LOCAL_AGENT_USAGE_CACHE);
}

function isFresh(sampledAt) {
  if (!sampledAt) return false;
  return Date.now() - Date.parse(sampledAt) < 45 * 60 * 1000;
}

function agentHealthy(agent, usage) {
  if (agent === 'codex') return true;
  if (agent === 'grok') return true;
  if (agent === 'cursor') return true;
  const sample = usage?.agents?.[agent];
  if (!sample) return true;
  const minHeadroom = agent === 'claude-work' ? CLAUDE_WORK_MIN_HEADROOM_PCT : 8;
  return sample.available !== false && sample.ok !== false && isFresh(sample.sampled_at) && agentHeadroomPct(agent, usage) >= minHeadroom;
}

function firstHealthyAgent(candidates, usage) {
  return candidates.find((agent) => agentHealthy(agent, usage)) ?? 'codex';
}

function agentHeadroomPct(agent, usage) {
  const sample = usage?.agents?.[agent];
  const telemetry = sample?.provider_telemetry;
  if (typeof telemetry?.headroom_pct === 'number') return telemetry.headroom_pct;
  if (typeof telemetry?.worst_used_pct === 'number') return Math.max(0, 100 - telemetry.worst_used_pct);
  if (agent === 'codex' || agent === 'grok' || agent === 'cursor') return 100;
  return 50;
}

function taskRoutingText(task) {
  return `${task.title ?? ''}\n${task.description ?? ''}\n${task.task_type ?? ''}`.toLowerCase();
}

function assignedAgent(task) {
  const match = String(task.description ?? '').match(/Agent assignment:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function chooseAgent(task, args) {
  if (args.agent && args.agent !== 'auto') {
    return { agent: args.agent, reason: 'agent forced by CLI option' };
  }
  const usage = args.agentUsage ?? readAgentUsage();
  const text = taskRoutingText(task);
  let candidate = 'codex';
  let reason = 'default route';
  const explicitAgent = assignedAgent(task);
  const explicitlySensitive = /(set secret|add secret|write secret|rotate secret|production credential|deploy now|release now|migration)/.test(text);

  if (explicitAgent && !explicitlySensitive && agentHealthy(explicitAgent, usage)) {
    candidate = explicitAgent;
    reason = 'task description explicitly assigns agent';
  } else if (/(secret|credential|oauth|migration|database|d1)/.test(text) || explicitlySensitive) {
    candidate = 'codex';
    reason = 'sensitive cloud/auth/deployment work stays with Codex';
  } else if (/(ui|frontend|react|next|component|page|layout|design|polish|revamp|crash|runtime|bug|fix)/.test(text)) {
    candidate = firstHealthyAgent(['gemini', 'codex', 'claude', 'claude-work', 'grok', 'cursor'], usage);
    reason = 'implementation/UI/bug route';
  } else if (
    task.task_type === 'cleanup' ||
    task.task_type === 'chore' ||
    /(cleanup|clean up|refactor|polish|rename|organize|simplify|prose|wording)/.test(text)
  ) {
    candidate = firstHealthyAgent(['gemini', 'claude', 'codex', 'claude-work', 'grok', 'cursor'], usage);
    reason = 'cleanup/refactor/prose route';
  } else if (
    task.task_type === 'research' ||
    task.task_type === 'docs' ||
    /(audit|research|summarize|inventory|review all|compare|docs|documentation|copy|content)/.test(text)
  ) {
    candidate = firstHealthyAgent(['gemini', 'claude', 'codex', 'claude-work', 'grok', 'cursor'], usage);
    reason = 'broad review/docs/synthesis route';
  } else if (task.priority === 'high') {
    candidate = firstHealthyAgent(['gemini', 'codex', 'claude', 'claude-work', 'grok', 'cursor'], usage);
    reason = 'high-priority non-sensitive route';
  } else {
    candidate = firstHealthyAgent(DEFAULT_AGENT_PRIORITY, usage);
    reason = 'default priority route';
  }

  if (!agentHealthy(candidate, usage)) {
    return { agent: 'codex', reason: `${candidate} matched but recent usage sample was unhealthy/stale` };
  }
  return { agent: candidate, reason };
}

function renderAgentCommand(template, task, prompt, workspacePath) {
  const promptFile = `${workspacePath}/prompt.md`;
  return template
    .replaceAll('{prompt}', shellQuote(prompt))
    .replaceAll('{promptFile}', shellQuote(promptFile))
    .replaceAll('{workspace}', shellQuote(workspacePath))
    .replaceAll('{taskId}', shellQuote(task.id));
}

function readLocalMemory() {
  try {
    return fs.readFileSync(LOCAL_MEMORY_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

function writeLocalMemory(content) {
  fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_MEMORY_FILE, content);
}

function formatMemoryBlock(memory) {
  const trimmed = memory?.trim();
  if (!trimmed) return '';
  return `\nSymphony operating memory:\n${trimmed}\n`;
}

function renderEnvPrefix(args) {
  const assignments = [];
  for (const [key, value] of Object.entries(args.agentEnv ?? {})) {
    if (!isValidEnvName(key)) throw new Error(`Invalid environment variable name: ${key}`);
    assignments.push(`${key}=${shellQuote(value)}`);
  }
  for (const key of args.forwardedEnv ?? []) {
    if (!isValidEnvName(key)) throw new Error(`Invalid environment variable name: ${key}`);
    assignments.push(`${key}=${shellVariableRef(key)}`);
  }
  return assignments.length ? `env ${assignments.join(' ')} ` : '';
}

function cliEnv(args) {
  return {
    ...process.env,
    ...(args.apiBase ? { FND_API_URL: args.apiBase } : {}),
  };
}

function runCliApi(args, method, pathName, options = {}) {
  const cliParts = splitCommand(args.cliCommand);
  if (cliParts.length === 0) throw new Error('No Foundry CLI command configured.');

  const command = cliParts[0];
  const commandArgs = [
    ...cliParts.slice(1),
    'api',
    method,
    pathName,
    '--auth',
    'session',
    '--output',
    'json',
    '--raw',
    '--quiet',
    '--no-validate',
  ];

  if (options.body !== undefined) {
    commandArgs.push('--body', JSON.stringify(options.body));
  }

  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env: cliEnv(args),
    encoding: 'utf8',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(output || `Foundry CLI failed with exit ${result.status}`);
  }

  const stdout = result.stdout.trim();
  if (!stdout) return null;
  const jsonLine = stdout
    .split('\n')
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.startsWith('{') || line.startsWith('['));
  try {
    return JSON.parse(jsonLine ?? stdout);
  } catch {
    throw new Error(`Foundry CLI returned non-JSON output: ${stdout}`);
  }
}

function buildPrompt(task, memory = '') {
  const project = task.project_slug ?? 'saas-maker';
  const doneCommand = `pnpm --dir ~/Desktop/fleet/saas-maker symphony done ${task.id}`;
  const marketingInstructions = task.task_type === 'docs' && /\bmarketing\b/i.test(`${task.title ?? ''}\n${task.description ?? ''}`)
    ? `
Marketing Queue contract:
- The required output is one or more SaaS Maker Marketing Queue ideas, not only repo docs.
- Create each idea with:
  fnd api POST /v1/marketing/posts --auth session --body '{"project_slug":"${project}","channel":"x","status":"generated","source_type":"task","source_id":"${task.id}","task_id":"${task.id}","title":"Short idea title","hook":"Plain hook","body":"Post body","cta":"Try it and send feedback."}'
- Use status "generated"; Sarthak accepts/rejects in Cockpit, then marks accepted ideas "sent" after posting.
- Do not post to social accounts. Repo docs under docs/marketing/ are optional supporting notes only.
`
    : '';
  return `You are running a Foundry Symphony task.

Task ID: ${task.id}
Title: ${task.title}
Project: ${project}
Priority: ${task.priority}
Current status: ${task.status}

Description:
${task.description?.trim() || 'No additional description provided.'}
${formatMemoryBlock(memory)}
${marketingInstructions}

Execution contract:
- Treat the task row as the source of truth.
- Work in the project context above.
- Use this repository's AGENTS.md and WORKFLOW.md as operating guidance.
- Keep changes scoped to the task.
- Verify before claiming completion.
- When done, report changed files, evidence, and remaining risk.
- After verification, mark the task done with:
  ${doneCommand}
`;
}

function buildCommand(task, args) {
  const project = task.project_slug ?? 'saas-maker';
  const workspacePath = `.symphony/workspaces/${workspaceKey(task)}`;
  const prompt = buildPrompt(task, args.memory);
  const route = chooseAgent(task, args);
  args.effectiveAgent = route.agent;
  const agentTemplate = resolveAgentCommand(args);
  const agentCommand = `${renderEnvPrefix(args)}${renderAgentCommand(agentTemplate, task, prompt, workspacePath)}`;
  return [
    `cd ${homePath(`Desktop/fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `printf %s ${shellQuote(prompt)} > ${shellQuote(`${workspacePath}/prompt.md`)}`,
    `printf %s ${shellQuote(`Routed agent: ${route.agent}\nRouting reason: ${route.reason}\n`)} >> ${shellQuote(`${workspacePath}/route.md`)}`,
    agentCommand,
  ].join(' && ');
}

async function fetchTasks(args) {
  const payload = runCliApi(args, 'GET', '/v1/tasks');
  const tasks = payload.data ?? [];
  if (!args.noCache) writeTaskCache(tasks, args);
  return tasks;
}

async function apiRequest(args, pathName, init = {}) {
  return runCliApi(args, init.method ?? 'GET', pathName, {
    body: init.body ? JSON.parse(init.body) : undefined,
  });
}

async function fetchRemoteMemory(args) {
  const payload = await apiRequest(args, '/v1/symphony/memory');
  return payload.data?.content ?? '';
}

async function recordAudit(args, event) {
  try {
    await apiRequest(args, '/v1/symphony/audit', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  } catch (error) {
    if (process.env.SYMPHONY_AUDIT_DEBUG) {
      console.error(`Failed to record Symphony audit event: ${error.message}`);
    }
  }
}

async function recordRun(args, record) {
  try {
    await apiRequest(args, '/v1/symphony/runs', {
      method: 'POST',
      body: JSON.stringify(record),
    });
  } catch (error) {
    if (process.env.SYMPHONY_AUDIT_DEBUG) {
      console.error(`Failed to record Symphony run ledger entry: ${error.message}`);
    }
  }
}

async function fetchAudit(args) {
  const params = new URLSearchParams();
  if (args.id) params.set('task_id', args.id);
  params.set('limit', '50');
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const payload = await apiRequest(args, `/v1/symphony/audit${suffix}`);
  return payload.data ?? [];
}

async function pushRemoteMemory(args, content) {
  const payload = await apiRequest(args, '/v1/symphony/memory', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  return payload.data;
}

async function loadPromptMemory(args) {
  const local = readLocalMemory();
  try {
    const remote = await fetchRemoteMemory(args);
    if (remote.trim()) {
      writeLocalMemory(remote);
      return remote;
    }
  } catch {
    // Dispatch should keep working offline or before the production migration is applied.
  }
  return local;
}

function writeTaskCache(tasks, args) {
  fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_TASK_CACHE, JSON.stringify({
    cliCommand: args.cliCommand,
    apiBase: args.apiBase ?? null,
    syncedAt: new Date().toISOString(),
    tasks,
  }, null, 2));
}

function shortId(id) {
  return id.slice(0, 8);
}

function printTasks(tasks, args) {
  if (args.json) {
    console.log(JSON.stringify(tasks, null, 2));
    return;
  }

  const timestamp = new Date().toLocaleString();
  console.log(`Foundry Symphony task list (${tasks.length})`);
  console.log(`Source: Foundry CLI (${args.cliCommand}) /v1/tasks`);
  if (!args.noCache) console.log(`Local cache: ${path.relative(process.cwd(), LOCAL_TASK_CACHE)}`);
  console.log(`Updated: ${timestamp}`);

  for (const status of STATUS_ORDER) {
    const bucket = sortTasksRunnableFirst(tasks.filter((task) => task.status === status));
    console.log(`\n${status.toUpperCase()} (${bucket.length})`);
    if (bucket.length === 0) {
      console.log('  - none');
      continue;
    }

    for (const task of bucket) {
      const project = task.project_slug ?? 'saas-maker';
      const description = task.description ? ` — ${task.description.split('\n')[0]}` : '';
      const blockedTag = task.blocked ? ' [BLOCKED]' : '';
      console.log(`  - [${shortId(task.id)}] ${task.priority} ${project}: ${task.title}${blockedTag}${description}`);
      if (task.blocked) {
        const deps = normalizeDependencies(task);
        if (task.blocked_on_user) console.log('    waiting on: decision/config');
        if (deps.length) console.log(`    waiting on: ${deps.map((id) => shortId(id)).join(', ')}`);
      }
      if (args.commands) {
        console.log(`    ${buildCommand(task, args)}`);
      }
    }
  }
}

async function runOnce(args) {
  const tasks = await fetchTasks(args);
  args.memory = await loadPromptMemory(args);

  if (args.dispatch || args.command === 'dispatch') {
    const ids = args.dispatch ? [args.dispatch] : args.ids;
    if (ids.length === 0) throw new Error('Task id or id prefix is required.');
    const batch = ids.map((id) => findTask(tasks, id));
    for (const task of batch) assertDispatchable(task, tasks);
    for (const task of batch) {
      const route = chooseAgent(task, args);
      await recordRun(args, buildRunLedgerRecord({
        task,
        agent: route.agent,
        agentCommand: args.agentCommand,
        terminalHint: batch.length > 1 ? 'pnpm symphony batch dispatch printed command' : 'pnpm symphony dispatch printed command',
      }));
      await recordAudit(args, buildRunAuditEvent({
        task,
        action: DISPATCH_AUDIT_ACTION,
        actorSource: 'local-cli',
        agent: route.agent,
        agentCommand: args.agentCommand,
        note: `${batch.length > 1 ? 'CLI batch dispatch' : 'CLI dispatch'} - printed shell command (${route.reason})`,
      }));
    }
    const commands = batch.map((task) => buildCommand(task, args));
    if (args.json) {
      console.log(JSON.stringify(batch.map((task, index) => ({ task, command: commands[index] })), null, 2));
      return;
    }
    console.log(commands.join('\n\n'));
    return;
  }

  printTasks(tasks, args);
}

function findTask(tasks, id) {
  if (!id) throw new Error('Task id or id prefix is required.');
  const task = tasks.find((candidate) => (
    candidate.id === id ||
    candidate.id.startsWith(id) ||
    shortId(candidate.id) === id
  ));
  if (!task) throw new Error(`Task not found for id prefix: ${id}`);
  return task;
}

function assertDispatchable(task, tasks) {
  if (task.status === 'done') {
    throw new Error(`Task ${shortId(task.id)} is done; reopen it before dispatch.`);
  }
  if (isTaskBlocked(task, tasks)) {
    const deps = normalizeDependencies(task);
    const blockers = [
      task.blocked_on_user ? 'decision/config' : null,
      deps.length ? deps.map((id) => shortId(id)).join(', ') : null,
    ].filter(Boolean);
    const suffix = blockers.length ? ` Waiting on: ${blockers.join('; ')}` : '';
    throw new Error(`Task ${shortId(task.id)} is blocked.${suffix}`);
  }
}

function pickNextTask(tasks, args) {
  return findNextTask(tasks, { status: args.status ?? 'todo', project: args.project ?? null });
}

async function updateTaskStatus(args, status) {
  const tasks = await fetchTasks(args);
  const task = findTask(tasks, args.id);
  const payload = await apiRequest(args, `/v1/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  const nextTasks = await fetchTasks(args);
  if (!args.json) console.log(`Updated ${shortId(task.id)} to ${status}: ${payload.data.title}`);
  if (args.json) console.log(JSON.stringify(payload.data, null, 2));
  return nextTasks;
}

const PRODUCT_TASK_TYPES = new Set(['feature', 'bug']);

async function doneTask(args) {
  const tasks = await fetchTasks(args);
  const task = findTask(tasks, args.id);
  const payload = await apiRequest(args, `/v1/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' }),
  });
  await fetchTasks(args);
  if (!args.json) console.log(`Updated ${shortId(task.id)} to done: ${payload.data.title}`);
  if (args.json) console.log(JSON.stringify(payload.data, null, 2));

  if (!PRODUCT_TASK_TYPES.has(task.task_type)) return;

  try {
    const result = await apiRequest(args, '/v1/changelog/from-task', {
      method: 'POST',
      body: JSON.stringify({ task_id: task.id, source: 'symphony-cli' }),
    });
    if (!args.json) {
      if (result?.skipped) {
        if (result.reason === 'duplicate') console.log(`Changelog: draft already exists for this task`);
        else console.log(`Changelog: skipped (${result.reason ?? 'unknown reason'})`);
      } else if (result?.data) {
        console.log(`Changelog draft created: "${task.title}" (publish in Cockpit when ready)`);
      }
    }
  } catch (error) {
    if (!args.json) console.log(`Changelog: skipped (${error instanceof Error ? error.message.slice(0, 120) : 'request failed'})`);
  }
}

async function backfillChangelog(args) {
  const tasks = await fetchTasks(args);
  const candidates = tasks
    .filter((task) => task.status === 'done')
    .filter((task) => PRODUCT_TASK_TYPES.has(task.task_type))
    .filter((task) => !task.has_changelog)
    .filter((task) => task.project_slug)
    .sort((a, b) => Date.parse(a.updated_at ?? a.created_at ?? '') - Date.parse(b.updated_at ?? b.created_at ?? ''));

  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : candidates.length;
  const selected = candidates.slice(0, limit);

  if (args.json && args.dryRun) {
    console.log(JSON.stringify({ dry_run: true, total_candidates: candidates.length, selected }, null, 2));
    return;
  }

  if (args.dryRun) {
    console.log(`Changelog backfill dry run: ${candidates.length} missing product task changelogs`);
    for (const task of selected) {
      console.log(`  - [${shortId(task.id)}] ${task.project_slug}: ${task.title}`);
    }
    if (selected.length < candidates.length) {
      console.log(`  ... ${candidates.length - selected.length} more not shown because of --limit`);
    }
    return;
  }

  const summary = { created: 0, duplicate: 0, skipped: 0, failed: 0, total_candidates: candidates.length };
  const failures = [];
  for (const task of selected) {
    try {
      const result = await apiRequest(args, '/v1/changelog/from-task', {
        method: 'POST',
        body: JSON.stringify({
          task_id: task.id,
          source: 'symphony-backfill',
          evidence: 'Backfilled from completed task metadata.',
          use_task_updated_at: true,
        }),
      });
      if (result?.skipped) {
        if (result.reason === 'duplicate') summary.duplicate += 1;
        else summary.skipped += 1;
      } else {
        summary.created += 1;
      }
      if (!args.json) console.log(`[${shortId(task.id)}] ${task.project_slug}: ${result?.skipped ? `skipped ${result.reason ?? 'unknown'}` : 'created'}`);
    } catch (error) {
      summary.failed += 1;
      failures.push({ id: task.id, title: task.title, error: error instanceof Error ? error.message : String(error) });
      if (!args.json) console.log(`[${shortId(task.id)}] ${task.project_slug}: failed`);
    }
  }

  await fetchTasks({ ...args, noCache: args.noCache });

  if (args.json) {
    console.log(JSON.stringify({ ...summary, failures }, null, 2));
    return;
  }
  console.log(
    `Backfill complete: ${summary.created} created, ${summary.duplicate} duplicate, ${summary.skipped} skipped, ${summary.failed} failed (${summary.total_candidates} candidates)`
  );
}

async function updateTaskType(args) {
  const allowedTypes = new Set(['feature', 'bug', 'chore', 'docs', 'research', 'cleanup', 'other']);
  if (!allowedTypes.has(args.taskType)) {
    throw new Error(`Task type must be one of: ${Array.from(allowedTypes).join(', ')}`);
  }
  const tasks = await fetchTasks(args);
  const task = findTask(tasks, args.id);
  const payload = await apiRequest(args, `/v1/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ task_type: args.taskType }),
  });
  await fetchTasks(args);
  if (!args.json) console.log(`Updated ${shortId(task.id)} to ${args.taskType}: ${payload.data.title}`);
  if (args.json) console.log(JSON.stringify(payload.data, null, 2));
}

async function pickTask(args) {
  const tasks = await fetchTasks(args);
  args.memory = await loadPromptMemory(args);
  const task = pickNextTask(tasks, args);
  const payload = await apiRequest(args, `/v1/tasks/${task.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'in_progress' }),
  });
  const pickedTask = payload.data ?? { ...task, status: 'in_progress' };
  await fetchTasks(args);
  const route = chooseAgent(pickedTask, args);
  const command = buildCommand(pickedTask, args);
  await recordRun(args, buildRunLedgerRecord({
    task: pickedTask,
    agent: route.agent,
    agentCommand: args.agentCommand,
    terminalHint: 'pnpm symphony pick claimed task and printed command',
  }));
  await recordAudit(args, buildRunAuditEvent({
    task: pickedTask,
    action: PICK_AUDIT_ACTION,
    actorSource: 'local-cli',
    agent: route.agent,
    agentCommand: args.agentCommand,
    note: `CLI pick - claimed task and printed shell command (${route.reason})`,
  }));
  if (args.json) {
    console.log(JSON.stringify({ task: pickedTask, command }, null, 2));
    return;
  }
  console.log(command);
}

async function createTask(args) {
  if (!args.title?.trim()) throw new Error('Task title is required.');
  const duplicateWarnings = findReadmeDuplicateTaskWarnings(args.title.trim());
  for (const warning of duplicateWarnings) {
    console.warn(
      `Warning: README Active AI log has a similar task [${warning.id}] ${warning.title} (${warning.status}, ${Math.round(warning.similarity * 100)}% match).`
    );
  }
  const payload = await apiRequest(args, '/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: args.title.trim(),
      description: args.description || undefined,
      project_slug: args.project || undefined,
      priority: args.priority || 'medium',
      blocked_on_user: args.blockedOnUser === true,
    }),
  });
  await fetchTasks(args);
  if (args.json) console.log(JSON.stringify(payload.data, null, 2));
  else console.log(`Created ${shortId(payload.data.id)}: ${payload.data.title}`);
}

async function showSummary(args) {
  const tasks = await fetchTasks(args);
  const summary = buildTaskPassSummary(tasks, { since: args.since });
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(formatTaskPassSummary(summary));
}

async function showAgentUsage(args) {
  const usageArgs = ['scripts/symphony-agent-usage.mjs'];
  if (args.json) usageArgs.push('--json');
  if (args.usageRefresh) usageArgs.push('--refresh');
  if (args.usageMaxAgeMinutes) usageArgs.push('--max-age-minutes', args.usageMaxAgeMinutes);
  const result = spawnSync(process.execPath, usageArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function deleteTask(args) {
  const tasks = await fetchTasks(args);
  const task = findTask(tasks, args.id);
  await apiRequest(args, `/v1/tasks/${task.id}`, { method: 'DELETE' });
  await fetchTasks(args);
  if (!args.json) console.log(`Deleted ${shortId(task.id)}: ${task.title}`);
}

async function showAudit(args) {
  const events = await fetchAudit(args);
  if (args.json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }
  console.log(`Foundry Symphony audit log (${events.length})`);
  for (const event of events) {
    const created = event.created_at ?? '-';
    const task = event.task_id ? shortId(event.task_id) : '--------';
    const project = event.project_slug ?? '-';
    const actor = event.actor_source ?? '-';
    const agent = event.agent_profile ? ` ${event.agent_profile}` : '';
    console.log(`  - ${created} [${task}] ${event.action} ${project} via ${actor}${agent}`);
  }
}

async function manageMemory(args) {
  if (args.memoryPush) {
    const content = readLocalMemory();
    const row = await pushRemoteMemory(args, content);
    if (args.json) console.log(JSON.stringify(row, null, 2));
    else console.log(`Pushed Symphony memory from ${path.relative(process.cwd(), LOCAL_MEMORY_FILE)}`);
    return;
  }

  if (args.memoryPull) {
    const content = await fetchRemoteMemory(args);
    writeLocalMemory(content);
    if (args.json) console.log(JSON.stringify({ content }, null, 2));
    else console.log(`Pulled Symphony memory to ${path.relative(process.cwd(), LOCAL_MEMORY_FILE)}`);
    return;
  }

  const content = readLocalMemory();
  if (args.json) {
    console.log(JSON.stringify({ path: LOCAL_MEMORY_FILE, content }, null, 2));
    return;
  }
  console.log(`Symphony memory: ${path.relative(process.cwd(), LOCAL_MEMORY_FILE)}`);
  console.log(content || '(empty)');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'memory') await manageMemory(args);
  else if (args.command === 'audit') await showAudit(args);
  else if (args.command === 'summary') await showSummary(args);
  else if (args.command === 'backfill-changelog') await backfillChangelog(args);
  else if (args.command === 'usage') await showAgentUsage(args);
  else if (args.command === 'create') await createTask(args);
  else if (args.command === 'claim') await updateTaskStatus(args, 'in_progress');
  else if (args.command === 'done') await doneTask(args);
  else if (args.command === 'reopen') await updateTaskStatus(args, 'todo');
  else if (args.command === 'type') await updateTaskType(args);
  else if (args.command === 'pick') await pickTask(args);
  else if (args.command === 'delete') await deleteTask(args);
  else await runOnce(args);

  if (args.watch) {
    setInterval(() => {
      runOnce(args).catch((error) => {
        console.error(error.message);
      });
    }, 30000);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
