#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];

const commands = {
  install: [
    [
      'Mobile Dev Cockpit dependencies',
      'pnpm',
      ['--dir', 'apps/mobile-cockpit', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ],
    [
      'Drank dependencies',
      'pnpm',
      [
        '--dir',
        'services/drank',
        '--ignore-workspace',
        'install',
        '--frozen-lockfile',
        '--ignore-scripts',
      ],
    ],
    [
      'PSI Swarm dependencies',
      'pnpm',
      ['--dir', 'tools/psi-swarm', 'install', '--frozen-lockfile', '--ignore-scripts'],
    ],
    [
      'Reel Pipeline dependencies',
      'npm',
      ['--prefix', 'services/reel-pipeline', 'ci', '--ignore-scripts'],
    ],
  ],
  check: [
    ['Mobile Dev Cockpit typecheck', 'pnpm', ['--dir', 'apps/mobile-cockpit', 'typecheck']],
    ['Drank production build', 'pnpm', ['--dir', 'services/drank', '--ignore-workspace', 'build']],
    ['PSI Swarm CLI build', 'pnpm', ['--dir', 'tools/psi-swarm', 'build:cli']],
    ['PSI Swarm web build', 'pnpm', ['--dir', 'tools/psi-swarm', 'build:web']],
    ['Reel Pipeline Node and Rust tests', 'npm', ['--prefix', 'services/reel-pipeline', 'test']],
  ],
};

if (!(mode in commands)) {
  console.error('Usage: node scripts/foundry-components.mjs <install|check>');
  process.exitCode = 2;
} else {
  for (const [label, command, args] of commands[mode]) {
    console.log(`\n[foundry components] ${label}`);
    const result = spawnSync(command, args, {
      cwd: root,
      env: { ...process.env, CI: process.env.CI ?? '1' },
      stdio: 'inherit',
    });
    if (result.error) {
      console.error(result.error.message);
      process.exitCode = 1;
      break;
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}
