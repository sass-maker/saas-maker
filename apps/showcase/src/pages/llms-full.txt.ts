import publicCatalog from '../../../../catalog/generated/public.json';
export const prerender = true;
export function GET() {
  const products = publicCatalog.products.flatMap((product) => {
    const links = product as typeof product & {
      changelogUrl?: string;
      roadmapUrl?: string;
      repositoryUrl?: string;
    };
    return [
      `## ${product.name}`,
      product.description,
      `Product: ${product.url}`,
      `Pillar: ${product.pillarId}`,
      ...(links.changelogUrl ? [`Changelog: ${links.changelogUrl}`] : []),
      ...(links.roadmapUrl ? [`Roadmap: ${links.roadmapUrl}`] : []),
      ...(links.repositoryUrl ? [`Source: ${links.repositoryUrl}`] : []),
      '',
    ];
  });
  const body = [
    '# SaaS Maker — full product index',
    '',
    'Generated from the checked-in Fleet public projection. Configuration and links do not imply fresh production verification.',
    '',
    ...products,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
