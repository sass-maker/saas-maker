#!/usr/bin/env node

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const opsDir = resolve(scriptDir, '..');
const hookScript = resolve(opsDir, 'scripts/agent-bin/record-codex-skill-run.mjs');
const managedMarker = 'record-codex-skill-run.mjs';
const designScript = resolve(opsDir, 'scripts/design-workflow.mjs');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function mergeSkillRunHook(input, { commandPath = hookScript } = {}) {
  const config = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : {};
  config.hooks ??= {};
  const existing = Array.isArray(config.hooks.Stop) ? config.hooks.Stop : [];
  const retained = existing.filter(
    (group) =>
      !Array.isArray(group?.hooks) ||
      !group.hooks.some(
        (hook) => typeof hook?.command === 'string' && hook.command.includes(managedMarker),
      ),
  );
  retained.push({
    hooks: [
      {
        type: 'command',
        command: `/usr/bin/env node ${shellQuote(commandPath)}`,
        timeout: 3,
        statusMessage: 'Recording Fleet skill run',
      },
    ],
  });
  config.hooks.Stop = retained;
  return config;
}

export function mergeDesignRoutingHook(input, { commandPath = designScript } = {}) {
  const config = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : {};
  config.hooks ??= {};
  const existing = Array.isArray(config.hooks.UserPromptSubmit) ? config.hooks.UserPromptSubmit : [];
  const retained = existing.map((group) => {
    if (!Array.isArray(group?.hooks)) return group;
    return {
      ...group,
      hooks: group.hooks.filter((hook) => !(typeof hook?.command === 'string'
        && hook.command.includes('design-workflow.mjs') && hook.command.includes('prompt-hook'))),
    };
  }).filter((group) => !Array.isArray(group?.hooks) || group.hooks.length > 0);
  retained.push({
    hooks: [{
      type: 'command',
      command: `/usr/bin/env node ${shellQuote(commandPath)} prompt-hook`,
      timeout: 3,
      statusMessage: 'Loading Fleet design requirements',
      additionalContextLimit: 500,
    }],
  });
  config.hooks.UserPromptSubmit = retained;
  return config;
}

async function main() {
  const hooksPath = resolve(option('--hooks', resolve(homedir(), '.codex/hooks.json')));
  const dryRun = process.argv.includes('--dry-run');
  const designRouting = process.argv.includes('--design-routing');
  const label = designRouting ? 'design routing' : 'skill-run';
  let current = {};
  try {
    current = JSON.parse(await readFile(hooksPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const merged = designRouting ? mergeDesignRoutingHook(current) : mergeSkillRunHook(current);
  const rendered = `${JSON.stringify(merged, null, 2)}\n`;
  let previous = '';
  try {
    previous = await readFile(hooksPath, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (previous === rendered) {
    process.stdout.write(`Codex Fleet ${label} hook is current: ${hooksPath}\n`);
    return;
  }
  if (dryRun) {
    process.stdout.write(`Would update Codex Fleet ${label} hook: ${hooksPath}\n`);
    return;
  }

  await mkdir(dirname(hooksPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${hooksPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, rendered, { mode: 0o600 });
  await rename(temporaryPath, hooksPath);
  await chmod(hooksPath, 0o600);
  process.stdout.write(`Updated Codex Fleet ${label} hook: ${hooksPath}\n`);
  if (designRouting) process.stdout.write('Review and trust the new definition with /hooks in Codex before relying on activation.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`skill-run hook install failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
