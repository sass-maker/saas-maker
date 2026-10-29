const COLLECTION_FIELDS = ['id', 'name', 'description', 'websiteUrl', 'projectIds'];

export function validatePublicCollections(collections, directory) {
  if (!Array.isArray(collections)) throw new Error('public collections must be an array');
  const projects = new Map(directory.map((project) => [project.id, project]));
  const ids = new Set();
  const members = new Set();
  for (const collection of collections) {
    if (
      !collection ||
      typeof collection !== 'object' ||
      Array.isArray(collection) ||
      Object.keys(collection).some((key) => !COLLECTION_FIELDS.includes(key))
    ) {
      throw new Error('unsupported public collection field');
    }
    if (
      typeof collection.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(collection.id) ||
      ids.has(collection.id) ||
      typeof collection.name !== 'string' ||
      !collection.name.trim() ||
      typeof collection.description !== 'string' ||
      !collection.description.trim()
    ) {
      throw new Error('invalid public collection identity');
    }
    let website;
    try {
      website = new URL(collection.websiteUrl);
    } catch {}
    if (
      website?.protocol !== 'https:' ||
      website.port ||
      website.username ||
      website.password ||
      website.search ||
      website.hash ||
      website.pathname !== '/' ||
      collection.websiteUrl !== `${website.origin}/`
    ) {
      throw new Error(`${collection.id}: public collection requires an HTTPS root website`);
    }
    if (
      !Array.isArray(collection.projectIds) ||
      collection.projectIds.length < 2 ||
      new Set(collection.projectIds).size !== collection.projectIds.length ||
      collection.projectIds.some(
        (id) =>
          members.has(id) ||
          projects.get(id)?.roster !== 'current' ||
          projects.get(id)?.availability !== 'public-link'
      )
    ) {
      throw new Error(
        `${collection.id}: public collection needs unique current public project ids`
      );
    }
    ids.add(collection.id);
    collection.projectIds.forEach((id) => members.add(id));
  }
}

export function buildPublicCollections(catalog, directory) {
  const collections = (catalog.systems?.rootBrands?.brands ?? [])
    .filter((brand) => brand.collection !== undefined)
    .map((brand) => {
      const collection = brand.collection;
      if (
        !collection ||
        typeof collection !== 'object' ||
        Array.isArray(collection) ||
        Object.keys(collection).some(
          (key) => !['id', 'description', 'websiteUrl', 'projectIds'].includes(key)
        )
      ) {
        throw new Error('invalid root brand collection');
      }
      let website;
      try {
        website = new URL(collection.websiteUrl);
      } catch {}
      if (!website || website.hostname !== brand.rootDomain) {
        throw new Error(`${brand.rootDomain}: collection website must use its root brand`);
      }
      return {
        id: collection.id,
        name: brand.canonicalName,
        description: collection.description,
        websiteUrl: collection.websiteUrl,
        projectIds: [...(collection.projectIds ?? [])],
      };
    });
  validatePublicCollections(collections, directory);
  return collections;
}
