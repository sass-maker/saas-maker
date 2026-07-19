import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATALOG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'catalog');
export const CATALOG_PATH = path.join(CATALOG_ROOT, 'foundry.json');
export const GENERATED_ROOT = path.join(CATALOG_ROOT, 'generated');

export const EVIDENCE_STATES = new Set([
  'configured',
  'verified',
  'stale',
  'unknown',
  'not-applicable',
]);

const SECRET_KEY_PATTERN = /(?:^|[_-])(api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret|credential|private[_-]?key|client[_-]?secret|env(?:ironment)?)(?:$|[_-])/i;
const SECRET_VALUE_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|pk|ghp|gho|github_pat|xox[baprs])-[_A-Za-z0-9]{12,}\b/,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/,
];

const PUBLIC_ROOT_FIELDS = new Set(['schemaVersion', 'products']);
const PUBLIC_PRODUCT_FIELDS = new Set([
  'id',
  'name',
  'description',
  'url',
  'tier',
  'category',
  'priority',
  'spotlight',
  'maturity',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'pillarId',
]);

function canonical(value) {
  return String(value).trim().toLowerCase();
}

function addDuplicateErrors(items, label, valueFor, errors) {
  const seen = new Map();
  for (const [index, item] of items.entries()) {
    const raw = valueFor(item);
    if (raw === null || raw === undefined || raw === '') continue;
    const value = canonical(raw);
    if (seen.has(value)) {
      errors.push(`${label} duplicate ${JSON.stringify(raw)} at indexes ${seen.get(value)} and ${index}`);
    } else {
      seen.set(value, index);
    }
  }
}

function scanSecretLikeFields(value, location, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSecretLikeFields(entry, `${location}[${index}]`, errors));
    return;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
      errors.push(`secret-like value at ${location}`);
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const child = `${location}.${key}`;
    if (SECRET_KEY_PATTERN.test(key)) errors.push(`secret-like field ${child}`);
    scanSecretLikeFields(entry, child, errors);
  }
}

function validateEvidenceState(value, location, errors) {
  if (!EVIDENCE_STATES.has(value)) {
    errors.push(`${location} must be one of ${[...EVIDENCE_STATES].join(', ')}`);
  }
}

function publicRepositoryUrl(value) {
  if (typeof value !== 'string') return undefined;
  const normalized = value
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
  return normalized.startsWith('https://github.com/') ? normalized : undefined;
}

function publicProduct(catalog, record) {
  const productRecord = catalog.products.find((product) => product.id === record.id);
  const component = catalog.components.find((candidate) =>
    candidate.productId === record.id &&
    candidate.inPublicRegistry === true &&
    candidate.deployment?.domains?.length > 0
  );
  const repositoryUrl = publicRepositoryUrl(record.url);
  const product = {
    id: record.id,
    name: record.name,
    description: record.description,
    url: component ? `https://${component.deployment.domains[0]}` : repositoryUrl,
    tier: record.tier,
    category: record.category,
    priority: record.priority,
    spotlight: record.spotlight === true,
    maturity: record.maturity,
    repositoryUrl,
    changelogUrl: repositoryUrl ? `${repositoryUrl}/commits/main` : undefined,
    roadmapUrl: repositoryUrl ? `${repositoryUrl}/blob/main/PROJECT_STATUS.md` : undefined,
    pillarId: productRecord?.pillarIds?.[0],
  };
  return Object.fromEntries(Object.entries(product).filter(([, value]) => value !== undefined));
}

export function buildPublicProjection(catalog) {
  const visibleProductIds = new Set(
    catalog.products
      .filter((product) => product.lifecycle === 'maintained' && !['ignored', 'removed'].includes(product.attention))
      .map((product) => product.id),
  );
  return {
    schemaVersion: catalog.schemaVersion,
    products: catalog.publicRecords
      .filter((record) => visibleProductIds.has(record.id))
      .map((record) => publicProduct(catalog, record)),
  };
}

export function validatePublicProjection(projection) {
  const errors = [];
  for (const key of Object.keys(projection ?? {})) {
    if (!PUBLIC_ROOT_FIELDS.has(key)) errors.push(`private field in public output: $.${key}`);
  }
  if (!Array.isArray(projection?.products)) {
    errors.push('public output $.products must be an array');
    return errors;
  }
  projection.products.forEach((product, index) => {
    for (const key of Object.keys(product ?? {})) {
      if (!PUBLIC_PRODUCT_FIELDS.has(key)) {
        errors.push(`private field in public output: $.products[${index}].${key}`);
      }
    }
  });
  return errors;
}

export function validateCatalog(catalog) {
  const errors = [];
  const collections = ['products', 'components', 'packages', 'skills', 'repositories', 'automations', 'pillars', 'publicRecords', 'automationDetails'];

  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return ['catalog must be a JSON object'];
  }
  for (const name of collections) {
    if (!Array.isArray(catalog[name])) errors.push(`$.${name} must be an array`);
  }
  if (errors.length) return errors;

  for (const name of collections) addDuplicateErrors(catalog[name], `${name} id`, (item) => item?.id, errors);

  const domains = catalog.components.flatMap((component) =>
    (component.deployment?.domains ?? []).map((domain) => ({ domain, componentId: component.id })),
  );
  addDuplicateErrors(domains, 'domain', (item) => item.domain, errors);
  addDuplicateErrors(catalog.packages, 'package name', (item) => item.name, errors);
  addDuplicateErrors(catalog.skills, 'skill id', (item) => item.id, errors);
  addDuplicateErrors(catalog.automationDetails, 'automation detail product', (item) => item.productId, errors);
  addDuplicateErrors(
    catalog.automations.filter((automation) => automation.schedule),
    'schedule owner',
    (automation) => automation.schedule.ownerId,
    errors,
  );

  const pillarIds = new Set(catalog.pillars.map((pillar) => pillar.id));
  const requiredPillars = ['build', 'market', 'learn', 'visibility', 'control'];
  if (catalog.pillars.map((pillar) => pillar.id).join(',') !== requiredPillars.join(',')) {
    errors.push(`pillars must be exactly ${requiredPillars.join(', ')}`);
  }
  const productIds = new Set(catalog.products.map((product) => product.id));
  const repositoryIds = new Set(catalog.repositories.map((repository) => repository.id));

  for (const detail of catalog.automationDetails) {
    if (!productIds.has(detail.productId)) {
      errors.push(`automation detail references unknown product ${detail.productId}`);
    }
  }

  for (const product of catalog.products) {
    for (const pillarId of product.pillarIds ?? []) {
      if (!pillarIds.has(pillarId)) errors.push(`product ${product.id} has invalid pillar assignment ${pillarId}`);
    }
    if (product.repositoryId && !repositoryIds.has(product.repositoryId)) {
      errors.push(`product ${product.id} references unknown repository ${product.repositoryId}`);
    }
    if (product.lifecycle === 'maintained') {
      if (product.pillarIds?.length !== 1) {
        errors.push(`maintained product ${product.id} requires exactly one primary pillar`);
      }
      const observability = product.observability;
      if (!observability || !Array.isArray(observability.contracts) || observability.contracts.length === 0) {
        errors.push(`maintained product ${product.id} requires observability contracts`);
      }
      if (!observability || !Array.isArray(observability.evidenceSources) || observability.evidenceSources.length === 0) {
        errors.push(`maintained product ${product.id} requires evidence declarations`);
      }
      if (!observability?.ownerId) errors.push(`maintained product ${product.id} requires evidence ownership`);
    }
    if (product.observability?.state) {
      validateEvidenceState(product.observability.state, `product ${product.id} observability state`, errors);
    }
  }

  for (const component of catalog.components) {
    if (!productIds.has(component.productId)) {
      errors.push(`component ${component.id} references unknown product ${component.productId}`);
    }
    validateEvidenceState(component.deployment?.state, `component ${component.id} deployment state`, errors);
    validateEvidenceState(component.deployment?.verification?.state, `component ${component.id} verification state`, errors);
  }

  for (const item of [...catalog.packages, ...catalog.skills, ...catalog.repositories, ...catalog.automations]) {
    if (item.state) validateEvidenceState(item.state, `${item.id} state`, errors);
  }
  for (const automation of catalog.automations) {
    if (!automation.ownerId || !automation.evidenceOwnerId) {
      errors.push(`automation ${automation.id} requires automation and evidence ownership`);
    }
  }

  scanSecretLikeFields(catalog, '$', errors);
  errors.push(...validatePublicProjection(buildPublicProjection(catalog)));
  return errors;
}

export function assertValidCatalog(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(`Foundry catalog validation failed:\n- ${errors.join('\n- ')}`);
  return catalog;
}

function legacyFoundryProjects(catalog) {
  return Object.fromEntries(
    catalog.publicRecords.map((record) => [
      record.legacyKey,
      Object.fromEntries(
        Object.entries({
          desc: record.description,
          url: record.url,
          path: record.path,
          tier: record.tier,
          category: record.category,
          priority: record.priority,
          spotlight: record.spotlight === true ? true : undefined,
          maturity: record.maturity,
        }).filter(([, value]) => value !== undefined),
      ),
    ]),
  );
}

function legacyProjects(catalog) {
  return {
    _meta: {
      purpose: 'Generated compatibility view. Edit catalog/foundry.json only.',
      generatedFrom: 'catalog/foundry.json',
      evidenceStates: [...EVIDENCE_STATES],
    },
    projects: catalog.components.map((component) => ({
      id: component.id,
      family: component.family,
      tier: component.tier,
      repo: component.repositoryId === null ? null : component.repositoryId,
      deployKind: component.deployment.kind,
      cfProject: component.deployment.target,
      domains: component.deployment.domains,
      ...(component.app ? { app: component.app } : {}),
      inRegistry: component.inPublicRegistry,
      status: component.deployment.sourceStatus,
      notes: component.notes,
    })),
  };
}

function legacyAutomationRegistry(catalog) {
  const details = new Map(catalog.automationDetails.map((entry) => [entry.productId, entry]));
  const entries = catalog.products.map((product) => ({
    id: product.id,
    name: product.name,
    attention: product.attention,
    family: product.family,
    owner: product.ownerId,
    repository: product.repositoryId,
    runtimes: product.runtimes,
    surfaces: details.get(product.id)?.surfaces ?? [],
    dependencies: details.get(product.id)?.dependencies ?? [],
    contracts: product.observability?.contracts ?? [],
    evidenceSources: product.observability?.evidenceSources ?? [],
    actionPolicy: product.actionPolicy,
    alertPolicy: product.alertPolicy,
    exceptions: product.exceptions ?? [],
  }));
  const attentionCounts = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.attention))].map((attention) => [
      attention,
      entries.filter((entry) => entry.attention === attention).length,
    ]),
  );
  return {
    schemaVersion: 1,
    updatedAt: catalog.updatedAt,
    defaults: catalog.defaults,
    attentionCounts,
    entries,
  };
}

export function buildCompatibilityViews(catalog) {
  assertValidCatalog(catalog);
  return new Map([
    ['foundry.projects.json', legacyFoundryProjects(catalog)],
    ['ops-config-projects.json', legacyProjects(catalog)],
    ['automation-registry.json', legacyAutomationRegistry(catalog)],
    ['packages.json', { schemaVersion: catalog.schemaVersion, packages: catalog.packages }],
    ['skills.json', { schemaVersion: catalog.schemaVersion, skills: catalog.skills }],
    ['repositories.json', { schemaVersion: catalog.schemaVersion, repositories: catalog.repositories }],
    ['automations.json', { schemaVersion: catalog.schemaVersion, automations: catalog.automations }],
    ['pillars.json', { schemaVersion: catalog.schemaVersion, pillars: catalog.pillars }],
    ['public.json', buildPublicProjection(catalog)],
  ]);
}

export function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readCatalog(catalogPath = CATALOG_PATH) {
  return JSON.parse(await readFile(catalogPath, 'utf8'));
}

export async function writeCompatibilityViews(catalog, outputDirectory = GENERATED_ROOT) {
  const views = buildCompatibilityViews(catalog);
  await mkdir(outputDirectory, { recursive: true });
  for (const [filename, value] of views) {
    await writeFile(path.join(outputDirectory, filename), serializeJson(value), 'utf8');
  }
  return [...views.keys()];
}
