// Generates every per-system policy manifest from the single catalog source.
// The manifests on disk are read-only compatibility outputs, exactly like
// catalog/generated/operations.json: edit catalog/projects.json, never these.

import { isDeepStrictEqual } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const catalogPath = new URL('../catalog/projects.json', import.meta.url);
const fleetRoot = new URL('../../', import.meta.url);
const check = process.argv.includes('--check');

const source = JSON.parse(readFileSync(catalogPath, 'utf8'));
const systems = source.systems ?? {};
const projectsById = new Map(source.projects.map((project) => [project.id, project]));

const systemEntries = (key) => {
  const found = new Map();
  for (const project of source.projects) {
    const value = project.systems?.[key];
    // `{"absent": "<reason>"}` documents an intentional non-entry in the
    // catalog; it is never emitted to the manifest.
    if (value === undefined || (typeof value === 'object' && 'absent' in value)) continue;
    found.set(project.id, value);
  }
  return found;
};

const inOrder = (config, entries, keyOf) => {
  const order = config.order ?? [];
  const seen = new Set();
  const rows = [];
  for (const id of order) {
    const entry = keyOf(id);
    // `absent` markers and removed entries simply drop out of the manifest;
    // order is regenerated bookkeeping, not a correctness contract.
    if (entry === undefined) continue;
    seen.add(id);
    rows.push(entry);
  }
  for (const id of entries.keys()) {
    if (seen.has(id)) continue;
    const entry = keyOf(id);
    if (entry === undefined) {
      throw new Error(`systems entry for ${id} is not reachable through order`);
    }
    rows.push(entry);
  }
  return rows;
};

const withoutKey = (entry, key) => {
  const { [key]: _omit, ...rest } = entry;
  return rest;
};

const emitProjectKeyed = (config, entries, idField = 'id') =>
  inOrder(config, entries, (id) => {
    const entry = entries.get(id);
    return entry === undefined ? undefined : { [idField]: id, ...entry };
  });

const outputs = new Map();

{
  const entries = systemEntries('clarity');
  const { order: _order, ...config } = systems.clarity ?? {};
  outputs.set('saas-maker/tooling/config/clarity-projects.json', {
    ...config,
    projects: emitProjectKeyed(systems.clarity, entries),
  });
}

{
  const entries = systemEntries('clarityJourneys');
  const { order: _order, ...config } = systems.clarityJourneys ?? {};
  outputs.set('saas-maker/tooling/config/clarity-journeys.json', {
    ...config,
    projects: emitProjectKeyed(systems.clarityJourneys, entries),
  });
}

outputs.set(
  'saas-maker/tooling/config/clarity-capabilities.json',
  systems.clarityCapabilities ?? {}
);

{
  const config = systems.footerSurfaces ?? {};
  const bySurface = new Map();
  for (const project of source.projects) {
    const surfaces = project.systems?.footerSurfaces;
    if (!Array.isArray(surfaces)) continue;
    for (const surface of surfaces) {
      bySurface.set(surface.id, surface);
    }
  }
  outputs.set('site-health/apps/backend/config/footer-surfaces.json', {
    ...withoutKey(config, 'order'),
    surfaces: inOrder(config, bySurface, (id) => bySurface.get(id)),
  });
}

{
  const entries = systemEntries('geoObservatory');
  const { order: _order, ...config } = systems.geoObservatory ?? {};
  outputs.set('site-health/apps/backend/config/geo-observatory.json', {
    ...config,
    products: emitProjectKeyed(systems.geoObservatory, entries),
  });
}

{
  const entries = systemEntries('actionsPolicy');
  const config = systems.actionsPolicy ?? {};
  const projects = {};
  for (const entry of inOrder(config, entries, (id) =>
    entries.has(id) ? [id, entries.get(id)] : undefined
  )) {
    projects[entry[0]] = entry[1];
  }
  outputs.set('site-health/apps/backend/config/project-actions-policy.json', {
    ...withoutKey(config, 'order'),
    projects,
  });
}

{
  const entries = systemEntries('aiVisibility');
  const { order: _order, ...config } = systems.aiVisibility ?? {};
  outputs.set('site-health/apps/backend/config/ai-visibility.json', {
    ...config,
    projects: emitProjectKeyed(systems.aiVisibility, entries, 'slug'),
  });
}

{
  const entries = systemEntries('psiTarget');
  const { order: _order, ...config } = systems.psiPortfolioTargets ?? {};
  outputs.set('site-health/apps/backend/config/psi-portfolio-targets.json', {
    ...config,
    targets: emitProjectKeyed(systems.psiPortfolioTargets, entries, 'projectId'),
  });
}

{
  const entries = systemEntries('site');
  const { order: _order, ...config } = systems.sites ?? {};
  outputs.set('saas-maker/tooling/config/sites.json', {
    ...config,
    sites: emitProjectKeyed(systems.sites, entries),
  });
}

outputs.set('site-health/apps/backend/config/root-search-queries.json', systems.searchRoots ?? {});
outputs.set('site-health/apps/backend/config/root-brands.json', systems.rootBrands ?? {});
outputs.set('site-health/apps/backend/config/search-console.json', systems.searchConsole ?? {});
outputs.set(
  'saas-maker/tooling/config/entity-identity-canonical.json',
  systems.entityIdentity ?? {}
);
outputs.set(
  'saas-maker/tooling/config/entity-identity-sources.json',
  systems.entityIdentitySources ?? {}
);
outputs.set('saas-maker/tooling/config/ai-client-standard.json', systems.aiClientStandard ?? {});
outputs.set('saas-maker/tooling/config/design-workflow.json', systems.designWorkflow ?? {});
outputs.set('site-health/apps/backend/config/indexnow.json', systems.indexNow ?? {});
outputs.set('site-health/apps/backend/config/capabilities.json', systems.capabilities ?? {});

const stale = [];
for (const [relative, value] of outputs) {
  const target = new URL(relative, fleetRoot);
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;
  if (current === rendered) continue;
  const currentValue = current === null ? null : JSON.parse(current);
  if (currentValue !== null && isDeepStrictEqual(currentValue, value)) {
    // Same content, different layout: rewrite once so generated files carry
    // the canonical formatting.
    if (check) {
      stale.push(relative);
      continue;
    }
    writeFileSync(target, rendered);
    console.log(`normalized ${relative}`);
    continue;
  }
  if (check) {
    stale.push(relative);
    continue;
  }
  writeFileSync(target, rendered);
  console.log(`wrote ${relative}`);
}

if (stale.length > 0) {
  console.error(`stale generated manifests (run pnpm catalog:sync): ${stale.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`systems manifests match the one source (${outputs.size} files)`);
}
