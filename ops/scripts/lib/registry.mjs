/**
 * Shared fleet registry helpers — single source of truth for the
 * agent-surfaces registry path and the product origin preference chain.
 *
 * Consumed by indexnow-submit.mjs, agent-index-audit.mjs, and (for JSON-LD
 * emission) apply-agent-surfaces.mjs. Keep behavior-stable; callers verify
 * their --dry-run / --all output is unchanged after edits here.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// lib → scripts → fleet-ops → fleet root
const FLEET_ROOT = resolve(__dirname, '../../..');
export const REGISTRY_PATH = join(
  FLEET_ROOT,
  'fleet-ops/config/agent-surfaces-registry.json'
);

/**
 * Load and parse the agent-surfaces registry.
 * @param {string} [registryPath]
 * @returns {{ version: number, products: any[] }}
 */
export function loadRegistry(registryPath = REGISTRY_PATH) {
  if (!existsSync(registryPath)) {
    throw new Error(`Missing agent-surfaces registry at ${registryPath}`);
  }
  return JSON.parse(readFileSync(registryPath, 'utf8'));
}

/**
 * Product origin preference chain:
 * indexNowOrigin → marketingOrigin → canonicalOrigin → url.
 *
 * Returns the URL with any trailing slash removed, or null when no URL is
 * declared. Callers that treat a missing origin as a hard error should use
 * productOriginRequired instead.
 *
 * @param {{ id: string, indexNowOrigin?: string, marketingOrigin?: string, canonicalOrigin?: string, url?: string }} product
 * @returns {string | null}
 */
export function productOrigin(product) {
  const url =
    product.indexNowOrigin ||
    product.marketingOrigin ||
    product.canonicalOrigin ||
    product.url;
  return url ? String(url).replace(/\/$/, '') : null;
}

/**
 * Same as productOrigin but throws when the product has no URL — for callers
 * that cannot proceed without an origin (e.g. IndexNow submit).
 * @param {{ id: string }} product
 * @returns {string}
 */
export function productOriginRequired(product) {
  const origin = productOrigin(product);
  if (origin == null) {
    throw new Error(`Product ${product.id} has no url`);
  }
  return origin;
}
