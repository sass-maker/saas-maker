#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { contentPackageToVideoBrief, normalizeContentPackage } from '../src/content-package.js';
import { extractContentPackages } from '../src/content-extractors.js';

const [command = 'help', ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

if (command === 'extract') {
  const fleetRoot = path.resolve(flags['fleet-root'] ?? path.join(process.cwd(), '..'));
  const outDir = path.resolve(flags.out ?? './tmp/content-packages');
  const source = flags.source ?? 'all';
  const packages = await extractContentPackages(source, {
    fleetRoot,
    limit: Number(flags.limit ?? 5),
    catalogPath: flags.catalog ? path.resolve(flags.catalog) : undefined,
  });
  await mkdir(outDir, { recursive: true });
  for (const contentPackage of packages) {
    const filePath = path.join(outDir, `${slug(contentPackage.id)}.json`);
    await writeFile(filePath, `${JSON.stringify(contentPackage, null, 2)}\n`);
  }
  console.log(JSON.stringify({ source, outDir, packages: packages.map((entry) => ({ id: entry.id, brand: entry.brand.slug, variants: entry.variants.length })) }, null, 2));
} else if (command === 'validate') {
  const input = JSON.parse(await readFile(required(flags.file, '--file'), 'utf8'));
  const contentPackage = normalizeContentPackage(input);
  console.log(JSON.stringify({ valid: true, id: contentPackage.id, revision: contentPackage.revision, approval: contentPackage.approval.status }, null, 2));
} else if (command === 'brief') {
  const input = JSON.parse(await readFile(required(flags.file, '--file'), 'utf8'));
  const brief = contentPackageToVideoBrief(input, { variantId: flags.variant, renderMode: flags.mode });
  console.log(JSON.stringify(brief, null, 2));
} else {
  console.log(`Usage:
  npm run content -- extract [--source all|high-signal|significanthobbies|swe-interview-prep] [--limit 5] [--out DIR] [--fleet-root DIR]
  npm run content -- validate --file package.json
  npm run content -- brief --file approved-package.json [--variant ID] [--mode html-composition]

Extracted packages are proposed. This CLI cannot approve them.`);
}

function parseFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; index += 1; }
  }
  return flags;
}
function required(value, flag) {
  if (!value || value === true) throw new Error(`${flag} is required`);
  return path.resolve(value);
}
function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);
}
