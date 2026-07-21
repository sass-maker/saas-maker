import publicCatalog from '../../../../catalog/generated/public.json';
import { PACKAGE_DOCS_URL } from '../data/links';
export const prerender = true;
export function GET() {
  const products = publicCatalog.products.map(
    (product) => `- [${product.name}](${product.url}): ${product.description}`
  );
  const body = [
    '# SaaS Maker',
    '',
    "> Public directory for Sarthak Agrawal's maintained products and home of the @saas-maker/feedback package.",
    '',
    '## Core surfaces',
    '',
    '- [Directory](https://sassmaker.com)',
    `- [Package docs](${PACKAGE_DOCS_URL})`,
    '- [Feedback inbox](https://app.sassmaker.com): authenticated owner surface',
    '',
    '## Maintained products',
    '',
    ...products,
    '',
    '## Machine surfaces',
    '',
    '- https://sassmaker.com/api/ai',
    '- https://sassmaker.com/index.md',
    '- https://sassmaker.com/llms-full.txt',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
