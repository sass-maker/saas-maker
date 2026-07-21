#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'docs');
const required = [
  'AGENTS.md',
  'README.md',
  'PROJECT_STATUS.md',
  'STATUS.md',
  'docs/README.md',
  'docs/index.mdx',
  'docs/getting-started/quickstart.md',
  'docs/widgets/feedback.md',
  'docs/services/project-keys.md',
  'docs/services/feedback.md',
  'docs/api/overview.md',
];

const errors = [];
for (const relative of required) {
  try {
    await access(path.join(root, relative));
  } catch {
    errors.push(`Missing required file: ${relative}`);
  }
}

async function markdownFiles(directory, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await markdownFiles(absolute, result);
    else if (/\.(md|mdx)$/.test(entry.name)) result.push(absolute);
  }
  return result;
}

for (const absolute of await markdownFiles(docsRoot)) {
  const content = await readFile(absolute, 'utf8');
  const relative = path.relative(root, absolute);
  if (content.trim().length < 50) errors.push(`Placeholder document: ${relative}`);
  for (const match of content.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:|mailto:|\/)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(absolute), target);
    try {
      await access(resolved);
    } catch {
      errors.push(`Broken link in ${relative}: ${target}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Documentation validation OK.');
}
