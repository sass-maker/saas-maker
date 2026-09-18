#!/usr/bin/env node
// Sync the LaunchDesk catalog from the sibling fleet/launchdesk checkout into
// the showcase data file at src/data/launchdesk.json. The generated snapshot is
// committed, so this only runs when the source catalog changes.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fleetRoot = resolve(repositoryRoot, '..');
const sourcePath = resolve(fleetRoot, 'launchdesk', 'data', 'catalog.json');
const targetPath = resolve(repositoryRoot, 'apps/showcase/src/data/launchdesk.json');

if (!existsSync(sourcePath)) {
  console.error(`LaunchDesk catalog not found at ${sourcePath}; snapshot left unchanged.`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(sourcePath, 'utf8'));
const retrieved = catalog
  .map((row) => row.source_retrieved_at)
  .filter(Boolean)
  .sort()
  .at(-1);

const destinations = catalog.map((row) => ({
  name: row.name,
  domain: row.domain,
  website: row.website,
  submissionUrl: row.submission_url || null,
  category: row.category,
  pricing: row.pricing,
  dr: row.reported_dr,
  link: row.reported_link,
  eligibility: row.eligibility || null,
  flags: row.flags,
  route: row.route_status,
  provider: row.metric_provider || null,
  sourceUrl: row.source_url || null,
  retrieved: row.source_retrieved_at || null,
  measured: row.measured_at || null,
  quarantined: row.quarantined,
  claims: (row.claims ?? []).map((claim) => ({
    source: claim.source_id,
    dr: claim.dr,
    link: claim.link,
    pricing: claim.pricing,
  })),
}));

writeFileSync(
  targetPath,
  `${JSON.stringify({ snapshot: retrieved ?? null, destinations }, null, 2)}\n`
);
console.log(
  `Synced ${destinations.length} LaunchDesk destinations (snapshot ${retrieved ?? 'unknown'})`
);
