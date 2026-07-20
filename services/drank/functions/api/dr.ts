// Cloudflare Pages Function — replaces the former Next.js /api/dr route.
//
// Proxies the Ahrefs free public Domain Rating endpoint. Exists to bypass
// browser CORS restrictions and set a friendly User-Agent, exactly as the
// original Next.js API route did. Served at the same path (/api/dr) by
// `wrangler pages deploy`.

interface AhrefsDRResponse {
  domain_rating?: { domain_rating?: number };
}

export async function onRequestGet(context: { request: Request }): Promise<Response> {
  const { request } = context;
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');

  if (!target) {
    return json({ error: 'Missing target parameter' }, 400);
  }

  // Basic normalization
  let normalized = target.trim().toLowerCase();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let hostname: string;
  try {
    hostname = new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return json({ error: 'Invalid target domain' }, 400);
  }

  if (!hostname?.includes('.')) {
    return json({ error: 'Invalid target domain' }, 400);
  }

  const apiUrl = `https://api.ahrefs.com/v3/public/domain-rating-free?target=${encodeURIComponent(hostname)}&output=json`;

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'drank/1.0 (domain rating tracker)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return json({ error: 'Rate limited by Ahrefs. Please wait a bit.' }, 429);
      }
      return json({ error: `Ahrefs API error (${res.status})` }, 502);
    }

    const data = (await res.json()) as AhrefsDRResponse;
    const dr = data?.domain_rating?.domain_rating;

    if (typeof dr !== 'number') {
      return json({ error: 'Unexpected response from Ahrefs' }, 502);
    }

    return json({ domain: hostname, dr, fetchedAt: Date.now() }, 200);
  } catch (err) {
    console.error('DR proxy error:', err);
    return json({ error: 'Failed to fetch from Ahrefs' }, 502);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
