import { readFile, writeFile, realpath, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { compatibilityCatalog, structureCatalog } from './catalog-schema.mjs';

const canonical = new URL('../catalog/projects.json', import.meta.url);
const generated = new URL('../catalog/generated/operations.json', import.meta.url);

// Existing maintenance commands may work against the old in-memory shape, but
// must write back to the structured source. Refuse writes to a generated alias.
export async function saveCatalog(path, legacy, expectedRaw) {
  const resolved = await realpath(path);
  const generatedPath = await realpath(generated).catch(() => null);
  if (resolved === generatedPath)
    throw new Error('Generated catalog is read-only; edit catalog/projects.json');
  const current = await readFile(path, 'utf8');
  if (current !== expectedRaw)
    throw new Error('Catalog changed while editing; reload before saving');
  const original = JSON.parse(current);
  const wasStructured = original.catalogSchemaVersion === 2;
  if (
    wasStructured &&
    !isDeepStrictEqual(structureCatalog(compatibilityCatalog(original)), original)
  )
    throw new Error('Unmapped source fields; refusing to discard data while saving');
  const next = wasStructured ? structureCatalog(legacy) : legacy;
  if (!isDeepStrictEqual(compatibilityCatalog(next), legacy))
    throw new Error('Lossy catalog write refused');
  const pending = `${resolved}.${randomUUID()}.pending`;
  await writeFile(pending, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(pending, resolved);
  if (resolved === (await realpath(canonical).catch(() => null))) {
    await writeFile(generated, `${JSON.stringify(legacy, null, 2)}\n`, { mode: 0o600 });
  }
}
