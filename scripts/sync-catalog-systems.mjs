// Generates every per-system policy manifest from the single catalog source.
// The manifests on disk are read-only compatibility outputs, exactly like
// catalog/generated/operations.json: edit catalog/projects.json, never these.

import { isDeepStrictEqual } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { validateFeedbackApplicability } from './capture-policy-validation.mjs';

const catalogPath = new URL('../catalog/projects.json', import.meta.url);
const fleetRoot = new URL('../../', import.meta.url);
const check = process.argv.includes('--check');

const source = JSON.parse(readFileSync(catalogPath, 'utf8'));
const systems = source.systems ?? {};

// Capture policy is explicit for every primary/active product. Keep evidence
// tied to the canonical catalog so a policy cannot silently outlive its basis.
const captureApps = new Set(['newsletter', 'waitlist', 'not-applicable', 'undetermined']);
const captureConfidence = new Set(['high', 'medium', 'low']);
const captureFields = new Set([
  'applicability',
  'confidence',
  'rationale',
  'evidence',
  'feedbackApplicability',
]);
const captureEvidenceFields = new Set(['field', 'value']);
const captureConfigFields = new Set(['schemaVersion', 'purpose', 'sourceIssue', 'order']);
const captureConfig = systems.capturePolicy ?? {};
if (
  Object.keys(captureConfig).some((field) => !captureConfigFields.has(field)) ||
  captureConfig.schemaVersion !== 1 ||
  !captureConfig.purpose?.trim() ||
  !captureConfig.sourceIssue?.trim() ||
  !Array.isArray(captureConfig.order)
) {
  throw new Error('Invalid or unknown fields in capture policy configuration');
}
const captureCohort = source.projects.filter((project) =>
  ['primary', 'active'].includes(project.lifecycle?.status)
);
if (
  captureCohort.length !== captureConfig.order.length ||
  captureCohort.some((project, index) => captureConfig.order[index] !== project.id)
) {
  throw new Error('Capture policy order must exactly match the primary/active catalog cohort');
}
for (const project of captureCohort) {
  const policy = project.systems?.capture;
  if (!policy || !captureApps.has(policy.applicability))
    throw new Error(`Missing or invalid capture applicability: ${project.id}`);
  if (Object.keys(policy).some((field) => !captureFields.has(field)))
    throw new Error(`Unknown capture policy field: ${project.id}`);
  validateFeedbackApplicability(policy.feedbackApplicability, project.id);
  if (!captureConfidence.has(policy.confidence) || !policy.rationale?.trim())
    throw new Error(`Incomplete capture policy: ${project.id}`);
  if (!Array.isArray(policy.evidence) || policy.evidence.length === 0)
    throw new Error(`Capture policy needs catalog evidence: ${project.id}`);
  const evidenceFields = new Set();
  for (const evidence of policy.evidence) {
    if (
      Object.keys(evidence).some((field) => !captureEvidenceFields.has(field)) ||
      !evidence.field ||
      !Object.hasOwn(evidence, 'value') ||
      evidenceFields.has(evidence.field)
    )
      throw new Error(`Malformed capture evidence: ${project.id}`);
    evidenceFields.add(evidence.field);
    const actual = evidence.field.split('.').reduce((value, key) => value?.[key], project);
    if (actual === undefined || !isDeepStrictEqual(actual, evidence.value))
      throw new Error(`Stale capture evidence for ${project.id}: ${evidence.field}`);
  }
  if (
    policy.applicability === 'waitlist' &&
    !policy.evidence.some(
      ({ field, value }) =>
        /purposeContract\.(purpose|proof|nextAction)|sharing\.evidence\.reason/.test(field) &&
        typeof value === 'string' &&
        /unreleased|not yet (?:available|launched)|pre[- ]launch|coming soon/i.test(value)
    )
  ) {
    throw new Error(`Waitlist requires direct unreleased-offering evidence: ${project.id}`);
  }
}

// Native-session applicability is derived from catalogued product form and
// platform, not from telemetry receipts. Native-looking platform tags on a
// CLI or a benchmark guide do not make that product a native app.
const nativePlatforms = new Set([
  'macOS',
  'iOS',
  'iPadOS',
  'Android',
  'watchOS',
  'tvOS',
  'visionOS',
]);
const appHealthMetricProducts = captureCohort.map((project) => {
  const directory = project.presentation?.directory;
  const form = directory?.form;
  const platforms = directory?.platforms;
  if (typeof form !== 'string' || !Array.isArray(platforms) || platforms.length === 0) {
    throw new Error(`Native-session applicability needs catalog form and platforms: ${project.id}`);
  }
  const hasNativePlatform = platforms.some((platform) => nativePlatforms.has(platform));
  const hasNativeAppForm = hasNativePlatform && /\b(app|game)\b/i.test(form);
  const declaredNativeSessions = project.systems?.appHealth?.nativeSessions;
  if (hasNativeAppForm && !['applicable', 'not-applicable'].includes(declaredNativeSessions)) {
    throw new Error(
      `Native-session applicability needs an explicit catalog decision: ${project.id}`
    );
  }
  if (!hasNativeAppForm && declaredNativeSessions !== undefined) {
    throw new Error(
      `Native-session applicability is only allowed for native app/game forms: ${project.id}`
    );
  }
  // A product website is a browser surface even when the underlying product
  // is native. Explicit, evidence-backed N/A policy is reserved for internal,
  // factory, local-only, or privacy-bounded products with no reportable
  // browser audience.
  const hasCataloguedSite = typeof project.systems?.site?.url === 'string';
  const hasVisualFooter =
    Array.isArray(project.systems?.footerSurfaces) &&
    project.systems.footerSurfaces.some(
      ({ kind, state }) => kind === 'visual' && state === 'required'
    );
  const browserForm = /\b(web|website|browser|dashboard)\b/i.test(form);
  const hasBrowserSurface =
    platforms.includes('Web') || hasCataloguedSite || hasVisualFooter || browserForm;
  const browserVisitorOverride = project.systems?.appHealth?.browserVisitors;
  if (browserVisitorOverride !== undefined) {
    const allowedFields = new Set(['applicability', 'reason', 'sourceIssue']);
    if (
      !browserVisitorOverride ||
      typeof browserVisitorOverride !== 'object' ||
      Array.isArray(browserVisitorOverride) ||
      Object.keys(browserVisitorOverride).some((field) => !allowedFields.has(field)) ||
      browserVisitorOverride.applicability !== 'not-applicable' ||
      typeof browserVisitorOverride.reason !== 'string' ||
      browserVisitorOverride.reason.trim().length < 20 ||
      typeof browserVisitorOverride.sourceIssue !== 'string' ||
      !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+(?:#[A-Za-z0-9._-]+)?$/.test(
        browserVisitorOverride.sourceIssue
      )
    ) {
      throw new Error(`Invalid browser-visitor N/A override: ${project.id}`);
    }
  }
  const serverRequests = project.systems?.appHealth?.serverRequests;
  if (!['applicable', 'not-applicable', 'unknown'].includes(serverRequests)) {
    throw new Error(`Server-request applicability needs a catalog decision: ${project.id}`);
  }
  return {
    id: project.id,
    nativeSessions: hasNativeAppForm ? declaredNativeSessions : 'not-applicable',
    browserVisitors:
      browserVisitorOverride?.applicability ??
      (hasBrowserSurface ? 'applicable' : 'not-applicable'),
    ...(browserVisitorOverride
      ? {
          browserVisitorsReason: browserVisitorOverride.reason,
          browserVisitorsSourceIssue: browserVisitorOverride.sourceIssue,
        }
      : {}),
    serverRequests,
  };
});
for (const project of source.projects) {
  if (!['primary', 'active'].includes(project.lifecycle?.status) && project.systems?.capture)
    throw new Error(`Capture policy is out of scope for ${project.id}`);
  if (!['primary', 'active'].includes(project.lifecycle?.status) && project.systems?.appHealth)
    throw new Error(`App Health policy is out of scope for ${project.id}`);
}

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

{
  // Journey probes are read-only by policy: every catalogued journey is a
  // public GET with no body, credentials or query values. App Health reads the
  // generated file; it never decides which products are probed.
  const config = systems.probeJourneys ?? {};
  const allowedJourney = new Set([
    'journey',
    'url',
    'budget_ms',
    'timeout_ms',
    'warm_check',
    'expect',
  ]);
  const entries = systemEntries('probe');
  for (const [id, policy] of entries) {
    if (!Array.isArray(policy.journeys) || policy.journeys.length === 0)
      throw new Error(`Probe policy needs journeys or an absent reason: ${id}`);
    for (const journey of policy.journeys) {
      const unknown = Object.keys(journey).filter((field) => !allowedJourney.has(field));
      if (unknown.length > 0)
        throw new Error(`Probe journeys are GET-only; unexpected ${unknown.join(', ')}: ${id}`);
      const url = new URL(journey.url);
      if (url.protocol !== 'https:' || url.search || url.username || url.password)
        throw new Error(`Probe journey URL must be plain public https: ${id}/${journey.journey}`);
    }
  }
  outputs.set('app-health/apps/probe/journeys.json', {
    schema_version: 1,
    generated_from: 'saas-maker catalog/projects.json projects[].systems.probe (pnpm catalog:sync)',
    purpose: config.purpose,
    source_issue: config.sourceIssue,
    journeys: inOrder(config, entries, (id) =>
      entries.get(id)?.journeys.map((journey) => ({ project: id, ...journey }))
    ).flat(),
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

{
  const config = captureConfig;
  const { order: _order, ...policy } = config;
  outputs.set('saas-maker/tooling/config/capture-projects.json', {
    ...policy,
    projects: emitProjectKeyed(
      config,
      new Map(captureCohort.map((project) => [project.id, project.systems.capture]))
    ),
  });
  outputs.set('saas-maker/tooling/config/app-health-native-applicability.json', {
    schemaVersion: 1,
    purpose:
      'Native sessions, browser visitors, and server requests apply only to their catalogued product surfaces; missing telemetry remains unknown.',
    products: appHealthMetricProducts,
  });
}

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
