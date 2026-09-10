import publicCatalog from '../../../../catalog/generated/public.json';

// Full public projection for independent portfolio and profile consumers.
export function GET() {
  return new Response(JSON.stringify(publicCatalog), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
