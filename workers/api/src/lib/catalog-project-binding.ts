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
