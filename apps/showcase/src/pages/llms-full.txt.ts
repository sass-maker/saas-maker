import publicCatalog from '../../../../catalog/generated/public.json';
export const prerender = true;
export function GET() {
  const products = publicCatalog.products.flatMap((product) => [
    `## ${product.name}`,
    product.description,
    `Product: ${product.url}`,
    `Pillar: ${product.pillarId}`,
    `Changelog: ${product.changelogUrl}`,
    `Roadmap: ${product.roadmapUrl}`,
    `Source: ${product.repositoryUrl}`,
    '',
  ]);
  const body = [
    '# SaaS Maker Foundry — full agent index',
    '',
    'Generated from catalog/foundry.json. Configuration and links do not imply fresh production verification.',
    '',
    ...products,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
