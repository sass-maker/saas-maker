import { compatibilityCatalog } from './catalog-schema.mjs';
import { validateFooterArt } from '../packages/fleet-footer/src/artwork.mjs';
import { buildPublicCollections } from './project-collections.mjs';

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
  'footerArt',
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
  'footerArt',
]);
const DIRECTORY_FIELDS = new Set([
  'category',
  'shareable',
  'id',
  'name',
  'description',
  'makerNote',
  'logoUrl',
  'purposeContract',
  'footerArt',
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
  'roster',
  'availability',
  'publicUrl',
  'publicUrlLabel',
  'repositoryUrl',
  'changelogUrl',
  'roadmapUrl',
  'firstCommitAt',
  'latestCommitAt',
]);
const ARCHIVED_DIRECTORY_FIELDS = new Set([
  'id',
  'name',
  'description',
  'form',
  'platforms',
  'technologies',
  'roster',
  'availability',
  'profileUrl',
]);

const FORBIDDEN_KEYS =
  /(?:secret|token|password|credential|private|owner|cfProject|notes|dependencies|evidence|assessment|contracts|sourcePath|attention)/i;
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
  const archivedDirectory = [];
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
    const footerArt = validateFooterArt(project.footerArt, project.id);

    if (metadata.listing === 'maintained') {
      const url = canonicalPublicUrl(project, catalog);
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
        ...(footerArt ? { footerArt } : {}),
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
        ...(footerArt ? { footerArt } : {}),
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
    const metadata = directoryMetadata[project.id];
    if (!['active', 'archived'].includes(project.portfolio?.status)) {
      throw new Error(`${project.id}: portfolio.status must select current or archived roster`);
    }
    const roster = project.portfolio.status === 'archived' ? 'archived' : 'current';
    const outputBase = {
      id: project.id,
      name: project.public?.name ?? project.name,
      description: metadata.description ?? project.public?.description,
      form: metadata.form,
      platforms: metadata.platforms,
      technologies: metadata.technologies,
    };
    if (!outputBase.platforms?.length) {
      throw new Error(`${project.id}: directory platforms are required`);
    }
    if (!outputBase.technologies?.length) {
      throw new Error(`${project.id}: directory technologies are required`);
    }
    if (!outputBase.description || !outputBase.form) {
      throw new Error(`${project.id}: directory description and form are required`);
    }

    if (roster === 'archived') {
      const archived = {
        ...outputBase,
        roster: 'archived',
        availability: 'archived',
        profileUrl: `https://sassmaker.com/p/${project.id}`,
      };
      assertShape(archived, ARCHIVED_DIRECTORY_FIELDS, [
        'id',
        'name',
        'description',
        'form',
        'platforms',
        'technologies',
        'roster',
        'availability',
      ]);
      archivedDirectory.push(archived);
      continue;
    }

    const shareable = project.lifecycle?.shareable === true;
    const listing = project.public?.listing ?? 'hidden';
    const wasPubliclyListed = shareable && listing !== 'hidden';
    const computedAvailability =
      shareable && listing !== 'hidden'
        ? 'public-link'
        : shareable
          ? 'no-public-link'
          : 'not-publicly-available';
    const availability = metadata.availabilityLabel ?? computedAvailability;
    if (
      ![
        'public-link',
        'no-public-link',
        'not-publicly-available',
        'internal-private',
        'preview-not-qualified',
        'unreleased-prototype',
      ].includes(availability)
    ) {
      throw new Error(`${project.id}: unsupported directory availability label`);
    }
    const preservedPublicFields = wasPubliclyListed
      ? (() => {
          const domains = project.domains ?? [];
          const repositoryUrl = publicRepositoryUrl(project);
          const url =
            domains[0] || listing === 'maintained'
              ? canonicalPublicUrl(project, catalog)
              : undefined;
          return {
            ...(metadata.logoUrl ? { logoUrl: metadata.logoUrl } : {}),
            ...(metadata.purposeContract ? { purposeContract: metadata.purposeContract } : {}),
            ...(project.footerArt === undefined
              ? {}
              : { footerArt: validateFooterArt(project.footerArt, project.id) }),
            kind: project.portfolio.kind,
            category: project.category,
            group: directoryGroup(project),
            lifecycle: lifecycleStatus(project),
            shareable: true,
            deployed: project.portfolio.deployed,
            deploymentProviders: publicDeploymentProviders(
              catalog.infrastructure.projects[project.id]?.deployments ?? []
            ),
            domains,
            ...(url ? { url } : {}),
            ...(repositoryUrl ? { repositoryUrl } : {}),
            ...(listing === 'maintained' && project.public?.hasChangelog !== false && domains[0]
              ? { changelogUrl: publicChangelogUrl(canonicalPublicUrl(project, catalog)) }
              : {}),
            ...(repositoryUrl ? { roadmapUrl: `${repositoryUrl}/issues` } : {}),
            firstCommitAt: metadata.firstCommitAt,
            latestCommitAt: metadata.latestCommitAt,
          };
        })()
      : {};
    const contract = metadata.purposeContract;
    const safePurposeContract = contract
      ? Object.fromEntries(
          [
            'purpose',
            'audience',
            'outcome',
            'mechanism',
            ...(wasPubliclyListed ? ['proof', 'nextAction'] : []),
          ]
            .filter((field) => typeof contract[field] === 'string' && contract[field].trim())
            .map((field) => [field, contract[field]])
        )
      : undefined;
    const destinationUrl = Object.hasOwn(metadata, 'publicDestinationUrl')
      ? availability === 'public-link' &&
        typeof metadata.publicDestinationUrl === 'string' &&
        preservedPublicFields.url
        ? preservedPublicFields.url
        : metadata.publicDestinationUrl
      : availability === 'public-link'
        ? preservedPublicFields.url
        : undefined;
    if (destinationUrl && !/^https:\/\//.test(destinationUrl)) {
      throw new Error(`${project.id}: public destination must use HTTPS`);
    }
    const destinationLabel =
      metadata.publicDestinationLabel ??
      (destinationUrl
        ? destinationUrl.includes('github.com/')
          ? 'View source repository'
          : 'Visit website'
        : undefined);
    if (availability === 'public-link' && !destinationUrl) {
      throw new Error(`${project.id}: public-link availability needs a public destination`);
    }
    if (
      ['not-publicly-available', 'internal-private'].includes(availability) &&
      (destinationUrl ||
        preservedPublicFields.url ||
        preservedPublicFields.repositoryUrl ||
        preservedPublicFields.domains)
    ) {
      throw new Error(
        `${project.id}: private availability cannot publish public destinations or operational URLs`
      );
    }
    const output = {
      ...outputBase,
      group: directoryGroup(project),
      makerNote: metadata.makerNote ?? outputBase.description,
      ...(safePurposeContract && Object.keys(safePurposeContract).length === 4
        ? { purposeContract: safePurposeContract }
        : {}),
      ...preservedPublicFields,
      roster,
      availability,
      ...(destinationUrl ? { publicUrl: destinationUrl } : {}),
      ...(destinationLabel ? { publicUrlLabel: destinationLabel } : {}),
    };
    assertShape(output, DIRECTORY_FIELDS, [
      'id',
      'name',
      'description',
      'makerNote',
      'form',
      'platforms',
      'technologies',
      'roster',
      'availability',
    ]);
    if (!wasPubliclyListed && !output.purposeContract) {
      throw new Error(`${project.id}: current profile needs a safe purpose contract`);
    }
    if (['internal-private', 'not-publicly-available'].includes(availability) && output.publicUrl) {
      throw new Error(`${project.id}: private profile cannot publish a public destination`);
    }
    if (
      availability === 'unreleased-prototype' &&
      output.publicUrl &&
      destinationLabel !== 'Landing page'
    ) {
      throw new Error(
        `${project.id}: unreleased prototype destination must be identified as a landing page`
      );
    }
    if (
      availability === 'preview-not-qualified' &&
      output.publicUrl &&
      destinationLabel !== 'Preview site'
    ) {
      throw new Error(`${project.id}: preview destination must not imply a released product`);
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
  }

  assertUnique(products, 'maintained product');
  assertUnique(pastProjects, 'past project');
  const allIds = [...products, ...pastProjects].map((project) => project.id);
  if (new Set(allIds).size !== allIds.length) {
    throw new Error('public ids must be unique across maintained and past projects');
  }
  assertUnique(directory, 'current directory project');
  assertUnique(archivedDirectory, 'archived directory project');
  const expectedCurrent = catalog.projects.filter(
    (project) => project.portfolio?.status === 'active'
  ).length;
  const expectedArchived = catalog.projects.filter(
    (project) => project.portfolio?.status === 'archived'
  ).length;
  if (directory.length !== expectedCurrent || archivedDirectory.length !== expectedArchived) {
    throw new Error(
      'current and archived directory projections must match canonical portfolio status'
    );
  }
  if ([...directory, ...archivedDirectory].length !== catalog.projects.length) {
    throw new Error(
      'current and archived directory rosters must cover every canonical project once'
    );
  }

  products.sort(
    (left, right) =>
      Number(right.spotlight) - Number(left.spotlight) || left.name.localeCompare(right.name)
  );
  pastProjects.sort((left, right) => left.name.localeCompare(right.name));

  const projection = {
    schemaVersion: 6,
    generatedFrom: ['saas-maker/catalog/projects.json'],
    historySemantics: catalog.publicDirectory.historySemantics,
    directory,
    archivedDirectory,
    collections: buildPublicCollections(catalog, directory),
    products,
    pastProjects,
  };
  assertNoPrivateData(projection);
  return projection;
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

function directoryGroup(project) {
  const status = lifecycleStatus(project);
  if (status === 'primary') return 'featured';
  if (status === 'inactive') return 'past';
  return 'current';
}

function publicDeploymentProviders(deployments) {
  const labels = new Set();
  for (const deployment of deployments) {
    const label = {
      'apple:app-store-connect': 'Apple App Store Connect',
      'cloudflare:email-worker': 'Cloudflare Email Workers',
      'cloudflare:pages': 'Cloudflare Pages',
      'cloudflare:worker': 'Cloudflare Workers',
      'github:actions': 'GitHub Actions',
      'local:macos-app': 'Local macOS',
    }[`${deployment.provider}:${deployment.kind}`];
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

function canonicalPublicUrl(project, catalog) {
  const domain = project.domains?.[0];
  if (!domain) {
    if (
      project.deployKind === 'none' &&
      project.repositoryVisibility === 'public' &&
      project.repositoryUrl
    ) {
      return project.repositoryUrl;
    }
    throw new Error(`${project.id}: maintained public listing requires a canonical domain`);
  }
  const directory = catalog.publicDirectory?.projects?.[project.id];
  const destination = ['preview-not-qualified', 'unreleased-prototype'].includes(
    directory?.availabilityLabel
  )
    ? undefined
    : directory?.publicDestinationUrl;
  const override = typeof destination === 'string' ? destination : project.public?.url;
  if (override == null) return `https://${domain}`;

  let parsed;
  try {
    parsed = new URL(override);
  } catch {
    throw new Error(
      `${project.id}: public.url must be an absolute HTTPS URL on the canonical domain`
    );
  }
  const collectionDestination =
    typeof destination === 'string' &&
    (catalog.systems?.rootBrands?.brands ?? []).some(
      (brand) =>
        brand.rootDomain === parsed.hostname &&
        brand.collection?.projectIds?.includes(project.id) &&
        brand.collection.websiteUrl === `${parsed.origin}/`
    );
  if (
    parsed.protocol !== 'https:' ||
    (parsed.hostname.toLowerCase() !== domain.toLowerCase() && !collectionDestination) ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (typeof destination === 'string' &&
      /^https:\/\/([^/?#]+)/.exec(destination)?.[1] !== parsed.hostname)
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
