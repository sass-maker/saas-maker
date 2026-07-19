import publicCatalog from '../../../../catalog/generated/public.json';
export const prerender = true;
export function GET() {
  const products = publicCatalog.products.flatMap((product) => [
    `## ${product.name}`,
    '',
    product.description,
    '',
    `- Product: ${product.url}`,
    `- Changelog: ${product.changelogUrl}`,
    `- Roadmap: ${product.roadmapUrl}`,
    `- Source: ${product.repositoryUrl}`,
    '',
  ]);
  const body = ['# SaaS Maker Foundry', '', 'Public directory for the maintained product fleet. Ignored, frozen, retired, and removed products are excluded.', '', ...products].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
