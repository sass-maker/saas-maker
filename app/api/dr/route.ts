import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('target');

  if (!target) {
    return Response.json({ error: 'Missing target parameter' }, { status: 400 });
  }

  // Basic normalization on server too
  let normalized = target.trim().toLowerCase();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let hostname: string;
  try {
    hostname = new URL(normalized).hostname.replace(/^www\./, '');
  } catch {
    return Response.json({ error: 'Invalid target domain' }, { status: 400 });
  }

  if (!hostname || !hostname.includes('.')) {
    return Response.json({ error: 'Invalid target domain' }, { status: 400 });
  }

  const apiUrl = `https://api.ahrefs.com/v3/public/domain-rating-free?target=${encodeURIComponent(hostname)}&output=json`;

  try {
    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'drank/1.0 (domain rating tracker)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return Response.json({ error: 'Rate limited by Ahrefs. Please wait a bit.' }, { status: 429 });
      }
      return Response.json({ error: `Ahrefs API error (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const dr = data?.domain_rating?.domain_rating;

    if (typeof dr !== 'number') {
      return Response.json({ error: 'Unexpected response from Ahrefs' }, { status: 502 });
    }

    return Response.json({
      domain: hostname,
      dr, // preserve full precision (Ahrefs returns floats like 94.2)
      fetchedAt: Date.now(),
    });
  } catch (err) {
    console.error('DR proxy error:', err);
    return Response.json({ error: 'Failed to fetch from Ahrefs' }, { status: 502 });
  }
}
