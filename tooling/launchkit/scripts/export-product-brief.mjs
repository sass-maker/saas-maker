#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSubmissionKit, submissionBrief, validatePublicSubmissionUrl } from '../../../scripts/submission-kits.mjs';

const args = process.argv.slice(2);
const options = new Map();
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === '--help') {
    console.log('Usage: export-product-brief.mjs --product <id> [--out brief.md] [--catalog <public.json or https://sassmaker.com/projects.json>]');
    process.exit(0);
  }
  if (!['--product', '--out', '--catalog'].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Invalid option: ${args[index]}`);
  options.set(args[index], args[index + 1]);
}
const productId = options.get('--product');
if (!productId) throw new Error('--product is required');
const source = options.get('--catalog') ?? new URL('../../../catalog/generated/public.json', import.meta.url);
let catalog;
if (typeof source === 'string' && /^https?:/.test(source)) {
  validatePublicSubmissionUrl(source);
  const response = await fetch(source, { redirect: 'error' });
  if (!response.ok) throw new Error(`Catalog returned HTTP ${response.status}`);
  catalog = await response.json();
} else catalog = JSON.parse(await readFile(source, 'utf8'));
const projects = Array.isArray(catalog) ? catalog : catalog.directory;
if (!Array.isArray(projects)) throw new Error('Expected a public directory array or public catalog projection');
const product = projects.find((entry) => entry.id === productId);
const kit = product ? buildSubmissionKit(product) : undefined;
if (!kit) throw new Error(`No public submission kit for ${productId}`);
const brief = submissionBrief(kit);
if (options.has('--out')) {
  await writeFile(resolve(options.get('--out')), brief, { flag: 'wx' });
  console.error(`Wrote ${options.get('--out')}; missing requirements: ${kit.missing.join(', ') || 'none of the standard fields'}`);
} else process.stdout.write(brief);
