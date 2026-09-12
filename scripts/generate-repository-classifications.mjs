import { readFileSync, writeFileSync } from 'node:fs';
import { compatibilityCatalog } from './catalog-schema.mjs';

const catalog = compatibilityCatalog(
  JSON.parse(readFileSync(new URL('../catalog/projects.json', import.meta.url), 'utf8'))
);
const projects = new Map(catalog.projects.map((project) => [project.id, project]));
const review = catalog.repositoryReview;
const categories = new Set([
  'active-product',
  'personal-tool',
  'support-tool',
  'finished-experiment',
  'paused-experiment',
  'archived-work',
]);
const rows = review.repositories.map((repository) => {
  const project = repository.projectId ? projects.get(repository.projectId) : null;
  if (repository.projectId && !project) throw new Error(`Missing project: ${repository.projectId}`);
  const category = project ? project.portfolio.futureForm : repository.futureForm;
  if (category != null && !categories.has(category))
    throw new Error(`Invalid category: ${category}`);
  return {
    repository: repository.originalRepository,
    url:
      repository.githubVerification?.url ??
      project?.public?.repositoryUrl ??
      project?.repositoryUrl ??
      `https://github.com/${repository.currentRepository}`,
    projectId: repository.projectId,
    category,
    shareable: project
      ? project.lifecycle.shareable
      : (repository.lifecycle?.shareable ?? (category === 'archived-work' ? false : null)),
    classificationSource: repository.classificationSource,
  };
});
if (rows.length !== 82 || new Set(rows.map((row) => row.repository)).size !== 82) {
  throw new Error('The original cohort must contain exactly 82 unique repository identities');
}
const counts = {};
for (const row of rows)
  counts[row.category ?? 'pending-confirmation'] =
    (counts[row.category ?? 'pending-confirmation'] ?? 0) + 1;
const markdown = [
  '# Original 82-repository classification',
  '',
  review.scope,
  '',
  'Generated from catalog/projects.json. Do not edit this table. Linked rows inherit project decisions. Classification alone does not establish shareability, deployment readiness, or active Fleet membership.',
  '',
  '| Category | Repository rows |',
  '| --- | ---: |',
  ...Object.entries(counts).map(([category, count]) => `| ${category} | ${count} |`),
  '',
  '| Repository | Category | Shareable |',
  '| --- | --- | --- |',
  ...rows.map(
    (row) =>
      `| [${row.repository}](${row.url}) | ${row.category ?? 'Pending confirmation'} | ${row.shareable == null ? 'Unverified' : row.shareable ? 'Yes' : 'No'} |`
  ),
  '',
].join('\n');
const path = new URL('../catalog/generated/repository-classifications.md', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== markdown)
    throw new Error('Generated repository table is stale');
} else writeFileSync(path, markdown);
console.log(JSON.stringify({ repositories: rows.length, counts }));
