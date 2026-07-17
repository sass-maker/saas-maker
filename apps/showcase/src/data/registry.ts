// Fleet product registry — sourced from fleet-ops/config/agent-surfaces-registry.json.
// This is the canonical product list; per-product pages and the directory index
// both derive from it so the hub stays in sync with the registry.

import registry from '../../../../../fleet-ops/config/agent-surfaces-registry.json';

export interface ProductLink {
  title: string;
  url: string;
  description?: string;
}

export interface RegistryProduct {
  id: string;
  name: string;
  url: string;
  summary: string;
  publicDir?: string;
  stack?: string;
  headFile?: string;
  schemaType?: string;
  sameAs?: string[];
  applicationCategory?: string;
  offers?: { '@type': string; price: string; priceCurrency: string; availability?: string };
  productLinks?: ProductLink[];
  indexMd?: string;
  hasDynamicLlms?: boolean;
}

export const REGISTRY_PRODUCTS: RegistryProduct[] = (registry as { products: RegistryProduct[] })
  .products;

export const REGISTRY_BY_ID: Record<string, RegistryProduct> = Object.fromEntries(
  REGISTRY_PRODUCTS.map((p) => [p.id, p])
);

// The showcase hub itself is a registry entry but should not get its own /p/<id> page
// (it IS the hub). Filter it out for per-product page generation.
const HUB_SELF_ID = 'saas-maker-showcase';

export const PAGED_PRODUCTS: RegistryProduct[] = REGISTRY_PRODUCTS.filter(
  (p) => p.id !== HUB_SELF_ID
);

/**
 * Derive the llms.txt URL for a product from its canonical URL.
 * Every public fleet origin exposes /llms.txt per the agent-indexing standard.
 */
export function llmsTxtUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/llms.txt`;
}

/**
 * Derive the /api/ai endpoint for a product.
 */
export function apiAiUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/api/ai`;
}

/**
 * Derive the /index.md endpoint for a product.
 */
export function indexMdUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/index.md`;
}
