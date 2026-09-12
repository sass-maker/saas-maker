// Lossless storage mapping. Legacy names remain an API for existing consumers,
// never a second set of owner decisions. Unknown fields are retained verbatim.
export const fieldMap = {
  id: 'id',
  name: 'name',
  category: 'classification.category',
  'portfolio.futureForm': 'classification.futureForm',
  'portfolio.kind': 'classification.kind',
  family: 'classification.family',
  tier: 'classification.tier',
  attention: 'classification.attention',
  personalUse: 'purpose.personalUse',
  moneyOrPersonalBrand: 'purpose.moneyOrPersonalBrand',
  unmetNeed: 'purpose.unmetNeed',
  audience: 'purpose.audience',
  'lifecycle.status': 'lifecycle.status',
  'lifecycle.resumeCondition': 'lifecycle.resumeCondition',
  'portfolio.status': 'lifecycle.portfolioStatus',
  'portfolio.priority': 'lifecycle.priority',
  'portfolio.scopeDecision': 'lifecycle.scopeDecision',
  'lifecycle.shareable': 'sharing.shareable',
  'portfolio.readyToBeShared': 'sharing.readyToBeShared',
  'portfolio.sharingReadiness': 'sharing.evidence',
  notes: 'ownerNotes.notes',
  ownerNarrative: 'ownerNotes.ownerNarrative',
  repo: 'repositories.localPath',
  sourcePath: 'repositories.sourcePath',
  repositoryUrl: 'repositories.url',
  repositoryAliases: 'repositories.aliases',
  repositoryVisibility: 'repositories.visibility',
  aliases: 'repositories.projectAliases',
  status: 'deployment.status',
  'portfolio.deployed': 'deployment.deployed',
  authModel: 'deployment.authModel',
  deployKind: 'deployment.kind',
  cfProject: 'deployment.cfProject',
  cfPages: 'deployment.cfPages',
  deployTargets: 'deployment.targets',
  domains: 'deployment.domains',
  domainProbePaths: 'deployment.domainProbePaths',
  app: 'deployment.app',
  publicDir: 'deployment.publicDir',
  inRegistry: 'deployment.inRegistry',
  d1Databases: 'deployment.d1Databases',
  tursoDatabases: 'deployment.tursoDatabases',
  databaseResources: 'deployment.databaseResources',
  metrics: 'deployment.metrics',
  public: 'presentation.public',
};

function lookup(object, path) {
  const keys = path.split('.');
  let value = object;
  for (const key of keys) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key))
      return { present: false };
    value = value[key];
  }
  return { present: true, value };
}
function put(object, path, value) {
  const keys = path.split('.');
  let parent = object;
  for (const key of keys.slice(0, -1)) parent = parent[key] ??= {};
  parent[keys.at(-1)] = structuredClone(value);
}
function take(object, path) {
  const keys = path.split('.');
  const parents = [object];
  for (const key of keys.slice(0, -1)) parents.push(parents.at(-1)[key]);
  delete parents.at(-1)[keys.at(-1)];
  for (let index = keys.length - 1; index > 0; index--) {
    if (Object.keys(parents[index]).length) break;
    delete parents[index - 1][keys[index - 1]];
  }
}

export function structureCatalog(legacy) {
  if (legacy.catalogSchemaVersion === 2) return structuredClone(legacy);
  if (Object.hasOwn(legacy, 'catalogSchemaVersion')) throw new Error('Unknown catalog schema');
  const catalog = { catalogSchemaVersion: 2, ...structuredClone(legacy) };
  catalog.projects = legacy.projects.map((project) => {
    const result = {};
    const retained = structuredClone(project);
    for (const [from, to] of Object.entries(fieldMap)) {
      const field = lookup(project, from);
      if (!field.present) continue;
      put(result, to, field.value);
      take(retained, from);
    }
    const directory = catalog.publicDirectory?.projects;
    if (directory && Object.hasOwn(directory, project.id)) {
      put(result, 'presentation.directory', directory[project.id]);
      delete directory[project.id];
    }
    if (Object.keys(retained).length) result.retainedFields = retained;
    return result;
  });
  return catalog;
}

export function compatibilityCatalog(source) {
  if (!Object.hasOwn(source, 'catalogSchemaVersion')) return structuredClone(source);
  if (source.catalogSchemaVersion !== 2) throw new Error('Unknown catalog schema');
  const catalog = structuredClone(source);
  delete catalog.catalogSchemaVersion;
  catalog.projects = source.projects.map((project) => {
    const result = structuredClone(project.retainedFields ?? {});
    for (const [to, from] of Object.entries(fieldMap)) {
      const field = lookup(project, from);
      if (!field.present) continue;
      if (lookup(result, to).present)
        throw new Error(`Conflicting retained field: ${project.id}.${to}`);
      put(result, to, field.value);
    }
    if (Object.hasOwn(project.presentation ?? {}, 'directory')) {
      catalog.publicDirectory ??= {};
      catalog.publicDirectory.projects ??= {};
      if (Object.hasOwn(catalog.publicDirectory.projects, project.id))
        throw new Error(`Duplicate directory metadata: ${project.id}`);
      catalog.publicDirectory.projects[project.id] = structuredClone(
        project.presentation.directory
      );
    }
    return result;
  });
  return catalog;
}
