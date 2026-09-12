import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { compatibilityCatalog, structureCatalog } from './catalog-schema.mjs';

const sourcePath = new URL('../catalog/projects.json', import.meta.url);
const outputPath = new URL('../catalog/generated/operations.json', import.meta.url);
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
if (source.catalogSchemaVersion !== 2) throw new Error('Expected structured catalog schema 2');
const output = compatibilityCatalog(source);
if (!isDeepStrictEqual(structureCatalog(output), source))
  throw new Error('Unmapped source fields: refusing to generate a lossy compatibility view');
const current = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null;
if (!isDeepStrictEqual(current, output)) {
  if (process.argv.includes('--check'))
    throw new Error('Generated operations view is stale; run pnpm catalog:sync');
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
}
console.log(`Compatibility view matches the one source (${output.projects.length} products)`);
