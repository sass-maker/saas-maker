import publicCatalog from '../../../../catalog/generated/public.json';

export function GET() {
  return new Response(JSON.stringify(publicCatalog.archivedDirectory), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
