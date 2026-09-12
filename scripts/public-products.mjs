import { compatibilityCatalog } from './catalog-schema.mjs';

const PRODUCT_FIELDS = new Set([
  'id',
  'name',
  'description',
  'url',
  'tier',
  'category',
  'priority',
  'spotlight',
  'lifecycle',
  'shareable',
  'maturity',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'pillarId',
  'purposeContract',
]);

const PAST_PROJECT_FIELDS = new Set([
  'category',
  'shareable',
  'id',
  'name',
  'description',
  'lifecycle',
  'repositoryUrl',
  'purposeContract',
]);
const DIRECTORY_FIELDS = new Set([
  'category',
  'shareable',
  'id',
  'name',
  'description',
  'makerNote',
  'purposeContract',
  'kind',
  'form',
  'platforms',
  'technologies',
  'group',
  'lifecycle',
  'deployed',
  'deploymentProviders',
  'domains',
  'url',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'firstCommitAt',
  'latestCommitAt',
]);

const FORBIDDEN_KEYS =
  /(?:secret|token|password|credential|private|owner|cfProject|notes|dependencies|evidenceSources|contracts|sourcePath|attention)/i;
const CREDENTIAL_VALUE =
  /(?:bearer\s+[a-z0-9._-]+|(?:api|access|secret)[_-]?key\s*[:=]|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;

function lifecycleStatus(project) {
  if (project.lifecycle && typeof project.lifecycle === 'object') {
    return project.lifecycle.status;
  }
  return project.lifecycle;
}

export function buildPublicProducts(catalog) {
  catalog = compatibilityCatalog(catalog);
  const products = [];
  const pastProjects = [];
  const directory = [];
  const directoryMetadata = catalog.publicDirectory?.projects;

  if (!directoryMetadata || typeof directoryMetadata !== 'object') {
    throw new Error('catalog.publicDirectory.projects is required');
  }

  for (const project of catalog.projects) {
    const metadata = project.public ?? { listing: 'hidden' };
    if (metadata.listing === 'hidden' || project.lifecycle?.shareable !== true) continue;
    if (!['utility', 'media', 'experimental'].includes(project.category)) {
      throw new Error(`${project.id}: invalid canonical category`);
    }

    if (metadata.listing === 'maintained') {
      const url = canonicalPublicUrl(project);
      const output = {
        id: metadata.id ?? project.id,
        name: metadata.name ?? project.name,
        description: metadata.description,
        url,
        tier: project.tier === 'focus' ? 'core' : project.tier,
        category: project.category,
        priority: project.portfolio.priority,
        spotlight: lifecycleStatus(project) === 'primary',
        lifecycle: lifecycleStatus(project),
        shareable: true,
        maturity: metadata.maturity,
        ...(metadata.hasChangelog === false ? {} : { changelogUrl: publicChangelogUrl(url) }),
        ...(metadata.repositoryUrl
          ? {
              repositoryUrl: metadata.repositoryUrl,
              roadmapUrl: `${metadata.repositoryUrl}/issues`,
            }
          : {}),
        pillarId: metadata.pillarId,
        purposeContract: directoryMetadata[project.id].purposeContract,
      };
      if (metadata.repositoryUrl && project.repositoryVisibility !== 'public') {
        throw new Error(
          `${project.id}: maintained public repository must have repositoryVisibility public`
        );
      }
      assertShape(output, PRODUCT_FIELDS, ['id', 'name', 'description', 'url']);
      assertEvidenceLinks(output);
      products.push(output);
      continue;
    }

    if (metadata.listing === 'past') {
      if (lifecycleStatus(project) !== 'inactive') {
        throw new Error(`${project.id}: past public listing requires lifecycle status inactive`);
      }
      if (project.repositoryVisibility !== 'public') {
        throw new Error(`${project.id}: past public listing requires a public repository`);
      }
      const output = {
        id: metadata.id ?? project.id,
        name: metadata.name ?? project.name,
        description: metadata.description,
        lifecycle: 'inactive',
        category: project.category,
        shareable: true,
        repositoryUrl: metadata.repositoryUrl,
        purposeContract: directoryMetadata[project.id].purposeContract,
      };
      assertShape(output, PAST_PROJECT_FIELDS, ['id', 'name', 'description', 'repositoryUrl']);
      pastProjects.push(output);
      continue;
    }

    throw new Error(`${project.id}: unsupported public listing ${metadata.listing}`);
  }

  const catalogIds = catalog.projects.map((project) => project.id).sort();
  const directoryIds = Object.keys(directoryMetadata).sort();
  if (JSON.stringify(catalogIds) !== JSON.stringify(directoryIds)) {
    throw new Error('public directory metadata must cover every canonical project exactly once');
  }

  for (const project of catalog.projects) {
    if (project.lifecycle?.shareable !== true || project.public?.listing === 'hidden') continue;
    const metadata = directoryMetadata[project.id];
    const repositoryUrl = publicRepositoryUrl(project);
    const domains = project.domains ?? [];
    const output = {
      id: project.id,
      name: project.public?.name ?? project.name,
      description: metadata.description ?? project.public?.description,
      makerNote: metadata.makerNote,
      ...(metadata.purposeContract ? { purposeContract: metadata.purposeContract } : {}),
      kind: project.portfolio.kind,
      category: project.category,
      form: metadata.form,
      platforms: metadata.platforms,
      technologies: metadata.technologies,
      group: directoryGroup(project),
      lifecycle: lifecycleStatus(project),
      shareable: true,
      deployed: project.portfolio.deployed,
      deploymentProviders: publicDeploymentProviders(
        catalog.infrastructure.projects[project.id]?.deployments ?? []
      ),
      domains,
      ...(domains[0] ? { url: canonicalPublicUrl(project) } : {}),
      ...(repositoryUrl ? { repositoryUrl } : {}),
      ...(project.public?.listing === 'maintained' &&
      project.public?.hasChangelog !== false &&
      domains[0]
        ? { changelogUrl: publicChangelogUrl(canonicalPublicUrl(project)) }
        : {}),
      ...(repositoryUrl ? { roadmapUrl: `${repositoryUrl}/issues` } : {}),
      firstCommitAt: metadata.firstCommitAt,
      latestCommitAt: metadata.latestCommitAt,
    };
    assertShape(output, DIRECTORY_FIELDS, [
      'id',
      'name',
      'description',
      'makerNote',
      'kind',
      'form',
      'platforms',
      'technologies',
      'group',
      'lifecycle',
    ]);
    if (!Array.isArray(output.platforms) || output.platforms.length === 0) {
      throw new Error(`${project.id}: directory platforms are required`);
    }
    if (!Array.isArray(output.technologies) || output.technologies.length === 0) {
      throw new Error(`${project.id}: directory technologies are required`);
    }
    directory.push(output);
  }

  for (const repository of catalog.repositoryReview?.repositories ?? []) {
    if (repository.projectId || repository.lifecycle?.shareable !== true) continue;
    const publicMetadata = repository.presentation?.public;
    const directoryMetadata = repository.presentation?.directory;
    if (!publicMetadata || !directoryMetadata || publicMetadata.listing === 'hidden') continue;
    if (!['utility', 'media', 'experimental'].includes(repository.category)) {
      throw new Error(`${repository.originalRepository}: invalid canonical category`);
    }

    const repositoryUrl = standaloneRepositoryUrl(repository);
    if (!repositoryUrl) continue;
    const id = publicMetadata.id;
    const lifecycle = repository.lifecycle.status;
    const common = {
      id,
      name: publicMetadata.name,
      description: publicMetadata.description,
      category: repository.category,
      shareable: true,
      repositoryUrl,
      purposeContract: directoryMetadata.purposeContract,
    };

    if (publicMetadata.listing === 'maintained') {
      if (lifecycle === 'inactive') {
        throw new Error(`${id}: maintained standalone listing cannot be inactive`);
      }
      const output = {
        ...common,
        url: repositoryUrl,
        lifecycle,
        spotlight: false,
        ...(publicMetadata.maturity ? { maturity: publicMetadata.maturity } : {}),
        roadmapUrl: `${repositoryUrl}/issues`,
        ...(publicMetadata.pillarId ? { pillarId: publicMetadata.pillarId } : {}),
      };
      assertShape(output, PRODUCT_FIELDS, ['id', 'name', 'description', 'url']);
      assertEvidenceLinks(output);
      products.push(output);
    } else if (publicMetadata.listing === 'past') {
      if (lifecycle !== 'inactive') {
        throw new Error(`${id}: past standalone listing requires lifecycle status inactive`);
      }
      const output = { ...common, lifecycle: 'inactive' };
      assertShape(output, PAST_PROJECT_FIELDS, ['id', 'name', 'description', 'repositoryUrl']);
      pastProjects.push(output);
    } else {
      throw new Error(`${id}: unsupported public listing ${publicMetadata.listing}`);
    }

    const output = {
      id,
      name: publicMetadata.name,
      description: directoryMetadata.description ?? publicMetadata.description,
      makerNote: directoryMetadata.makerNote,
      ...(directoryMetadata.purposeContract
        ? { purposeContract: directoryMetadata.purposeContract }
        : {}),
      kind: standaloneKind(repository.futureForm),
      category: repository.category,
      form: directoryMetadata.form,
      platforms: directoryMetadata.platforms,
      technologies: directoryMetadata.technologies,
      group: lifecycle === 'inactive' ? 'past' : 'current',
      lifecycle,
      shareable: true,
      deployed: false,
      deploymentProviders: [],
      domains: [],
      url: repositoryUrl,
      repositoryUrl,
      roadmapUrl: `${repositoryUrl}/issues`,
      firstCommitAt: directoryMetadata.firstCommitAt,
      latestCommitAt: directoryMetadata.latestCommitAt,
    };
    assertShape(output, DIRECTORY_FIELDS, [
      'id',
      'name',
      'description',
      'makerNote',
      'kind',
      'form',
      'platforms',
      'technologies',
      'group',
      'lifecycle',
    ]);
    if (!Array.isArray(output.platforms) || output.platforms.length === 0) {
      throw new Error(`${id}: directory platforms are required`);
    }
    if (!Array.isArray(output.technologies) || output.technologies.length === 0) {
      throw new Error(`${id}: directory technologies are required`);
    }
    directory.push(output);
  }

  assertUnique(products, 'maintained product');
  assertUnique(pastProjects, 'past project');
  const allIds = [...products, ...pastProjects].map((project) => project.id);
  if (new Set(allIds).size !== allIds.length) {
    throw new Error('public ids must be unique across maintained and past projects');
  }
  assertUnique(directory, 'directory project');

  products.sort(
    (left, right) =>
      Number(right.spotlight) - Number(left.spotlight) || left.name.localeCompare(right.name)
  );
  pastProjects.sort((left, right) => left.name.localeCompare(right.name));

  const projection = {
    schemaVersion: 5,
    generatedFrom: ['saas-maker/catalog/projects.json'],
    historySemantics: catalog.publicDirectory.historySemantics,
    directory,
    products,
    pastProjects,
  };
  assertNoPrivateData(projection);
  return projection;
}

function directoryGroup(project) {
  const status = lifecycleStatus(project);
  if (status === 'primary') return 'featured';
  if (status === 'inactive') return 'past';
  return 'current';
}

function standaloneKind(futureForm) {
  if (futureForm === 'active-product') return 'product';
  if (futureForm?.includes('experiment')) return 'experiment';
  if (futureForm === 'personal-tool') return 'utility';
  return 'project';
}

function standaloneRepositoryUrl(repository) {
  if (repository.repositoryVisibility !== 'public') return undefined;
  if (!/^[^/]+\/[^/]+$/.test(repository.currentRepository ?? '')) {
    throw new Error(`${repository.originalRepository}: invalid current GitHub repository`);
  }
  const repositoryUrl = `https://github.com/${repository.currentRepository}`;
  if (repository.githubVerification?.url && repository.githubVerification.url !== repositoryUrl) {
    throw new Error(`${repository.originalRepository}: GitHub verification URL mismatch`);
  }
  return repositoryUrl;
}

function publicRepositoryUrl(project) {
  if (project.repositoryVisibility !== 'public') return undefined;
  const repositoryUrl = project.public?.repositoryUrl ?? project.repositoryUrl;
  if (!repositoryUrl) return undefined;
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(repositoryUrl)) {
    throw new Error(`${project.id}: public directory repository must be a GitHub root URL`);
  }
  return repositoryUrl;
}

function publicDeploymentProviders(deployments) {
  const labels = new Set();
  for (const deployment of deployments) {
    const key = `${deployment.provider}:${deployment.kind}`;
    const label = {
      'apple:app-store-connect': 'Apple App Store Connect',
      'cloudflare:email-worker': 'Cloudflare Email Workers',
      'cloudflare:pages': 'Cloudflare Pages',
      'cloudflare:worker': 'Cloudflare Workers',
      'github:actions': 'GitHub Actions',
      'local:macos-app': 'Local macOS',
    }[key];
    if (label) labels.add(label);
  }
  return [...labels];
}

export function assertEvidenceLinks(product) {
  const productUrl = new URL(product.url);
  if (product.changelogUrl) {
    const changelogUrl = new URL(product.changelogUrl);
    const productPath = productUrl.pathname.replace(/\/+$/, '');
    if (
      changelogUrl.origin !== productUrl.origin ||
      changelogUrl.pathname !== `${productPath}/changelog`
    ) {
      throw new Error(`${product.id}: changelogUrl must be the canonical product path /changelog`);
    }
  }

  if (!product.repositoryUrl) {
    if (product.roadmapUrl) {
      throw new Error(`${product.id}: roadmapUrl requires a public repositoryUrl`);
    }
    return;
  }

  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(product.repositoryUrl)) {
    throw new Error(`${product.id}: repositoryUrl must be a canonical GitHub repository root`);
  }
  if (product.roadmapUrl !== `${product.repositoryUrl}/issues`) {
    throw new Error(`${product.id}: roadmapUrl must be the canonical GitHub Issues page`);
  }
}

export function assertNoPrivateData(value, trail = 'projection') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPrivateData(entry, `${trail}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new Error(`${trail}.${key}: forbidden private field`);
      assertNoPrivateData(entry, `${trail}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && CREDENTIAL_VALUE.test(value)) {
    throw new Error(`${trail}: credential-shaped value`);
  }
}

function canonicalPublicUrl(project) {
  const domain = project.domains?.[0];
  if (!domain) {
    throw new Error(`${project.id}: maintained public listing requires a canonical domain`);
  }
  const override = project.public?.url;
  if (override == null) return `https://${domain}`;

  let parsed;
  try {
    parsed = new URL(override);
  } catch {
    throw new Error(
      `${project.id}: public.url must be an absolute HTTPS URL on the canonical domain`
    );
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== domain.toLowerCase() ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      `${project.id}: public.url must be an absolute HTTPS URL on the canonical domain`
    );
  }
  return parsed.toString();
}

function publicChangelogUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/changelog`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function assertShape(value, allowed, required) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${value.id}: unsupported public field ${key}`);
  }
  for (const key of required) {
    if (!value[key]) throw new Error(`${value.id}: missing ${key}`);
  }
}

function assertUnique(values, label) {
  const ids = values.map((value) => value.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} ids must be unique`);
}
