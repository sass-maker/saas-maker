#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { renderBrandContentPackage } from '../src/adapters/brand-video.js';

const flags = parseFlags(process.argv.slice(2));
if (!flags.file) throw new Error('--file is required');
const input = JSON.parse(await readFile(path.resolve(flags.file), 'utf8'));
const result = await renderBrandContentPackage(input, {
  variantId: flags.variant,
  artifactDir: flags.out ? path.resolve(flags.out) : undefined,
  voice: flags.voice,
});
console.log(JSON.stringify({ outputPath: result.outputPath, reviewPath: result.reviewPath, receipt: result.receipt }, null, 2));

function parseFlags(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]; if (!token.startsWith('--')) continue;
    const key = token.slice(2); const next = argv[index + 1];
    if (!next || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; index += 1; }
  }
  return flags;
}
