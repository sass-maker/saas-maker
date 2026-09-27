/** Return the owner-configured Fleet catalog ID for an authenticated project. */
export async function getCatalogProjectId(
  db: D1Database,
  saasMakerProjectId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      'SELECT catalog_project_id FROM catalog_project_bindings WHERE saas_maker_project_id = ?'
    )
    .bind(saasMakerProjectId)
    .first<{ catalog_project_id: string }>();
  return row?.catalog_project_id ?? null;
}

/**
 * Return the SaaS Maker project id bound to a Fleet catalog id, if any.
 * Used by the public capture-config read endpoint to resolve a publishable
 * project key from a catalog id alone; never returns unbound or unknown ids.
 */
export async function getSaasMakerProjectIdByCatalogId(
  db: D1Database,
  catalogProjectId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      'SELECT saas_maker_project_id FROM catalog_project_bindings WHERE catalog_project_id = ?'
    )
    .bind(catalogProjectId)
    .first<{ saas_maker_project_id: string }>();
  return row?.saas_maker_project_id ?? null;
}

/** Optional attribution must not fail a successful feedback or subscription write. */
export async function tryGetCatalogProjectId(
  db: D1Database,
  saasMakerProjectId: string
): Promise<string | null> {
  try {
    return await getCatalogProjectId(db, saasMakerProjectId);
  } catch {
    return null;
  }
}
