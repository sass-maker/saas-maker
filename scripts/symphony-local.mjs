#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_API_BASE = 'https://api.sassmaker.com';
const STATUS_ORDER = ['todo', 'in_progress', 'done'];
const LOCAL_STATE_DIR = path.join(process.cwd(), '.symphony');
const LOCAL_TASK_CACHE = path.join(LOCAL_STATE_DIR, 'tasks.json');
const AGENT_COMMANDS = {
  codex: 'codex {prompt}',
  claude: 'claude -p {prompt}',
  gemini: 'gemini -p {prompt}',
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

function parseArgs(argv) {
  const args = {
    command: 'list',
    apiBase: process.env.FND_API_URL || process.env.SAASMAKER_API_URL,
    token: process.env.FOUNDRY_SESSION_TOKEN || process.env.SAASMAKER_SESSION_TOKEN,
    json: false,
    commands: false,
    dispatch: null,
    watch: false,
    id: null,
    title: null,
    description: null,
    project: null,
    priority: 'medium',
    status: null,
    noCache: false,
    agent: process.env.SYMPHONY_AGENT || 'codex',
    agentCommand: process.env.SYMPHONY_AGENT_COMMAND || null,
  };

  const commands = new Set(['list', 'pull', 'sync', 'create', 'claim', 'done', 'reopen', 'dispatch', 'delete']);
  if (argv[0] && !argv[0].startsWith('-') && commands.has(argv[0])) {
    args.command = argv.shift();
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--commands') args.commands = true;
    else if (arg === '--watch') args.watch = true;
    else if (arg === '--no-cache') args.noCache = true;
    else if (arg === '--dispatch') args.dispatch = argv[++i] ?? null;
    else if (arg === '--api-base') args.apiBase = argv[++i];
    else if (arg === '--token') args.token = argv[++i];
    else if (arg === '--description' || arg === '-d') args.description = argv[++i] ?? '';
    else if (arg === '--project' || arg === '-p') args.project = argv[++i] ?? '';
    else if (arg === '--priority') args.priority = argv[++i] ?? 'medium';
    else if (arg === '--status') args.status = argv[++i] ?? null;
    else if (arg === '--agent') args.agent = argv[++i] ?? 'codex';
    else if (arg === '--agent-command') args.agentCommand = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!args.id && ['claim', 'done', 'reopen', 'dispatch', 'delete'].includes(args.command)) {
      args.id = arg;
    } else if (args.command === 'create') {
      args.title = args.title ? `${args.title} ${arg}` : arg;
    }
  }

  const globalConfig = getGlobalConfig();
  args.apiBase ||= globalConfig.apiBaseUrl || DEFAULT_API_BASE;
  args.token ||= globalConfig.apiKey;
  args.agent ||= globalConfig.symphonyAgent || 'codex';
  args.agentCommand ||= globalConfig.symphonyAgentCommand || null;
  return args;
}

function printHelp() {
  console.log(`Foundry Symphony local runner

Usage:
  pnpm symphony                         Pull production tasks and list by status
  pnpm symphony --commands              Include isolated agent commands
  pnpm symphony dispatch ID             Print one task's agent command
  pnpm symphony dispatch ID --agent claude
  pnpm symphony dispatch ID --agent-command 'my-agent run --prompt-file {promptFile}'
  pnpm symphony claim ID                Move a production task to in_progress
  pnpm symphony done ID                 Move a production task to done
  pnpm symphony reopen ID               Move a production task back to todo
  pnpm symphony create "Title"          Create a production task
  pnpm symphony delete ID               Delete a production task
  pnpm symphony --watch                 Refresh the task list every 30s

Options:
  --api-base URL   API base URL, default from ~/.foundry/config.json or ${DEFAULT_API_BASE}
  --token TOKEN    CLI/session token, default from ~/.foundry/config.json
  --description    Description for create
  --project SLUG   Project slug for create
  --priority VALUE low, medium, or high for create
  --agent NAME     Agent profile for dispatch: codex, claude, gemini, or custom
  --agent-command  Command template for custom agents; supports {prompt}, {promptFile}, {workspace}, {taskId}
  --json           Print raw task JSON
  --no-cache       Do not write the pulled board to .symphony/tasks.json
`);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function homePath(value) {
  return `"$HOME/${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

function workspaceKey(task) {
  return task.id.replace(/[^A-Za-z0-9._-]/g, '_');
}

function resolveAgentCommand(args) {
  if (args.agentCommand) return args.agentCommand;
  const command = AGENT_COMMANDS[args.agent];
  if (!command) {
    throw new Error(`Unknown agent "${args.agent}". Use --agent-command for custom agents.`);
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

function buildPrompt(task) {
  const project = task.project_slug ?? 'saas-maker';
  return `You are running a Foundry Symphony task.

Task ID: ${task.id}
Title: ${task.title}
Project: ${project}
Priority: ${task.priority}
Current status: ${task.status}

Description:
${task.description?.trim() || 'No additional description provided.'}

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
  const prompt = buildPrompt(task);
  const agentTemplate = resolveAgentCommand(args);
  const agentCommand = renderAgentCommand(agentTemplate, task, prompt, workspacePath);
  return [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `printf %s ${shellQuote(prompt)} > ${shellQuote(`${workspacePath}/prompt.md`)}`,
    agentCommand,
  ].join(' && ');
}

async function fetchTasks(args) {
  if (!args.token) {
    throw new Error('No CLI/session token found. Run `fnd login`, or pass --token.');
  }

  const res = await fetch(`${args.apiBase.replace(/\/$/, '')}/v1/tasks`, {
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load tasks: HTTP ${res.status} ${await res.text()}`);
  }

  const payload = await res.json();
  const tasks = payload.data ?? [];
  if (!args.noCache) writeTaskCache(tasks, args);
  return tasks;
}

async function apiRequest(args, pathName, init = {}) {
  if (!args.token) {
    throw new Error('No CLI/session token found. Run `fnd login`, or pass --token.');
  }

  const res = await fetch(`${args.apiBase.replace(/\/$/, '')}${pathName}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${args.token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Production task sync failed: HTTP ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

function writeTaskCache(tasks, args) {
  fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  fs.writeFileSync(LOCAL_TASK_CACHE, JSON.stringify({
    apiBase: args.apiBase,
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
  console.log(`Source: ${args.apiBase.replace(/\/$/, '')}/v1/tasks`);
  if (!args.noCache) console.log(`Local cache: ${path.relative(process.cwd(), LOCAL_TASK_CACHE)}`);
  console.log(`Updated: ${timestamp}`);

  for (const status of STATUS_ORDER) {
    const bucket = tasks.filter((task) => task.status === status);
    console.log(`\n${status.toUpperCase()} (${bucket.length})`);
    if (bucket.length === 0) {
      console.log('  - none');
      continue;
    }

    for (const task of bucket) {
      const project = task.project_slug ?? 'saas-maker';
      const description = task.description ? ` — ${task.description.split('\n')[0]}` : '';
      console.log(`  - [${shortId(task.id)}] ${task.priority} ${project}: ${task.title}${description}`);
      if (args.commands) {
        console.log(`    ${buildCommand(task, args)}`);
      }
    }
  }
}

async function runOnce(args) {
  const tasks = await fetchTasks(args);

  if (args.dispatch || args.command === 'dispatch') {
    const id = args.dispatch ?? args.id;
    const task = findTask(tasks, id);
    console.log(buildCommand(task, args));
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'create') await createTask(args);
  else if (args.command === 'claim') await updateTaskStatus(args, 'in_progress');
  else if (args.command === 'done') await updateTaskStatus(args, 'done');
  else if (args.command === 'reopen') await updateTaskStatus(args, 'todo');
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
