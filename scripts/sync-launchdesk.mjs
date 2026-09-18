#!/usr/bin/env node
// Sync the LaunchDesk static app from the sibling fleet/launchdesk checkout
// into the showcase bundle at public/launchdesk/. The vendored snapshot is
// committed, so this only runs when the source app changes.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fleetRoot = resolve(repositoryRoot, '..');
const sourceDir = resolve(fleetRoot, 'launchdesk', 'web');
const targetDir = resolve(repositoryRoot, 'apps/showcase/public/launchdesk');
const files = ['index.html', 'app.js', 'seed.js', 'styles.css'];

if (!existsSync(sourceDir)) {
  console.error(`LaunchDesk checkout not found at ${sourceDir}; vendored snapshot left unchanged.`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const source = resolve(sourceDir, file);
  if (!existsSync(source)) {
    console.error(`Missing ${source}; aborting without partial sync.`);
    process.exit(1);
  }
  copyFileSync(source, resolve(targetDir, file));
}
console.log(`Synced ${files.length} LaunchDesk files from ${sourceDir}`);
