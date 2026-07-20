#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readFile } from 'node:fs/promises';
import { renderApprovedContent, runScheduledDistributions, syncSourceContent } from '../src/marketing-orchestrator.js';
import { checkSocialReadiness } from '../src/social-readiness.js';

const runtimeDir = process.env.FLEET_MARKETING_RUNTIME
  ?? path.join(process.env.HOME ?? '.', 'Library/Application Support/Fleet Ops/marketing');
await mkdir(runtimeDir, { recursive: true });
const readiness = checkSocialReadiness();
await writeFile(path.join(runtimeDir, 'readiness.json'), `${JSON.stringify(readiness, null, 2)}\n`);
const sourceStatePath = path.join(runtimeDir, 'source-sync.json');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
let sourceState = {};
try { sourceState = JSON.parse(await readFile(sourceStatePath, 'utf8')); } catch {}
let sourceSync = { skipped: true, reason: 'already synced today' };
if (sourceState.date !== today) {
  sourceSync = await syncSourceContent({ limit: 1, maxPending: 12 });
  await writeFile(sourceStatePath, `${JSON.stringify({ date: today, completedAt: new Date().toISOString(), result: sourceSync }, null, 2)}\n`);
}
const rendered = await renderApprovedContent({ limit: 20 });
const posted = await runScheduledDistributions({ limit: 50 });
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sourceSync, rendered, posted }));
