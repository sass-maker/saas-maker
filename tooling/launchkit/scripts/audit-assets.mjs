#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSubmissionKit } from '../../../scripts/submission-kits.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// A Drive index is a snapshot, not proof of the current bytes or sharing state.
export function auditAssets(catalog, index, { productId, localSize } = {}) {
  if (!Array.isArray(catalog?.directory)) throw new Error('Invalid public catalog');
  if (index != null && !Array.isArray(index.products)) throw new Error('Invalid Drive index');
  const indexed = new Map();
  for (const item of index?.products ?? []) {
    if (!item?.id || indexed.has(item.id)) throw new Error('Missing or duplicate Drive product id');
    indexed.set(item.id, item);
  }
  const current = catalog.directory.filter((p) => p.roster === 'current');
  const selected = productId ? current.filter((p) => p.id === productId) : current;
  if (productId && !selected.length) throw new Error(`Unknown current product: ${productId}`);
  const products = selected.map((product) => {
    const kit = buildSubmissionKit(product);
    const drive = indexed.get(product.id);
    const issues = [];
    if (index && !drive) issues.push('missing-drive-folder-in-index');
    if (drive && !drive.driveFolderUrl) issues.push('missing-drive-folder-url');
    if (kit && drive) {
      if (!Array.isArray(drive.assets)) throw new Error(`Invalid Drive asset list: ${product.id}`);
      if (drive.assets.some((asset) => typeof asset.publicDownloadUrl !== 'string' || !asset.publicDownloadUrl))
        throw new Error(`Invalid public Drive asset link: ${product.id}`);
      const links = new Set(drive.assets.map((asset) => asset.publicDownloadUrl));
      const expected = new Set(kit.assets.map((asset) => asset.url));
      for (const asset of kit.assets) {
        if (!links.has(asset.url)) issues.push(`missing-or-stale-drive-index-link:${asset.id}`);
      }
      for (const [position, asset] of drive.assets.entries()) {
        if (!expected.has(asset.publicDownloadUrl)) issues.push(`extra-drive-index-link:${position}`);
      }
    }
    if (kit && localSize) {
      for (const asset of kit.assets) {
        if (asset.posterUrl && localSize(new URL(asset.posterUrl).pathname) === null)
          issues.push(`missing-local-poster:${asset.id}`);
        const url = new URL(asset.url);
        if (url.origin !== 'https://sassmaker.com' || !url.pathname.startsWith('/product-assets/')) continue;
        const size = localSize(url.pathname);
        if (size === null) issues.push(`missing-local-file:${asset.id}`);
        else if (asset.byteSize !== undefined && size !== asset.byteSize) issues.push(`local-size-mismatch:${asset.id}`);
      }
    }
    return { id: product.id, name: product.name, publicKit: !!kit,
      driveIndex: index ? (drive ? 'listed' : 'missing') : 'not-checked',
      missing: kit ? kit.missing : ['private-inventory-review'], issues };
  });
  return { scope: 'structural snapshot only; Drive bytes, permissions, current branding and live URLs are not checked',
    driveIndexChecked: !!index, products, orphanedDriveIds: index && !productId
      ? [...indexed.keys()].filter((id) => !current.some((p) => p.id === id)) : [] };
}

function main(args) {
  let indexPath, productId;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--index' && args[i + 1]) indexPath = args[++i];
    else if (args[i] === '--product' && args[i + 1]) productId = args[++i];
    else throw new Error('Usage: node audit-assets.mjs [--index <fresh-drive-index.json>] [--product <id>]');
  }
  const catalog = JSON.parse(readFileSync(resolve(root, 'catalog/generated/public.json'), 'utf8'));
  const index = indexPath ? JSON.parse(readFileSync(resolve(indexPath), 'utf8')) : null;
  const publicRoot = resolve(root, 'apps/showcase/public');
  const report = auditAssets(catalog, index, { productId, localSize: (path) => {
    const file = resolve(publicRoot, `.${path}`);
    if (!file.startsWith(publicRoot + sep)) throw new Error('Invalid asset path');
    try { return statSync(file).size; } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  } });
  console.log(JSON.stringify(report, null, 2));
  if (report.products.some((p) => p.issues.length) || report.orphanedDriveIds.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
