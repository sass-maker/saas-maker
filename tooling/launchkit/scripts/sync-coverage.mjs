#!/usr/bin/env node
/**
 * Launch coverage projector.
 *
 * Rebuilds the public per-project coverage ledger
 * (apps/showcase/src/data/launch-coverage.json) from the owner-local
 * submission records in tooling/config/directory-submissions/.
 *
 * The private ledger keeps local receipt paths and internal evidence; the
 * public projection keeps only project, destination domain, state, date, and
 * a short reason. Run it after recording new submissions to refresh the
 * coverage table on /launchdesk.
 *
 * Destination ids in the private ledger predate the launchdesk domain key, so
 * ids resolve through (1) an explicit override list, (2) the directories.json
 * home host, then (3) a normalized name/domain match. Unresolvable ids are
 * reported and skipped rather than guessed.
 *
 * Usage:
 *   node sync-coverage.mjs [--check]   # --check verifies without writing
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SUBMISSIONS = resolve(REPO_ROOT, 'tooling/config/directory-submissions/submissions.json');
const DIRECTORIES = resolve(REPO_ROOT, 'tooling/config/directory-submissions/directories.json');
const PUBLIC_CATALOG = resolve(REPO_ROOT, 'catalog/generated/public.json');
const CATALOG = resolve(REPO_ROOT, 'apps/showcase/src/data/launchdesk.json');
const OUT = resolve(REPO_ROOT, 'apps/showcase/src/data/launch-coverage.json');

const CHECK = process.argv.includes('--check');

const STATES = new Set(['prepared', 'submitted', 'scheduled', 'queued', 'live', 'skipped']);
// States that count toward the coverage percentage.
const COVERED = new Set(['submitted', 'scheduled', 'queued', 'live']);

// Slugs whose normalized form does not collide with the launchdesk domain.
const OVERRIDES = {
  dynamite: 'dynamite-ai.com',
  'startup-project': 'startupproject.org',
};

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const hostOf = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

const launchdesk = JSON.parse(readFileSync(CATALOG, 'utf8'));
const rows = launchdesk.destinations ?? launchdesk;
const domainSet = new Set(rows.map((r) => r.domain));
const activeCount = rows.filter((r) => !r.quarantined).length;

const normIndex = new Map();
for (const row of rows) {
  for (const key of [row.domain, row.name]) {
    const n = normalize(key ?? '');
    if (n && !normIndex.has(n)) normIndex.set(n, row.domain);
  }
}

const dirHosts = new Map();
if (existsSync(DIRECTORIES)) {
  const dirs = JSON.parse(readFileSync(DIRECTORIES, 'utf8'));
  for (const r of dirs.directories ?? dirs) {
    const host = hostOf(r.home || r.submitUrl || '');
    if (r.id && host) dirHosts.set(r.id, host);
  }
}

function resolveDomain(destinationId) {
  if (OVERRIDES[destinationId]) return OVERRIDES[destinationId];
  const host = dirHosts.get(destinationId);
  if (host && domainSet.has(host)) return host;
  const viaNorm = normIndex.get(normalize(destinationId));
  return viaNorm && domainSet.has(viaNorm) ? viaNorm : null;
}

if (!existsSync(SUBMISSIONS)) {
  console.error(`No submission ledger at ${SUBMISSIONS} — nothing to project.`);
  process.exit(1);
}
const submissions = JSON.parse(readFileSync(SUBMISSIONS, 'utf8')).submissions ?? [];

const projects = {};
const unresolved = new Set();
let dropped = 0;

for (const sub of submissions) {
  const { projectId, destinationId, state, reason, recordedAt } = sub;
  if (!projectId || !destinationId || !STATES.has(state)) {
    dropped += 1;
    continue;
  }
  const project = (projects[projectId] ??= { destinations: {}, externalTargets: {} });

  if (destinationId.startsWith('github:')) {
    const repo = `github.com/${destinationId.slice(7).replace(/--/g, '/')}`;
    const prior = project.externalTargets[repo];
    if (!prior || prior.recordedAt <= recordedAt) {
      project.externalTargets[repo] = { state, recordedAt, ...(reason ? { reason } : {}) };
    }
    continue;
  }

  const domain = resolveDomain(destinationId);
  if (!domain) {
    unresolved.add(destinationId);
    continue;
  }
  const prior = project.destinations[domain];
  if (!prior || prior.recordedAt <= recordedAt) {
    project.destinations[domain] = { state, recordedAt, ...(reason ? { reason } : {}) };
  }
}

for (const project of Object.values(projects)) {
  if (Object.keys(project.externalTargets).length === 0) delete project.externalTargets;
}

// Only publicly listed projects may appear in the checked-in ledger.
const publicCatalog = JSON.parse(readFileSync(PUBLIC_CATALOG, 'utf8'));
const publicIds = new Set((publicCatalog.directory ?? []).map((p) => p.id));
const hidden = Object.keys(projects).filter((id) => !publicIds.has(id));
for (const id of hidden) delete projects[id];
if (hidden.length) {
  console.warn(`  withheld non-public projects: ${hidden.join(', ')}`);
}

const ledger = {
  $schema: 'fleet.launch-coverage.v1',
  updated: new Date().toISOString().slice(0, 10),
  note: 'Public projection of the owner-local submission ledger. Agents mark destinations here as submissions are posted; private receipts stay in tooling/config/directory-submissions/.',
  coveredStates: [...COVERED],
  denominator: { destinations: activeCount },
  projects: Object.fromEntries(
    Object.entries(projects).sort(([a], [b]) => a.localeCompare(b))
  ),
};

const rendered = JSON.stringify(ledger, null, 2) + '\n';
if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (current !== rendered) {
    console.error('launch-coverage.json is stale — run node tooling/launchkit/scripts/sync-coverage.mjs');
    process.exit(1);
  }
  console.log('launch-coverage.json is up to date');
  process.exit(0);
}

writeFileSync(OUT, rendered);
const pairs = Object.values(projects).reduce(
  (n, p) => n + Object.keys(p.destinations).length + Object.keys(p.externalTargets ?? {}).length,
  0
);
console.log(`Wrote ${OUT}`);
console.log(`  ${Object.keys(projects).length} projects, ${pairs} destination pairs`);
if (unresolved.size) console.warn(`  unresolved ids skipped: ${[...unresolved].join(', ')}`);
if (dropped) console.warn(`  dropped ${dropped} rows without project/destination/state`);
