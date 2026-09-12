import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { compatibilityCatalog, structureCatalog } from './catalog-schema.mjs';

const source = new URL('../catalog/projects.json', import.meta.url);
const generated = new URL('../catalog/generated/operations.json', import.meta.url);
const compatibility = new URL(
  '../../site-health/apps/backend/config/projects.json',
  import.meta.url
);
if (
  !lstatSync(compatibility).isSymbolicLink() ||
  realpathSync(compatibility) !== realpathSync(generated)
) {
  throw new Error(
    'Site Health must link to the generated operations view, never keep an editable catalog'
  );
}
const structured = JSON.parse(readFileSync(source, 'utf8'));
if (structured.catalogSchemaVersion !== 2) throw new Error('Expected catalog schema 2');
const catalog = compatibilityCatalog(structured);
if (!isDeepStrictEqual(structureCatalog(catalog), structured))
  throw new Error('Unmapped source fields');
if (!isDeepStrictEqual(JSON.parse(readFileSync(generated, 'utf8')), catalog))
  throw new Error('Stale operations view');
const projects = new Map(catalog.projects.map((project) => [project.id, project]));
if (projects.size !== catalog.projects.length) throw new Error('Duplicate project identity');
const repositories = catalog.repositoryReview.repositories;
if (
  repositories.length !== 82 ||
  new Set(repositories.map((row) => row.originalRepository)).size !== 82
) {
  throw new Error('The original review must retain all 82 repository identities');
}
for (const row of repositories) {
  const classification = row.projectId
    ? projects.get(row.projectId)?.portfolio.futureForm
    : row.futureForm;
  if (!classification) throw new Error(`Unclassified repository: ${row.originalRepository}`);
  if (row.projectId && row.futureForm)
    throw new Error(
      `Linked repository duplicates its project classification: ${row.originalRepository}`
    );
}
console.log(
  `One editable source: ${projects.size} projects, ${repositories.length} classified repository rows; generated Site Health view matches`
);
