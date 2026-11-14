import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogPaths } from './catalog-paths.mjs';
import { appHealthMonitoringManifests } from './app-health-monitoring-policy.mjs';

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
if (
  targetIndex < 0 ||
  !args[targetIndex + 1] ||
  args.some((arg, i) => arg !== '--check' && i !== targetIndex && i !== targetIndex + 1)
)
  throw new Error(
    'Usage: node scripts/sync-app-health-monitoring.mjs --target <app-health-checkout> [--check]'
  );
const target = resolve(args[targetIndex + 1]);
if (JSON.parse(readFileSync(resolve(target, 'package.json'), 'utf8')).name !== 'app-health')
  throw new Error('--target must be an App Health checkout');
const source = catalogPaths(resolve(dirname(fileURLToPath(import.meta.url)), '..')).source;
const manifests = appHealthMonitoringManifests(JSON.parse(readFileSync(source, 'utf8')));
for (const [name, value] of [
  ['journeys.json', manifests.probes],
  ['coverage.json', manifests.coverage],
]) {
  const path = resolve(target, 'apps/probe', name);
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  if (args.includes('--check')) {
    if (readFileSync(path, 'utf8') !== rendered)
      throw new Error(`Stale monitoring manifest: ${name}`);
  } else writeFileSync(path, rendered);
}
console.log(
  JSON.stringify({
    projects: manifests.coverage.projects.length,
    public_projects: manifests.coverage.projects.filter((p) => p.scope === 'public').length,
    journeys: manifests.probes.journeys.length,
    check: args.includes('--check'),
  })
);
