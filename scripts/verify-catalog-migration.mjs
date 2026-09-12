import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compatibilityCatalog } from './catalog-schema.mjs';
import { buildPublicProducts } from './public-products.mjs';

const backupPath = process.argv[2];
if (!backupPath)
  throw new Error('Usage: node scripts/verify-catalog-migration.mjs <projects.before.json>');
const backupRaw = readFileSync(backupPath, 'utf8');
const backup = JSON.parse(backupRaw);
const source = JSON.parse(
  readFileSync(new URL('../catalog/projects.json', import.meta.url), 'utf8')
);
assert.deepEqual(compatibilityCatalog(source), backup, 'A value was changed, added or lost');
assert.deepEqual(buildPublicProducts(source), buildPublicProducts(backup), 'Public export changed');
console.log(
  JSON.stringify({
    allOriginalValuesPreserved: true,
    publicExportUnchanged: true,
    projects: backup.projects.length,
    repositories: backup.repositoryReview.repositories.length,
    backupSha256: createHash('sha256').update(backupRaw).digest('hex'),
  })
);
