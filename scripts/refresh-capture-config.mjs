import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const snapshotUrl = new URL(
  '../packages/newsletter-capture/src/capture-config.json',
  import.meta.url
);
const apiOrigin = 'https://api.sassmaker.com';

// This endpoint is public and credential-free. Keep only its browser-safe
// fields; never read credentials, owner records or private catalog data.
export function publicConfig(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    typeof body.api_key !== 'string' ||
    !/^pk_[a-z0-9]+$/.test(body.api_key) ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    typeof body.slug !== 'string' ||
    !body.slug.trim()
  )
    throw new Error('Invalid public capture configuration');
  return { api_key: body.api_key, name: body.name, slug: body.slug };
}

export async function refreshConfigs(ids, previous, fetcher = fetch) {
  const configs = {};
  for (const id of [...new Set(ids)].sort()) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid catalog id');
    const response = await fetcher(`${apiOrigin}/v1/capture-config/${encodeURIComponent(id)}`, {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404 && !Object.hasOwn(previous, id)) continue;
    if (!response.ok)
      throw new Error(`Cannot refresh capture config for ${id}: HTTP ${response.status}`);
    configs[id] = publicConfig(await response.json());
  }
  if (!Object.keys(configs).length) throw new Error('Refusing an empty capture configuration');
  return configs;
}

async function main() {
  const [catalog, policy] = await Promise.all([
    readFile(new URL('../catalog/generated/public.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../tooling/config/capture-projects.json', import.meta.url), 'utf8').then(
      JSON.parse
    ),
  ]);
  const previous = await readFile(snapshotUrl, 'utf8')
    .then(JSON.parse)
    .catch((error) => {
      if (error.code === 'ENOENT') return {};
      throw error;
    });
  const ids = [
    ...catalog.directory.map(({ id }) => id),
    ...policy.projects.map(({ id }) => id),
    ...Object.keys(previous),
    'memory-map',
    'high-signal-podcasts',
    'portfolio',
    'aliveville',
  ];
  const configs = await refreshConfigs(ids, previous);
  await writeFile(snapshotUrl, `${JSON.stringify(configs, null, 2)}\n`);
  console.log(
    `Refreshed ${Object.keys(configs).length} public project configs. Rebuild shared assets before deployment.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
