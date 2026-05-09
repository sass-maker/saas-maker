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

const STATUS_ORDER = ['todo', 'in_progress', 'done'];
const LOCAL_STATE_DIR = path.join(process.cwd(), '.symphony');
const LOCAL_TASK_CACHE = path.join(LOCAL_STATE_DIR, 'tasks.json');
const LOCAL_MEMORY_FILE = path.join(LOCAL_STATE_DIR, 'memory.md');
const DEFAULT_CLI_COMMAND = 'pnpm --dir packages/cli exec tsx src/index.ts';
const DEFAULT_AGENT_COMMANDS = {
  codex: 'codex exec --dangerously-bypass-approvals-and-sandbox {prompt}',
  claude: 'claude --dangerously-skip-permissions -p {prompt}',
  gemini: 'gemini --yolo -p {prompt}',
};

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
    status: null,
    noCache: false,
    memory: '',
    memoryPush: false,
    memoryPull: false,
    agent: process.env.SYMPHONY_AGENT || globalConfig.symphonyAgent || 'codex',
    agentCommand: process.env.SYMPHONY_AGENT_COMMAND || null,
    agentCommands: resolveAgentCommands(globalConfig),
    agentEnv: resolveAgentEnv(globalConfig),
    forwardedEnv: resolveForwardedEnv(globalConfig),
  };

  const commands = new Set(['list', 'pull', 'sync', 'create', 'claim', 'done', 'reopen', 'dispatch', 'pick', 'delete', 'memory', 'audit']);
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
    else if (arg === '--dispatch') args.dispatch = argv[++i] ?? null;
    else if (arg === '--api-base') args.apiBase = argv[++i];
    else if (arg === '--cli-command') args.cliCommand = argv[++i] ?? DEFAULT_CLI_COMMAND;
    else if (arg === '--description' || arg === '-d') args.description = argv[++i] ?? '';
    else if (arg === '--project' || arg === '-p') args.project = argv[++i] ?? '';
    else if (arg === '--priority') args.priority = argv[++i] ?? 'medium';
    else if (arg === '--status') args.status = argv[++i] ?? null;
    else if (arg === '--agent') args.agent = argv[++i] ?? 'codex';
    else if (arg === '--agent-command') args.agentCommand = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (args.command === 'dispatch') {
      args.ids.push(arg);
      args.id ||= arg;
    } else if (!args.id && ['claim', 'done', 'reopen', 'delete', 'audit'].includes(args.command)) {
      args.id = arg;
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
  pnpm symphony dispatch ID --agent codex-work
  pnpm symphony dispatch ID --agent-command 'my-agent run --prompt-file {promptFile}'
  pnpm symphony pick --agent claude     Claim the next runnable todo task (skips tasks with unfinished prerequisites)
  pnpm symphony pick --agent gemini     Claim the next runnable todo task (skips tasks with unfinished prerequisites)
  pnpm symphony claim ID                Move a production task to in_progress
  pnpm symphony done ID                 Move a production task to done
  pnpm symphony reopen ID               Move a production task back to todo
  pnpm symphony create "Title"          Create a production task
  pnpm symphony delete ID               Delete a production task
  pnpm symphony audit                   Show recent Symphony audit events
  pnpm symphony audit ID                Show audit events for one task
  pnpm symphony memory                  Show local Symphony operating memory
  pnpm symphony memory --pull           Pull production memory into .symphony/memory.md
  pnpm symphony memory --push           Push .symphony/memory.md to production
  pnpm symphony --watch                 Refresh the task list every 30s

Options:
  --api-base URL   API base URL override passed to the Foundry CLI as FND_API_URL
  --cli-command    Foundry CLI command, default: ${DEFAULT_CLI_COMMAND}
  --description    Description for create
  --project SLUG   Project slug for create
  --priority VALUE low, medium, or high for create
  --agent NAME     Agent profile for dispatch: codex, claude, gemini, or a configured profile
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
    codex   codex exec --dangerously-bypass-approvals-and-sandbox {prompt}
    claude  claude --dangerously-skip-permissions -p {prompt}
    gemini  gemini --yolo -p {prompt}

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
  const command = args.agentCommands[args.agent];
  if (!command) {
    throw new Error(`Unknown agent profile "${args.agent}". Use --agent-command or add it to symphonyAgentCommands in ~/.foundry/config.json.`);
  }
  return command;
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
  return `You are running a Foundry Symphony task.

Task ID: ${task.id}
Title: ${task.title}
Project: ${project}
Priority: ${task.priority}
Current status: ${task.status}

Description:
${task.description?.trim() || 'No additional description provided.'}
${formatMemoryBlock(memory)}

Execution contract:
- Treat the task row as the source of truth.
- Work in the project context above.
- Use this repository's AGENTS.md and WORKFLOW.md as operating guidance.
- Keep changes scoped to the task.
- Verify before claiming completion.
- When done, report changed files, evidence, and remaining risk so the task can be moved to Done.
`;
}

function buildCommand(task, args) {
  const project = task.project_slug ?? 'saas-maker';
  const workspacePath = `.symphony/workspaces/${workspaceKey(task)}`;
  const prompt = buildPrompt(task, args.memory);
  const agentTemplate = resolveAgentCommand(args);
  const agentCommand = `${renderEnvPrefix(args)}${renderAgentCommand(agentTemplate, task, prompt, workspacePath)}`;
  return [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `printf %s ${shellQuote(prompt)} > ${shellQuote(`${workspacePath}/prompt.md`)}`,
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
        if (task.blocked_on_user) console.log('    waiting on: user input');
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
      await recordRun(args, buildRunLedgerRecord({
        task,
        agent: args.agent,
        agentCommand: args.agentCommand,
        terminalHint: batch.length > 1 ? 'pnpm symphony batch dispatch printed command' : 'pnpm symphony dispatch printed command',
      }));
      await recordAudit(args, buildRunAuditEvent({
        task,
        action: DISPATCH_AUDIT_ACTION,
        actorSource: 'local-cli',
        agent: args.agent,
        agentCommand: args.agentCommand,
        note: batch.length > 1 ? 'CLI batch dispatch - printed shell command' : 'CLI dispatch - printed shell command',
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
      task.blocked_on_user ? 'user input' : null,
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
  const command = buildCommand(pickedTask, args);
  await recordRun(args, buildRunLedgerRecord({
    task: pickedTask,
    agent: args.agent,
    agentCommand: args.agentCommand,
    terminalHint: 'pnpm symphony pick claimed task and printed command',
  }));
  await recordAudit(args, buildRunAuditEvent({
    task: pickedTask,
    action: PICK_AUDIT_ACTION,
    actorSource: 'local-cli',
    agent: args.agent,
    agentCommand: args.agentCommand,
    note: 'CLI pick - claimed task and printed shell command',
  }));
  if (args.json) {
    console.log(JSON.stringify({ task: pickedTask, command }, null, 2));
    return;
  }
  console.log(command);
}

async function createTask(args) {
  if (!args.title?.trim()) throw new Error('Task title is required.');
  const payload = await apiRequest(args, '/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: args.title.trim(),
      description: args.description || undefined,
      project_slug: args.project || undefined,
      priority: args.priority || 'medium',
    }),
  });
  await fetchTasks(args);
  if (args.json) console.log(JSON.stringify(payload.data, null, 2));
  else console.log(`Created ${shortId(payload.data.id)}: ${payload.data.title}`);
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
  else if (args.command === 'create') await createTask(args);
  else if (args.command === 'claim') await updateTaskStatus(args, 'in_progress');
  else if (args.command === 'done') await updateTaskStatus(args, 'done');
  else if (args.command === 'reopen') await updateTaskStatus(args, 'todo');
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
