import publicCatalog from '../../../../catalog/generated/public.json';

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
  stack?: string;
  schemaType?: string;
  sameAs?: string[];
  applicationCategory?: string;
  productLinks?: ProductLink[];
  pillarId: string;
  changelogUrl?: string;
  roadmapUrl?: string;
}

interface CatalogProduct {
  id: string;
  name: string;
  description: string;
  url: string;
  repositoryUrl?: string;
  changelogUrl?: string;
  roadmapUrl?: string;
  category: string;
  pillarId: string;
}

function adapt(product: CatalogProduct): RegistryProduct {
  const links: ProductLink[] = [
    { title: 'Product', url: product.url, description: 'Canonical product surface' },
    ...(product.changelogUrl
      ? [{ title: 'Changelog', url: product.changelogUrl, description: 'Changes shipped on main' }]
      : []),
    ...(product.roadmapUrl
      ? [{ title: 'Roadmap', url: product.roadmapUrl, description: 'Planned and deferred work' }]
      : []),
    ...(product.repositoryUrl
      ? [
          {
            title: 'Source',
            url: product.repositoryUrl,
            description: 'Canonical source repository',
          },
        ]
      : []),
  ];
  return {
    id: product.id,
    name: product.name,
    url: product.url,
    summary: product.description,
    stack: product.pillarId,
    schemaType: 'SoftwareApplication',
    sameAs: product.repositoryUrl ? [product.repositoryUrl] : undefined,
    applicationCategory: product.category,
    productLinks: links,
    pillarId: product.pillarId,
    changelogUrl: product.changelogUrl,
    roadmapUrl: product.roadmapUrl,
  };
}

export const REGISTRY_PRODUCTS = (publicCatalog.products as CatalogProduct[]).map(adapt);
export const REGISTRY_BY_ID = Object.fromEntries(
  REGISTRY_PRODUCTS.map((product) => [product.id, product])
);
export const PAGED_PRODUCTS = REGISTRY_PRODUCTS;

export function llmsTxtUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/llms.txt`;
}

export function apiAiUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/api/ai`;
}

export function indexMdUrl(product: RegistryProduct): string {
  return `${product.url.replace(/\/$/, '')}/index.md`;
}
