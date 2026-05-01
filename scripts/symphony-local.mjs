#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_API_BASE = 'https://api.sassmaker.com';
const STATUS_ORDER = ['todo', 'in_progress', 'done'];

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
    apiBase: process.env.FND_API_URL || process.env.SAASMAKER_API_URL,
    token: process.env.FOUNDRY_SESSION_TOKEN || process.env.SAASMAKER_SESSION_TOKEN,
    json: false,
    commands: false,
    dispatch: null,
    watch: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') args.json = true;
    else if (arg === '--commands') args.commands = true;
    else if (arg === '--watch') args.watch = true;
    else if (arg === '--dispatch') args.dispatch = argv[++i] ?? null;
    else if (arg === '--api-base') args.apiBase = argv[++i];
    else if (arg === '--token') args.token = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  const globalConfig = getGlobalConfig();
  args.apiBase ||= globalConfig.apiBaseUrl || DEFAULT_API_BASE;
  args.token ||= globalConfig.apiKey;
  return args;
}

function printHelp() {
  console.log(`Foundry Symphony local runner

Usage:
  pnpm symphony                 List tasks grouped by status
  pnpm symphony --commands      Include isolated Codex commands
  pnpm symphony --dispatch ID   Print one task's Codex command
  pnpm symphony --watch         Refresh the task list every 30s

Options:
  --api-base URL   API base URL, default from ~/.foundry/config.json or ${DEFAULT_API_BASE}
  --token TOKEN    Session token, default from ~/.foundry/config.json
  --json           Print raw task JSON
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

function buildCommand(task) {
  const project = task.project_slug ?? 'saas-maker';
  const workspacePath = `.symphony/workspaces/${workspaceKey(task)}`;
  return [
    `cd ${homePath(`Desktop/Fleet/${project}`)}`,
    `mkdir -p ${shellQuote(workspacePath)}`,
    `cd ${shellQuote(workspacePath)}`,
    `codex ${shellQuote(buildPrompt(task))}`,
  ].join(' && ');
}

async function fetchTasks(args) {
  if (!args.token) {
    throw new Error('No session token found. Run `fnd login`, or pass --token.');
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
  return payload.data ?? [];
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
        console.log(`    ${buildCommand(task)}`);
      }
    }
  }
}

async function runOnce(args) {
  const tasks = await fetchTasks(args);

  if (args.dispatch) {
    const task = tasks.find((candidate) => (
      candidate.id === args.dispatch ||
      candidate.id.startsWith(args.dispatch) ||
      shortId(candidate.id) === args.dispatch
    ));
    if (!task) throw new Error(`Task not found for id prefix: ${args.dispatch}`);
    console.log(buildCommand(task));
    return;
  }

  printTasks(tasks, args);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await runOnce(args);

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
