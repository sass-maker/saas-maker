#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const files = ['format.mjs', 'http.mjs', 'manifest.mjs', 'llms.mjs', 'catalog.mjs', 'documents.mjs', 'handler.mjs', 'adapters/static-assets.mjs'];
const marker = '// Generated from sass-maker/saas-maker tooling/lib/agent-surfaces; use sync-agent-readability.mjs.\n';
const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
if (targetIndex < 0 || !args[targetIndex + 1]) throw new Error('Usage: node sync-agent-readability.mjs --target <explicit-vendor-directory> [--check]');
const target = resolve(args[targetIndex + 1]);
const source = fileURLToPath(new URL('../lib/agent-surfaces/', import.meta.url));
const entries = files.map((name) => ({ path: resolve(target, name), body: marker + readFileSync(resolve(source, name), 'utf8') }));
// Validate all destinations before writing any of them; preserve handwritten code.
for (const entry of entries) {
  if (existsSync(entry.path) && !readFileSync(entry.path, 'utf8').startsWith(marker)) throw new Error(`Refusing to overwrite unowned file: ${entry.path}`);
}
for (const entry of entries) {
  if (args.includes('--check')) {
    if (!existsSync(entry.path) || readFileSync(entry.path, 'utf8') !== entry.body) throw new Error(`Generated readability helper differs: ${entry.path}`);
  } else {
    mkdirSync(dirname(entry.path), { recursive: true });
    writeFileSync(entry.path, entry.body);
  }
}
console.log(`${args.includes('--check') ? 'Verified' : 'Updated'} ${entries.length} readability helper files.`);
