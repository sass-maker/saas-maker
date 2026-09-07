import publicCatalog from '../../../../catalog/generated/public.json';

export interface CoreProject {
  name: string;
  tag: string;
  desc: string;
  href: string;
}

interface PublicProduct {
  id: string;
  name: string;
  description: string;
  url: string;
  tier: string;
  category: string;
  priority: string;
  spotlight: boolean;
  maturity: string;
  pillarId: string;
}

const products = (publicCatalog.products as PublicProduct[]).filter(
  (product) => !['personal-website', 'saas-maker'].includes(product.id)
);


function toCore(product: PublicProduct): CoreProject {
  return {
    name: product.name,
    tag: new URL(product.url).hostname.replace(/^www\./, ''),
    desc: product.description,
    href: `/p/${product.id}`,
  };
}

const spotlight = products.filter((product) => product.spotlight);

export const CORE = spotlight.map(toCore);
