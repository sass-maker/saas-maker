import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fleetRoot = path.resolve(repoRoot, '..');
const registryPath = path.join(repoRoot, 'foundry.projects.json');
const canonicalDocsPath = path.join(repoRoot, 'docs/fleet-canonical-projects.md');
const healthContractsPath = path.join(repoRoot, 'scripts/lib/fleet-health-contracts.mjs');

const outOfFleetDirs = new Set(['local-ai', 'personal-memory', 'port-whisperer', 'taste']);

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const registryProjects = Object.keys(registry).sort(compareProjectSlug);

const canonicalDocs = await readFile(canonicalDocsPath, 'utf8');
const canonicalProjects = [...canonicalDocs.matchAll(/^\|\s+`([^`]+)`\s+\|/gm)]
  .map((match) => match[1])
  .sort(compareProjectSlug);

const { FLEET_HEALTH_CONTRACTS } = await import(pathToFileURL(healthContractsPath).href);
const healthProjects = Object.keys(FLEET_HEALTH_CONTRACTS).sort(compareProjectSlug);

const localProjects = await listLocalProjectStatusDirs();

let failed = false;
failed =
  reportDiff(
    'foundry.projects.json',
    registryProjects,
    'docs/fleet-canonical-projects.md',
    canonicalProjects
  ) || failed;
failed =
  reportDiff(
    'foundry.projects.json',
    registryProjects,
    'scripts/lib/fleet-health-contracts.mjs',
    healthProjects
  ) || failed;
failed =
  reportDiff(
    'foundry.projects.json',
    registryProjects,
    'local PROJECT_STATUS.md dirs',
    localProjects
  ) || failed;

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Fleet contract sync OK (${registryProjects.length} projects).`);
}

async function listLocalProjectStatusDirs() {
  const entries = await readdir(fleetRoot, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (outOfFleetDirs.has(entry.name)) continue;
    try {
      await access(path.join(fleetRoot, entry.name, 'PROJECT_STATUS.md'));
      projects.push(entry.name);
    } catch {
      // No project status means this directory is not part of the local active-project contract.
    }
  }
  return projects.sort(compareProjectSlug);
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
