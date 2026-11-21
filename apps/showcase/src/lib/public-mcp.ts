const gatewayUrl = 'https://fleet-chatgpt-connections.sarthakagrawal927.workers.dev/saas-maker/mcp';
const requestHeaders = ['accept', 'content-type', 'mcp-protocol-version', 'origin'];
const responseHeaders = [
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'access-control-max-age',
  'allow',
  'content-type',
  'mcp-protocol-version',
  'retry-after',
  'vary',
];

function selectHeaders(source: Headers, names: string[]) {
  const headers = new Headers();
  for (const name of names) {
    const value = source.get(name);
    if (value !== null) headers.set(name, value);
  }
  return headers;
}

export async function servePublicMcp(request: Request): Promise<Response> {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (request.method !== 'POST' && request.method !== 'OPTIONS') {
    return new Response(null, { status: 405, headers: { ...headers, allow: 'POST, OPTIONS' } });
  }
  if (request.headers.has('authorization')) {
    return Response.json(
      { error: 'This endpoint accepts anonymous requests only.' },
      {
        status: 400,
        headers,
      }
    );
  }

  try {
    // The shared gateway validates MCP messages and enforces its request and response size limits.
    const response = await fetch(gatewayUrl, {
      method: request.method,
      headers: selectHeaders(request.headers, requestHeaders),
      body: request.method === 'POST' ? request.body : null,
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
    });
    if (response.status >= 300 && response.status < 400) throw new Error('Unexpected MCP redirect');
    const outgoing = selectHeaders(response.headers, responseHeaders);
    for (const [name, value] of Object.entries(headers)) outgoing.set(name, value);
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json(
      { error: 'The SaaS Maker MCP service is temporarily unavailable.' },
      {
        status: 502,
        headers,
      }
    );
  }
}
