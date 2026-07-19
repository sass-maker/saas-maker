import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'foundry.projects.json');
const canonicalDocsPath = path.join(repoRoot, 'docs/product/fleet-registry.md');
const healthContractsPath = path.join(repoRoot, 'scripts/lib/fleet-health-contracts.mjs');

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const registryProjects = Object.keys(registry).sort(compareProjectSlug);

const canonicalDocs = await readFile(canonicalDocsPath, 'utf8');
const canonicalProjects = [...canonicalDocs.matchAll(/^\|\s+`([^`]+)`\s+\|/gm)]
  .map((match) => match[1])
  .sort(compareProjectSlug);

const { FLEET_HEALTH_CONTRACTS } = await import(pathToFileURL(healthContractsPath).href);
const healthProjects = Object.keys(FLEET_HEALTH_CONTRACTS).sort(compareProjectSlug);

let failed = false;
failed =
  reportDiff(
    'foundry.projects.json',
    registryProjects,
    'docs/product/fleet-registry.md',
    canonicalProjects
  ) || failed;
failed =
  reportDiff(
    'foundry.projects.json',
    registryProjects,
    'scripts/lib/fleet-health-contracts.mjs',
    healthProjects
  ) || failed;
if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Fleet contract sync OK (${registryProjects.length} projects).`);
}

function reportDiff(leftName, left, rightName, right) {
  const missingFromRight = left.filter((project) => !right.includes(project));
  const missingFromLeft = right.filter((project) => !left.includes(project));
  if (missingFromRight.length === 0 && missingFromLeft.length === 0) return false;

  console.error(`Fleet contract drift: ${leftName} != ${rightName}`);
  if (missingFromRight.length) {
    console.error(`  Missing from ${rightName}: ${missingFromRight.join(', ')}`);
  }
  if (missingFromLeft.length) {
    console.error(`  Missing from ${leftName}: ${missingFromLeft.join(', ')}`);
  }
  return true;
}

function compareProjectSlug(a, b) {
  return a.localeCompare(b, 'en', { sensitivity: 'base' });
}
