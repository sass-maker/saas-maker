#!/usr/bin/env node
/**
 * Generate a reviewable reel draft from a High Signal reel brief or SaaS Maker
 * product-improvement fixture/input.
 *
 * Usage:
 *   node scripts/draft-from-signal.js --fixture test/fixtures/high-signal-reel-brief.json
 *   node scripts/draft-from-signal.js --fixture test/fixtures/saas-maker-improvement.json --print-brief
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { briefFromSignal, normalizeReelDraftFromSignal } from '../src/signal-intake.js';

const args = parseArgs(process.argv.slice(2));
const fixturePath = path.resolve(args.fixture ?? 'test/fixtures/high-signal-reel-brief.json');
const input = JSON.parse(await readFile(fixturePath, 'utf8'));

if (args.printBrief) {
  console.log(JSON.stringify(briefFromSignal(input), null, 2));
  process.exit(0);
}

const draft = normalizeReelDraftFromSignal(input);
const outDir = path.resolve(args.outDir ?? './tmp/signal-drafts');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `${draft.id}.json`);
await writeFile(outPath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8');

console.log(`Draft reel written to ${outPath}`);
console.log(`  status=${draft.status} project=${draft.projectSlug} hook="${draft.hook}"`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--fixture') parsed.fixture = argv[index + 1];
    if (token === '--out-dir') parsed.outDir = argv[index + 1];
    if (token === '--print-brief') parsed.printBrief = true;
  }
  return parsed;
}
