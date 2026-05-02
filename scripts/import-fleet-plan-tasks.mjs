#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const tasksFile = resolve(repoRoot, 'docs/fleet-plan-tasks.json');

function parseArgs(argv) {
  const out = {
    api: process.env.SAASMAKER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
    token: process.env.SAASMAKER_SESSION_TOKEN || '',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--api') out.api = argv[++i];
    else if (arg === '--token') out.token = argv[++i];
    else if (arg === '--help') {
      console.log(`Usage: node scripts/import-fleet-plan-tasks.mjs [--dry-run] [--api URL] [--token TOKEN]

Imports docs/fleet-plan-tasks.json into /v1/tasks.
Skips existing tasks with the same project_slug + title.

Environment:
  SAASMAKER_API_URL        API base URL, default http://localhost:8787
  SAASMAKER_SESSION_TOKEN  Bearer token for session-auth routes`);
      process.exit(0);
    }
  }

  return out;
}

function assertTask(task, index) {
  for (const field of ['project_slug', 'title', 'description', 'priority']) {
    if (typeof task[field] !== 'string' || !task[field].trim()) {
      throw new Error(`Task ${index} has invalid ${field}`);
    }
  }
  if (!['low', 'medium', 'high'].includes(task.priority)) {
    throw new Error(`Task ${index} has invalid priority: ${task.priority}`);
  }
}

async function request(api, token, path, init = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tasks = JSON.parse(readFileSync(tasksFile, 'utf8'));
  if (!Array.isArray(tasks)) throw new Error(`${tasksFile} must contain an array`);
  tasks.forEach(assertTask);

  if (args.dryRun) {
    const byProject = new Map();
    for (const task of tasks) {
      byProject.set(task.project_slug, (byProject.get(task.project_slug) ?? 0) + 1);
    }
    console.log(`Plan task seed contains ${tasks.length} tasks across ${byProject.size} projects.`);
    for (const [project, count] of [...byProject.entries()].sort()) {
      console.log(`- ${project}: ${count}`);
    }
    return;
  }

  if (!args.token) {
    throw new Error('Missing session token. Pass --token or set SAASMAKER_SESSION_TOKEN.');
  }

  const existing = await request(args.api, args.token, '/v1/tasks');
  const keys = new Set(
    (existing.data ?? []).map((task) => `${task.project_slug ?? ''}\u0000${task.title}`)
  );

  let created = 0;
  let skipped = 0;
  for (const task of tasks) {
    const key = `${task.project_slug}\u0000${task.title}`;
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    await request(args.api, args.token, '/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    keys.add(key);
    created += 1;
  }

  console.log(`Imported ${created} tasks. Skipped ${skipped} existing tasks.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
