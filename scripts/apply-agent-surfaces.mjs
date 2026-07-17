#!/usr/bin/env node
/**
 * Apply fleet agent-indexing surfaces across registered products.
 *
 * Usage:
 *   node fleet-ops/scripts/apply-agent-surfaces.mjs
 *   node fleet-ops/scripts/apply-agent-surfaces.mjs --id rolepatch
 *   node fleet-ops/scripts/apply-agent-surfaces.mjs --dry-run
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLEET_ROOT = resolve(__dirname, '../..');
const REGISTRY = join(FLEET_ROOT, 'fleet-ops/config/agent-surfaces-registry.json');
const EDGE_TEMPLATE = join(
  FLEET_ROOT,
  'fleet-ops/lib/agent-surfaces/agent-edge.template.mjs'
);
const MARKER = 'handleAgentEdge';
const IMPORT_MARKER = "from './agent-edge.mjs'";

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const template = readFileSync(EDGE_TEMPLATE, 'utf8');

let written = 0;
let patched = 0;
let skipped = 0;

for (const product of registry.products) {
  if (onlyId && product.id !== onlyId) continue;
  const result = applyProduct(product);
  written += result.written;
  patched += result.patched;
  skipped += result.skipped;
  console.log(
    `${result.ok ? '✓' : '·'} ${product.id}: ${result.messages.join('; ')}`
  );
}

console.log(
  `\nDone. files=${written} workers_patched=${patched} skipped=${skipped}${dryRun ? ' (dry-run)' : ''}`
);

function applyProduct(product) {
  const messages = [];
  let writtenLocal = 0;
  let patchedLocal = 0;
  let skippedLocal = 0;
  let ok = true;

  const publicDirs = [product.publicDir, ...(product.altPublicDirs || [])]
    .filter(Boolean)
    .map((p) => join(FLEET_ROOT, p));

  const publicDir = publicDirs.find((d) => existsSync(dirname(d)) || existsSync(d));
  // prefer first listed if none exist — create it
  const targetPublic = publicDirs[0];
  if (!targetPublic) {
    return { ok: false, written: 0, patched: 0, skipped: 1, messages: ['no publicDir'] };
  }

  const surface = buildSurface(product);
  const llmsPath = join(targetPublic, 'llms.txt');
  const indexPath = join(targetPublic, 'index.md');
  const apiAiJsonPath = join(targetPublic, 'api-ai.json');
  const robotsPath = join(targetPublic, 'robots.txt');

  if (!existsSync(targetPublic)) {
    if (!dryRun) mkdirSync(targetPublic, { recursive: true });
    messages.push(`mkdir ${rel(targetPublic)}`);
  }

  if (!product.skipLlmsOverwrite && !product.hasDynamicLlms) {
    write(llmsPath, surface.llmsTxt);
    writtenLocal++;
    messages.push('llms.txt');
  } else {
    skippedLocal++;
    messages.push(product.hasDynamicLlms ? 'llms dynamic (skip file)' : 'llms skip overwrite');
  }

  write(indexPath, surface.indexMd);
  writtenLocal++;
  messages.push('index.md');

  write(apiAiJsonPath, `${JSON.stringify(surface.catalog, null, 2)}\n`);
  writtenLocal++;
  messages.push('api-ai.json');

  // robots: ensure Sitemap + allow agent paths
  ensureRobots(robotsPath, product.url);
  messages.push('robots');

  // agent-edge.mjs next to worker when stack needs runtime
  if (product.worker) {
    const workerPath = join(FLEET_ROOT, product.worker);
    if (!existsSync(workerPath)) {
      messages.push(`worker missing: ${product.worker}`);
      ok = false;
    } else {
      const edgePath = join(dirname(workerPath), 'agent-edge.mjs');
      const edgeBody = template.replace(
        '__AGENT_SURFACE_JSON__',
        JSON.stringify(surface, null, 2)
      );
      write(edgePath, edgeBody);
      writtenLocal++;
      messages.push('agent-edge.mjs');

      const patch = patchWorker(workerPath);
      if (patch === 'patched') {
        patchedLocal++;
        messages.push('worker patched');
      } else if (patch === 'already') {
        messages.push('worker already wired');
      } else {
        messages.push(`worker patch: ${patch}`);
      }
    }
  }

  // wrangler run_worker_first for SPA Hono
  if (product.wrangler || product.stack === 'spa-hono') {
    const wranglers = [
      product.wrangler,
      product.id === 'anime-list' ? 'anime-list/wrangler.toml' : null,
      product.id === 'reader' ? 'reader/wrangler.toml' : null,
      product.id === 'email-manager' ? 'email-manager/wrangler.toml' : null,
      product.id === 'free-ai' ? 'free-ai/wrangler.toml' : null,
    ].filter(Boolean);
    for (const w of wranglers) {
      const p = join(FLEET_ROOT, w);
      if (existsSync(p)) {
        const r = patchWranglerRunWorkerFirst(p);
        messages.push(`wrangler:${r}`);
      }
    }
  }

  // Astro/static: _redirects for /api/ai → api-ai.json when no worker
  if (
    (product.stack === 'astro-static' || product.stack === 'next-static' || product.stack === 'spa-static') &&
    !product.worker
  ) {
    const redirects = join(targetPublic, '_redirects');
    const line = '/api/ai /api-ai.json 200\n';
    let existing = existsSync(redirects) ? readFileSync(redirects, 'utf8') : '';
    if (!existing.includes('/api/ai')) {
      write(redirects, existing + (existing.endsWith('\n') || !existing ? '' : '\n') + line);
      writtenLocal++;
      messages.push('_redirects /api/ai');
    }
  }

  // Never write a tiny public/sitemap.xml stub — it overrides Next.js
  // app/sitemap.ts and Astro @astrojs/sitemap generators. Huge sitemaps
  // must come from dynamic generators or dedicated content scripts.

  return {
    ok,
    written: writtenLocal,
    patched: patchedLocal,
    skipped: skippedLocal,
    messages,
  };

  function write(path, body) {
    if (dryRun) return;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, 'utf8');
  }
}

function buildSurface(product) {
  const origin = product.url.replace(/\/$/, '');
  const productLinks = product.productLinks || [];
  const llmsLines = [
    `# ${product.name}`,
    '',
    `> ${product.summary}`,
    '',
    '## Product',
    '',
    ...productLinks.map(
      (l) =>
        `- [${l.title}](${l.url})${l.description ? `: ${l.description}` : ''}`
    ),
    '',
    '## Machine surfaces',
    '',
    `- [Agent catalog](${origin}/api/ai): JSON inventory of public surfaces`,
    `- [Homepage markdown](${origin}/index.md): Product brief without JS`,
    `- [This index](${origin}/llms.txt)`,
    '',
    '## Optional',
    '',
    '- [Foundry](https://sassmaker.com): Parent fleet showcase',
    '',
  ];

  const catalog = {
    name: product.name,
    version: '1',
    url: origin,
    llms: `${origin}/llms.txt`,
    llmsFull: product.id === 'significanthobbies' ? `${origin}/llms-full.txt` : null,
    sitemap: `${origin}/sitemap.xml`,
    markdown: { suffix: '.md', negotiation: true },
    surfaces: [
      {
        id: 'home',
        url: `${origin}/`,
        md: `${origin}/index.md`,
        kind: product.stack?.startsWith('spa') ? 'spa' : 'static',
        description: 'Product home',
      },
      ...productLinks
        .filter((l) => !l.url.endsWith('/') || l.title !== 'Home')
        .slice(0, 12)
        .map((l) => ({
          id: slugId(l.title),
          url: l.url,
          md: null,
          kind: 'static',
          description: l.description || l.title,
        })),
    ],
    auth: {
      public: true,
      notes: 'Auth-walled app routes are not agent-indexed unless listed here.',
    },
  };

  return {
    name: product.name,
    url: origin,
    llmsTxt: llmsLines.join('\n'),
    indexMd: product.indexMd.endsWith('\n') ? product.indexMd : `${product.indexMd}\n`,
    catalog,
    llmsFull: null,
  };
}

function ensureRobots(robotsPath, siteUrl) {
  const origin = siteUrl.replace(/\/$/, '');
  let body = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : 'User-agent: *\nAllow: /\n';
  if (!/sitemap:/i.test(body)) {
    body = body.trimEnd() + `\n\nSitemap: ${origin}/sitemap.xml\n`;
  }
  if (!body.includes('/llms.txt')) {
    body = body.trimEnd() + `\n# Agent indexing\nAllow: /llms.txt\nAllow: /index.md\nAllow: /api/ai\n`;
  }
  if (!dryRun) {
    mkdirSync(dirname(robotsPath), { recursive: true });
    writeFileSync(robotsPath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  }
}

function patchWorker(workerPath) {
  let src = readFileSync(workerPath, 'utf8');
  if (src.includes(MARKER) || src.includes(IMPORT_MARKER)) return 'already';

  // Only auto-patch known OpenNext / simple fetch wrappers
  if (!src.includes('openNext') && !src.includes('export default')) {
    return 'unknown-shape';
  }

  // Insert import after last import block
  if (!src.includes("from './agent-edge.mjs'") && !src.includes('from "./agent-edge.mjs"')) {
    const importLine = "import { handleAgentEdge } from './agent-edge.mjs';\n";
    const lastImport = [...src.matchAll(/^import .+$/gm)].pop();
    if (lastImport) {
      const idx = lastImport.index + lastImport[0].length;
      src = src.slice(0, idx) + '\n' + importLine + src.slice(idx);
    } else {
      src = importLine + src;
    }
  }

  // Inject call at start of fetch handlers — several patterns
  const inject = `
    // Agent / LLM indexing surfaces (fleet GEO standard)
    {
      const agent = handleAgentEdge(request);
      if (agent) return agent;
    }
`;

  if (src.includes('async function fetch(request, env, ctx)')) {
    src = src.replace(
      /async function fetch\(request, env, ctx\) \{\s*\n/,
      (m) => m + inject
    );
  } else if (src.includes('async fetch(request, env, ctx)')) {
    src = src.replace(
      /async fetch\(request, env, ctx\) \{\s*\n/,
      (m) => m + inject
    );
  } else if (src.includes('fetch(request, env, ctx) {')) {
    src = src.replace(
      /fetch\(request, env, ctx\) \{\s*\n/,
      (m) => m + inject
    );
  } else {
    return 'no-fetch-hook';
  }

  if (!dryRun) writeFileSync(workerPath, src, 'utf8');
  return 'patched';
}

function patchWranglerRunWorkerFirst(wranglerPath) {
  let src = readFileSync(wranglerPath, 'utf8');
  const paths = [
    '/api/*',
    '/llms.txt',
    '/llms-full.txt',
    '/index.md',
    '/sitemap.xml',
  ];
  if (src.includes('run_worker_first')) {
    // ensure agent paths listed
    let changed = false;
    for (const p of paths) {
      if (!src.includes(`"${p}"`) && !src.includes(`'${p}'`)) {
        // try to inject into array
        src = src.replace(
          /run_worker_first\s*=\s*\[/,
          (m) => `${m}\n  "${p}",`
        );
        // toml style might use different format - skip if not
        changed = true;
      }
    }
    if (changed && !dryRun) writeFileSync(wranglerPath, src, 'utf8');
    return changed ? 'updated' : 'ok';
  }
  // JSONC assets block
  if (src.includes('"assets"') && src.includes('not_found_handling')) {
    src = src.replace(
      /"not_found_handling"\s*:\s*"[^"]+"/,
      (m) =>
        `${m},\n    "run_worker_first": ${JSON.stringify(paths)}`
    );
    if (!dryRun) writeFileSync(wranglerPath, src, 'utf8');
    return 'added';
  }
  return 'skip';
}

function slugId(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'page';
}

function rel(p) {
  return p.replace(FLEET_ROOT + '/', '');
}
