import publicCatalog from '../../../../catalog/generated/public.json';

export const GITHUB_URL = 'https://github.com/sass-maker/saas-maker';

export interface CoreProject {
  n: string;
  name: string;
  initials: string;
  tag: string;
  desc: string;
  color: string;
  size: 'feature' | 'tall' | 'wide' | 'std';
  href: string;
}

export interface ActiveProject {
  name: string;
  desc: string;
  color: string;
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
  (product) => product.id !== 'personal-website'
);
const spotlightOrder = ['codevetter', 'posttrainllm', 'pace', 'high-signal'];
const colors = [
  '#10b981',
  '#06b6d4',
  '#f59e0b',
  '#84cc16',
  '#e07b3a',
  '#38bdf8',
  '#a855f7',
  '#14b8a6',
];

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length === 1
    ? words[0].slice(0, 2).toUpperCase()
    : words
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
}

function toCore(product: PublicProduct, index: number): CoreProject {
  return {
    n: String(index + 1).padStart(3, '0'),
    name: product.name,
    initials: initials(product.name),
    tag: `${product.pillarId} · ${product.maturity}`,
    desc: product.description,
    color: colors[index % colors.length],
    size: index === 0 ? 'tall' : index === 3 ? 'wide' : 'std',
    href: `/p/${product.id}`,
  };
}

const spotlight = spotlightOrder
  .map((id) => products.find((product) => product.id === id))
  .filter((product): product is PublicProduct => Boolean(product?.spotlight));

export const CORE = spotlight.map(toCore);
export const ACTIVE: ActiveProject[] = products
  .filter((product) => !product.spotlight)
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((product, index) => ({
    name: product.name,
    desc: product.description,
    color: colors[(index + CORE.length) % colors.length],
    href: `/p/${product.id}`,
  }));
export const PERSONAL: ActiveProject[] = [];
export const PROJECT_COUNT = publicCatalog.products.length;
export const PRODUCT_COUNT = PROJECT_COUNT;
export const TICKER = publicCatalog.products.map((product) => product.name);

export const SPEC: Array<[string, string]> = [
  ['Operator', 'Sarthak Agrawal'],
  ['Pillars', 'Build · Market · Learn · Visibility · Control'],
  ['Interfaces', 'Public directory · Private cockpit · Packages · Skills'],
  ['Projects', String(PROJECT_COUNT)],
  ['Source of truth', 'catalog/foundry.json'],
  ['Operations', 'One designated host · inert clones · explicit leases'],
  ['Source', 'github.com/sass-maker/saas-maker'],
];
