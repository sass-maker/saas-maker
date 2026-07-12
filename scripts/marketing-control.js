#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { enqueueContentPackages, renderApprovedContent, runScheduledDistributions, syncSourceContent } from '../src/marketing-orchestrator.js';

const [command = 'tick', ...argv] = process.argv.slice(2);
const flags = parseFlags(argv);
let result;
if (command === 'sync') {
  result = { command, ...(await syncSourceContent({ source: flags.source ?? 'all', limit: numberFlag(flags.limit, 1), maxPending: numberFlag(flags['max-pending'], 12), fleetRoot: flags['fleet-root'], catalogPath: flags.catalog })) };
} else if (command === 'enqueue') {
  if (!flags.dir) throw new Error('enqueue requires --dir');
  const files = (await readdir(path.resolve(flags.dir))).filter((name) => name.endsWith('.json')).sort();
  const packages = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(path.resolve(flags.dir), name), 'utf8'))));
  result = { command, results: await enqueueContentPackages(packages) };
} else if (command === 'render') {
  result = { command, ...(await renderApprovedContent({ limit: numberFlag(flags.limit, 20), artifactDir: flags.out })) };
} else if (command === 'post') {
  result = { command, ...(await runScheduledDistributions({ limit: numberFlag(flags.limit, 50), accountsPath: flags.accounts })) };
} else if (command === 'tick') {
  const rendered = await renderApprovedContent({ limit: numberFlag(flags.limit, 20), artifactDir: flags.out });
  const posted = await runScheduledDistributions({ limit: numberFlag(flags.limit, 50), accountsPath: flags.accounts });
  result = { command, rendered, posted };
} else {
  throw new Error(`unsupported command: ${command}`);
}
console.log(JSON.stringify(result, null, 2));

function numberFlag(value, fallback) { const number = Number(value ?? fallback); if (!Number.isInteger(number) || number < 1) throw new Error('limit must be a positive integer'); return number; }
function parseFlags(args) { const flags = {}; for (let index = 0; index < args.length; index += 1) { const token = args[index]; if (!token.startsWith('--')) continue; const key = token.slice(2); const next = args[index + 1]; if (!next || next.startsWith('--')) flags[key] = true; else { flags[key] = next; index += 1; } } return flags; }
