#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const fleetProjection = path.resolve(
  process.env.FLEET_PUBLIC_PRODUCTS_PATH ?? path.join(repoRoot, '../fleet-ops/public/products.json')
);
const destination = path.join(repoRoot, 'catalog/generated/public.json');
const source = await readFile(fleetProjection, 'utf8');
const parsed = JSON.parse(source);

if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.products)) {
  throw new Error(`Unsupported Fleet public projection: ${fleetProjection}`);
}

if (process.argv.includes('--check')) {
  const current = await readFile(destination, 'utf8').catch(() => '');
  if (current !== source) {
    console.error('SaaS Maker public catalog is stale; run pnpm catalog:sync-public');
    process.exitCode = 1;
  } else {
    console.log(`SaaS Maker public catalog matches Fleet (${parsed.products.length} products)`);
  }
} else {
  await writeFile(destination, source);
  console.log(`Synced ${parsed.products.length} public products from Fleet`);
}
