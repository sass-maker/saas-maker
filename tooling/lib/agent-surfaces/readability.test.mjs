import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgentSurfaceManifest, createAgentSurfaceHandler, wantsMarkdown } from './index.mjs';
import { buildFullMarkdown } from './documents.mjs';

const manifest = createAgentSurfaceManifest({
  name: 'Public demo', url: 'https://demo.example', summary: 'A public demo.', trainingAllowed: true,
  pages: { '/': '# Home\n\nPublic content.', '/pricing': '# Pricing\n\nFree.' },
});
const handler = createAgentSurfaceHandler({ manifest });
const req = (path, init) => new Request(`https://demo.example${path}`, init);

test('HTML discovery preserves wildcard and case-insensitive Accept variation', async () => {
  const { advertiseMarkdown } = await import('./adapters/static-assets.mjs');
  for (const [input, expected] of [['*', '*'], ['accept', 'accept'], ['Accept-Encoding', 'Accept-Encoding, Accept']]) {
    const response = advertiseMarkdown(new Response('HTML', { headers: { Vary: input } }), 'https://demo.example', '/index.md');
    assert.equal(response.headers.get('vary'), expected);
    assert.match(response.headers.get('link'), /llms-full.txt/);
  }
});

for (const [accept, expected] of [
  ['', false], ['*/*', false], ['text/*', false], ['text/markdown', true],
  ['text/markdown;q=0', false], ['text/markdown;q=0, text/html;q=1', false],
  ['text/html;q=0.1, text/markdown;q=1', true], ['text/markdown, text/html', false],
  ['text/markdown;q=0.5, */*;q=1', false], ['text/markdown, */*;q=0.2', true],
  ['text/markdown;q=1, text/html;q=0, */*;q=1', true],
  ['text/markdown;q=oops', false], ['text/markdown;q=2', false],
  ['text/markdown;q=-1', false], ['text/markdown;q=0.5000', false],
  ['text/markdown;q=1;q=0', false], ['text/markdown;q=0, text/markdown;q=1', false],
  ['text/markdownish', false], ['Text/Markdown; charset=utf-8; Q=0.9, text/html;q=0.8', true],
]) test(`Accept ${JSON.stringify(accept)}`, () => assert.equal(wantsMarkdown(req('/', { headers: { accept } })), expected));

for (const path of ['/pricing.md', '/api/md/pricing', '/pricing']) test(`same Markdown content: ${path}`, async () => {
  const res = await handler(req(path, { headers: { Accept: 'text/markdown' } }));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), manifest.pages['/pricing']);
  assert.equal(res.headers.get('content-type'), 'text/markdown; charset=utf-8');
  assert.equal(res.headers.get('content-location'), 'https://demo.example/pricing');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, follow');
  assert.equal(res.headers.get('x-markdown-tokens'), String(Math.ceil(manifest.pages['/pricing'].length / 4)));
  assert.match(res.headers.get('link'), /rel="canonical"/);
  assert.match(res.headers.get('link'), /ai.txt.*rel="describedby"/);
});

for (const path of ['/index.md', '/api/md/', '/llms.txt', '/llms-full.txt', '/ai.txt', '/api/ai', '/api/md/_catalog', '/missing.md']) {
  test(`HEAD parity: ${path}`, async () => {
    const get = await handler(req(path));
    const head = await handler(req(path, { method: 'HEAD' }));
    assert.equal(head.status, get.status);
    assert.deepEqual([...head.headers], [...get.headers]);
    assert.equal(await head.text(), '');
  });
}

test('discovery uses the same complete registry', async () => {
  const catalog = await (await handler(req('/api/md/_catalog'))).json();
  assert.deepEqual(catalog.map((r) => r.path), ['/', '/pricing']);
  const index = await (await handler(req('/llms.txt'))).text();
  const full = await (await handler(req('/llms-full.txt'))).text();
  for (const route of catalog) {
    assert.ok(index.includes(route.md));
    assert.ok(full.includes(manifest.pages[route.path]));
    assert.ok(full.includes(`<!-- source: ${route.url} -->`));
  }
  assert.match(await (await handler(req('/ai.txt'))).text(), /training: allowed on public pages only/);
});

test('unknown Markdown is a noncacheable 404; real Markdown and non-page endpoints fall through', async () => {
  for (const path of ['/missing.md', '/dashboard.md', '/api/md/admin', '/api/md/_unknown']) {
    const res = await handler(req(path));
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type'), /text\/markdown/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  }
  for (const path of ['/auth.md', '/SKILL.md', '/robots.txt', '/sitemap.xml', '/api/private', '/.well-known/mcp.json', '/dashboard']) {
    assert.equal(await handler(req(path, { headers: { Accept: 'text/markdown' } })), null);
  }
  for (const accept of ['', '*/*', 'text/html', 'text/markdown;q=0.5, text/html']) {
    assert.equal(await handler(req('/pricing', { headers: { Accept: accept } })), null);
  }
});

test('OPTIONS is scoped, bodyless and allows public reads only', async () => {
  const res = await handler(req('/pricing.md', { method: 'OPTIONS' }));
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
  assert.equal(await handler(req('/private', { method: 'OPTIONS' })), null);
  assert.equal(await handler(req('/pricing.md', { method: 'POST' })), null);
});

test('dynamic loader is allowlisted and never receives user headers or query data', async () => {
  const calls = [];
  const dynamic = createAgentSurfaceHandler({ manifest,
    listMarkdownRoutes: () => [{ path: '/posts/published', title: 'Published', description: 'A published article.' }],
    loadMarkdown: (path, request) => { calls.push(path); assert.equal(request.headers.get('cookie'), null); assert.equal(request.headers.get('authorization'), null); assert.equal(new URL(request.url).search, ''); return '# Published'; },
  });
  const headers = { Cookie: 'session=private', Authorization: 'Bearer private' };
  assert.equal(await (await dynamic(req('/posts/published.md?secret=private', { headers }))).text(), '# Published');
  assert.equal((await dynamic(req('/posts/draft.md', { headers }))).status, 404);
  assert.deepEqual(calls, ['/posts/published']);
});

test('missing dynamic entities return 404', async () => {
  const dynamic = createAgentSurfaceHandler({ manifest, listMarkdownRoutes: () => [{ path: '/missing', title: 'Missing' }], loadMarkdown: () => null });
  assert.equal((await dynamic(req('/missing.md'))).status, 404);
});

test('malformed and private route registrations fail closed', async () => {
  for (const path of ['/admin/secret', '/api/data', '//external.example/', '/x/../secret', '/x?secret=1', '/x\\secret']) {
    const unsafe = createAgentSurfaceHandler({ manifest, listMarkdownRoutes: () => [{ path }] });
    await assert.rejects(unsafe(req('/api/md/_catalog')), /Invalid public Markdown route/);
  }
});

test('full export stops before its size budget and reports limits', async () => {
  const routes = Array.from({ length: 100 }, (_, i) => ({ path: `/post/${i}`, url: `https://demo.example/post/${i}` }));
  let count = 0;
  const body = await buildFullMarkdown(manifest, routes, () => { count++; return '# Post\n' + 'x'.repeat(1000); }, { maxChars: 3000, maxPages: 50 });
  assert.ok(body.length < 3000);
  assert.ok(count < 5);
  assert.match(body, /Included 2 of 100/);
});

test('static adapter uses only cataloged assets, preserves legacy aliases and rejects HTML fallbacks', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  const seen = [];
  let fallback = false;
  const assets = { async fetch(request) {
    assert.equal(request.headers.get('authorization'), null);
    assert.equal(request.headers.get('cookie'), null);
    const path = new URL(request.url).pathname;
    seen.push(path);
    if (path === '/api/md/_identity') return new Response(JSON.stringify({ name: 'Demo', url: 'https://demo.example', summary: 'Public description.' }), { headers: { 'Content-Type': 'application/octet-stream' } });
    if (path === '/api/md/_catalog') return new Response(JSON.stringify([{ path: '/privacy/', title: 'Privacy', description: 'Privacy policy', assetPath: '/privacy/index.md', aliases: ['/privacy/index.md'] }]), { headers: { 'Content-Type': 'application/octet-stream' } });
    assert.equal(path, '/privacy/index.md');
    return fallback ? new Response('<html>shell</html>', { headers: { 'Content-Type': 'text/html' } }) : new Response('# Privacy', { headers: { 'Content-Type': 'text/markdown' } });
  } };
  const handle = createStaticAssetHandler({});
  for (const path of ['/privacy.md', '/privacy/index.md', '/api/md/privacy', '/privacy/']) {
    const response = await handle(req(path, { headers: { Accept: 'text/markdown', Cookie: 'private=1', Authorization: 'Bearer private' } }), assets);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-location'), 'https://demo.example/privacy/');
    assert.equal(await response.text(), '# Privacy');
    if (path === '/privacy/') assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  }
  const count = seen.length;
  const privateResponse = await handle(req('/api/md/dashboard'), assets);
  assert.equal(privateResponse.status, 404);
  assert.equal(seen.length, count, 'Private path must never reach the asset loader');
  fallback = true;
  const unavailable = await handle(req('/privacy.md'), assets);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await unavailable.text(), /shell/);
});

test('static adapter leaves assets, private routes and real Markdown untouched before discovery', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  const handle = createStaticAssetHandler({ preserveMarkdownPaths: ['/pricing.md'] });
  const assets = { fetch() { throw new Error('Excluded requests must not load metadata'); } };
  for (const path of ['/robots.txt', '/sitemap.xml', '/_astro/site.css', '/image.png', '/api/session', '/dashboard', '/auth/login', '/.well-known/agent-skills/SKILL.md', '/agents.md', '/pricing.md']) {
    assert.equal(await handle(new Request(`https://example.com${path}`, { headers: { Accept: 'text/markdown' } }), assets), null, path);
  }
});

test('registry preserves trailing-slash canonicals and renders their bodies', async () => {
  const manifest = createAgentSurfaceManifest({ name: 'Example', url: 'https://example.com', summary: 'Example', pages: { '/about/': '# About\n' } });
  const handle = createAgentSurfaceHandler({ manifest });
  for (const path of ['/about.md', '/api/md/about', '/about/']) {
    const response = await handle(new Request(`https://example.com${path}`, { headers: { Accept: 'text/markdown' } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Location'), 'https://example.com/about/');
    assert.equal(await response.text(), '# About\n');
  }
});

test('source-reviewed public docs exception is exact and cannot allow APIs', async () => {
  const manifest = createAgentSurfaceManifest({ name: 'Docs', url: 'https://example.com', summary: 'Docs', pages: { '/dashboard': '# Dashboard documentation' } });
  const handle = createAgentSurfaceHandler({ manifest, publicReservedPaths: ['/dashboard'] });
  const response = await handle(new Request('https://example.com/dashboard', { headers: { Accept: 'text/markdown' } }));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '# Dashboard documentation');
  assert.equal((await handle(new Request('https://example.com/api/md/dashboard/account'))).status, 404);
  assert.throws(() => createAgentSurfaceHandler({ manifest, publicReservedPaths: ['/api/private'] }), /Invalid public route exception/);
  assert.throws(() => createAgentSurfaceHandler({ manifest, publicReservedPaths: ['/dashboard/*'] }), /Invalid public route exception/);
});

test('only configured public OpenAPI contracts are advertised', async () => {
  for (const openapi of [undefined, 'https://example.com/openapi.json']) {
    const manifest = createAgentSurfaceManifest({ name: 'Example', url: 'https://example.com', summary: 'Example', openapi, pages: { '/': '# Home' } });
    const handle = createAgentSurfaceHandler({ manifest });
    const response = await handle(new Request('https://example.com/llms.txt'));
    assert.equal((await response.text()).includes('[OpenAPI]'), Boolean(openapi));
  }
});

test('Workers extensionless JSON without MIME is parsed and validated, never accepted as HTML', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  for (const type of [null, 'text/plain; charset=utf-8', 'text/html']) {
    const assets = { async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/index.md') return new Response('# Home', { headers: { 'Content-Type': 'text/markdown' } });
      const value = path === '/api/md/_identity' ? { name: 'Example', url: 'https://example.com', summary: 'Example' } : [{ path: '/', title: 'Home' }];
      const response = new Response(JSON.stringify(value));
      if (type) response.headers.set('Content-Type', type); else response.headers.delete('Content-Type');
      return response;
    } };
    const response = await createStaticAssetHandler({})(new Request('https://example.com/index.md'), assets);
    assert.equal(response.status, type === 'text/html' ? 503 : 200);
  }
});

test('public domain-name slugs still negotiate Markdown', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  const handle = createStaticAssetHandler({ identity: { name: 'Example', url: 'https://example.com', summary: 'Example' } });
  const assets = { async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/api/md/_catalog') return Response.json([{ path: '/launchdesk/example.io', title: 'Example' }]);
    assert.equal(path, '/launchdesk/example.io.md');
    return new Response('# Example domain', { headers: { 'Content-Type': 'text/markdown' } });
  } };
  const response = await handle(new Request('https://example.com/launchdesk/example.io', { headers: { Accept: 'text/markdown' } }), assets);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '# Example domain');
});

test('registered public runtime loader receives no caller state and cannot bypass registry', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  const calls = [];
  const handle = createStaticAssetHandler({ identity: { name: 'Example', url: 'https://example.com', summary: 'Example' }, loadMarkdown(path, request) {
    calls.push(path);
    assert.equal(request.url, 'https://example.com/status');
    assert.equal(request.headers.has('Cookie'), false);
    assert.equal(request.headers.has('Authorization'), false);
    return '# Public status';
  } });
  const assets = { async fetch(request) {
    assert.equal(new URL(request.url).pathname, '/api/md/_catalog');
    return Response.json([{ path: '/status', title: 'Status' }]);
  } };
  const response = await handle(new Request('https://example.com/status.md?token=private', { headers: { Cookie: 'private', Authorization: 'private' } }), assets);
  assert.equal(await response.text(), '# Public status');
  assert.equal((await handle(new Request('https://example.com/api/md/private'), assets)).status, 404);
  assert.deepEqual(calls, ['/status']);
});

test('prebuilt full export avoids collection asset fanout and preserves transport headers', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  const calls = [];
  const body = '# Example - full content\n\nGenerated: 2026-10-26\n\n<!-- source: https://example.com/ -->\n# Home\n';
  const assets = { async fetch(request) {
    calls.push(new URL(request.url).pathname);
    assert.equal(request.headers.has('cookie'), false);
    assert.equal(request.headers.has('authorization'), false);
    assert.equal(new URL(request.url).search, '');
    if (calls.at(-1) === '/api/md/_catalog') return Response.json(Array.from({ length: 300 }, (_, index) => ({ path: `/page-${index}`, title: `Page ${index}` })));
    assert.equal(calls.at(-1), '/llms-full.txt');
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } };
  const handle = createStaticAssetHandler({ identity: { name: 'Example', url: 'https://example.com', summary: 'Example' }, prebuiltFullPath: '/llms-full.txt' });
  const response = await handle(new Request('https://example.com/llms-full.txt?private=1', { headers: { Cookie: 'private', Authorization: 'private' } }), assets);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), body);
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'public, s-maxage=86400, stale-while-revalidate=604800');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('link'), /ai\.txt/);
  const head = await handle(new Request('https://example.com/llms-full.txt', { method: 'HEAD' }), assets);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('cache-control'), response.headers.get('cache-control'));
  assert.deepEqual(calls, ['/api/md/_catalog', '/llms-full.txt']);
});

test('prebuilt export fails closed for missing, HTML, invalid MIME, oversize and invalid UTF-8 assets', async () => {
  const { createStaticAssetHandler } = await import('./adapters/static-assets.mjs');
  for (const [body, status, type] of [
    ['missing', 404, 'text/plain'], ['<html>fallback</html>', 200, 'text/html'],
    ['<html>fallback</html>', 200, 'text/plain'], ['# Fake', 200, 'application/json'],
    ['# ' + 'x'.repeat(500000), 200, 'text/markdown'], [new Uint8Array([35,32,255]), 200, 'text/plain'],
  ]) {
    const handle = createStaticAssetHandler({ identity: { name: 'Example', url: 'https://example.com', summary: 'Example' }, prebuiltFullPath: '/llms-full.txt' });
    const assets = { async fetch(request) {
      if (new URL(request.url).pathname === '/api/md/_catalog') return Response.json([{ path: '/', title: 'Home' }]);
      return new Response(body, { status, headers: { 'Content-Type': type } });
    } };
    const response = await handle(new Request('https://example.com/llms-full.txt'), assets);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('cloudflare-cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  }
  assert.throws(() => createStaticAssetHandler({ prebuiltFullPath: '//other.example/full.txt' }), /Invalid prebuilt/);
});


test('curated discovery sections survive automatic page indexing', async () => {
  const curated = createAgentSurfaceManifest({ name: 'Curated', url: 'https://curated.example', summary: 'Public source.', pages: { '/': '# Home' }, docs: [{ title: 'Privacy boundary', url: 'https://curated.example/agents.md' }], product: [{ title: 'Product home', url: 'https://product.example' }] });
  const response = await createAgentSurfaceHandler({ manifest: curated })(new Request('https://curated.example/llms.txt'));
  const body = await response.text();
  assert.match(body, /\[Privacy boundary\]\(https:\/\/curated.example\/agents.md\)/);
  assert.match(body, /\[Product home\]\(https:\/\/product.example\)/);
  assert.match(body, /\[Home\]\(https:\/\/curated.example\/index.md\)/);
});

test('static emitter completes machine documents without replacing the host sitemap', async () => {
  const { emitAgentSurfaces } = await import('./adapters/astro-build.mjs');
  const { buildStaticFullMarkdown, listMarkdownRoutes } = await import('./documents.mjs');
  // The HTML host owns its canonical sitemap; this adapter adds machine documents.
  const files = new Map([['/output/sitemap.xml', '<host-owned-sitemap/>']]);
  const staticManifest = createAgentSurfaceManifest({ name: 'Static', url: 'https://static.example', summary: 'Public pages.', pages: { '/': '# Home\n\nHello.', '/about': '# About\n\nSource.' } });
  const emitted = emitAgentSurfaces(staticManifest, '/output', { mkdirSync() {}, writeFileSync(path, body) { files.set(path, body); } });
  assert.equal(emitted.llms, '/output/llms.txt');
  assert.equal(files.get('/output/sitemap.xml'), '<host-owned-sitemap/>');
  for (const link of files.get('/output/llms.txt').matchAll(/\]\((https:\/\/static\.example[^)]*)\)/g)) {
    assert.ok(files.has('/output' + new URL(link[1]).pathname), `Unemitted discovery link: ${link[1]}`);
  }
  const routes = listMarkdownRoutes(staticManifest);
  const runtimeFull = await buildFullMarkdown(staticManifest, routes, (path) => staticManifest.pages[path]);
  assert.equal(files.get('/output/llms-full.txt'), runtimeFull);
  assert.equal(buildStaticFullMarkdown(staticManifest, routes, { maxPages: 1 }), await buildFullMarkdown(staticManifest, routes, (path) => staticManifest.pages[path], { maxPages: 1 }));
  assert.equal(JSON.parse(files.get('/output/api/md/_catalog')).length, 2);
  assert.match(files.get('/output/ai.txt'), /public-machine-endpoints: \/api\/ai, \/api\/md\/\*/);
});

for (const path of ['/api/md//evil.example/x', '//evil.example/x.md']) test(`unknown canonical stays public: ${path}`, async () => {
  const response = await handler(req(path));
  assert.equal(response.status, 404);
  assert.equal(new URL(response.headers.get('Content-Location')).origin, manifest.origin);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.match(response.headers.get('Link'), /describedby/);
});
