#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { validateManifest } from './lib/manifest.mjs';
import { executeBenchmark } from './lib/runner.mjs';
import { summarizeReceipt } from './lib/statistics.mjs';

function usage() {
  console.error('Usage:');
  console.error('  node cli.mjs validate --manifest <manifest.json>');
  console.error('  node cli.mjs run --manifest <manifest.json> --out <new-or-empty-directory>');
  console.error('  node cli.mjs summarize --receipt <receipt.json>');
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const command = process.argv[2];
try {
  if (command === 'validate') {
    const manifestPath = resolve(argument('--manifest') ?? '');
    if (!argument('--manifest')) throw new Error('--manifest is required');
    const manifest = validateManifest(readJson(manifestPath), manifestPath);
    console.log(`Valid ${manifest.schemaVersion}: ${manifest.id}`);
  } else if (command === 'run') {
    const manifestArgument = argument('--manifest');
    const outputArgument = argument('--out');
    if (!manifestArgument || !outputArgument) throw new Error('--manifest and --out are required');
    const manifestPath = resolve(manifestArgument);
    const outputDirectory = resolve(outputArgument);
    if (existsSync(outputDirectory) && readdirSync(outputDirectory).length > 0) {
      throw new Error('--out must be a new or empty directory');
    }
    const result = await executeBenchmark(readJson(manifestPath), { manifestPath, outputDirectory });
    console.log(JSON.stringify(result.summary, null, 2));
    console.log(`RECEIPT=${resolve(result.outputRoot, 'receipt.json')}`);
    if (result.summary.qualification.status !== 'qualified') process.exitCode = 1;
  } else if (command === 'summarize') {
    const receiptPath = argument('--receipt');
    if (!receiptPath) throw new Error('--receipt is required');
    console.log(JSON.stringify(summarizeReceipt(readJson(resolve(receiptPath))), null, 2));
  } else {
    usage();
    process.exitCode = 2;
  }
} catch (error) {
  console.error(`agent-testing: ${error.message}`);
  process.exitCode = 1;
}
