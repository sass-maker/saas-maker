#!/usr/bin/env node
/**
 * Launchkit tracker report — console summary of a run's submission ledger.
 *
 * Usage: node report.mjs --tracker tracker.json
 */

import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const trackerPath = args[args.indexOf('--tracker') + 1] ?? 'tracker.json';

const NEXT_ACTION = {
  planned: 'Prepare assets and copy',
  prepared: 'Submit (drafts are not submissions)',
  submitted: 'Watch for acceptance or a public page',
  scheduled: 'Check the public product page on the confirmed date',
  live: 'Done — keep evidence URL',
  rejected: 'Read the refusal; do not resubmit unchanged',
  blocked: 'Resolve the blocking condition or skip',
  skipped: 'Nothing',
};

let tracker;
try {
  tracker = JSON.parse(readFileSync(trackerPath, 'utf8'));
} catch (err) {
  console.error(`cannot read ${trackerPath}: ${err.message}`);
  process.exit(1);
}
if (tracker.$schema !== 'fleet.launchkit-tracker.v1') {
  console.error(`${trackerPath}: unexpected $schema ${tracker.$schema}`);
  process.exit(1);
}

const counts = {};
for (const e of tracker.entries) counts[e.state] = (counts[e.state] ?? 0) + 1;

console.log(`${tracker.product?.name || '(unnamed product)'} — ${tracker.entries.length} tracked routes`);
for (const [state, n] of Object.entries(counts).sort()) {
  console.log(`  ${state.padEnd(10)} ${n}`);
}
const open = tracker.entries.filter((e) => !['live', 'rejected', 'skipped'].includes(e.state));
if (open.length) {
  console.log('\nNext actions:');
  for (const e of open) {
    console.log(`  ${e.domain.padEnd(28)} ${e.state.padEnd(10)} → ${NEXT_ACTION[e.state] ?? '?'}`);
  }
}
const missingEvidence = tracker.entries.filter(
  (e) => ['submitted', 'scheduled', 'live'].includes(e.state) && !e.evidence
);
if (missingEvidence.length) {
  console.log('\nEvidence missing (dishonest states are worse than slow ones):');
  for (const e of missingEvidence) console.log(`  ${e.domain} — ${e.state} with no evidence recorded`);
}
