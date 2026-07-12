#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { checkSocialReadiness } from '../src/social-readiness.js';

const flags = parseFlags(process.argv.slice(2));
const configPath = path.resolve(flags.config ?? process.env.SOCIAL_ACCOUNTS_CONFIG ?? 'config/social-accounts.json');
if (flags.install) {
  await mkdir(path.dirname(configPath), { recursive: true });
  await copyFile(path.resolve('config/social-accounts.example.json'), configPath);
}
const report = checkSocialReadiness({ configPath });
const out = path.resolve(flags.out ?? 'tmp/social-readiness/report.json');
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (flags.strict && !report.summary.readyForLivePosting) process.exitCode = 1;

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
