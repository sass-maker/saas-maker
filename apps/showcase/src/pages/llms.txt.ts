import publicCatalog from '../../../../catalog/generated/public.json';
export const prerender = true;
export function GET() {
  const products = publicCatalog.products.map(
    (product) => `- [${product.name}](${product.url}): ${product.description}`
  );
  const body = [
    '# SaaS Maker Foundry',
    '',
    "> Public directory and operating layer for Sarthak Agrawal's maintained product fleet.",
    '',
    '## Core surfaces',
    '',
    '- [Directory](https://sassmaker.com)',
    '- [Package docs](https://packages.sassmaker.com)',
    '- [Skills](https://skills.sassmaker.com)',
    '- [Private cockpit](https://fleet.sassmaker.com): authenticated operator surface',
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
