#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const indexFile = join(repoRoot, 'workers/api/src/index.ts');
const routesDir = join(repoRoot, 'workers/api/src/routes');
const cliSpecOut = join(repoRoot, 'packages/cli/src/openapi.json');
const docsSpecOut = join(repoRoot, 'docs/openapi/openapi.json');
const docsPublicSpecOut = join(repoRoot, 'apps/docs/public/openapi.json');

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete'];

function toOpenApiPath(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function normalizePath(path) {
  const compact = path.replace(/\/+/g, '/');
  if (compact === '/') return compact;
  return compact.endsWith('/') ? compact.slice(0, -1) : compact;
}

function parseRoutePrefixMap(indexSource) {
  const map = new Map();
  const routeRegex = /app\.route\('([^']+)',\s*([A-Za-z0-9_]+)\);/g;
  let match;
  while ((match = routeRegex.exec(indexSource)) !== null) {
    const prefix = normalizePath(match[1]);
    const varName = match[2];
    map.set(varName, prefix);
  }
  return map;
}

function addOperation(paths, fullPath, method) {
  if (!paths[fullPath]) paths[fullPath] = {};
  const tag = fullPath.startsWith('/v1/') ? fullPath.split('/')[2] : 'system';
  paths[fullPath][method] = {
    tags: [tag || 'system'],
    summary: `${method.toUpperCase()} ${fullPath}`,
    responses: {
      200: { description: 'Success' },
    },
  };
}

function collectAppLevelRoutes(indexSource, paths) {
  const appRegex = /app\.(get|post|put|patch|delete)\('([^']+)'/g;
  let match;
  while ((match = appRegex.exec(indexSource)) !== null) {
    const method = match[1].toLowerCase();
    const rawPath = normalizePath(toOpenApiPath(match[2]));
    addOperation(paths, rawPath, method);
  }
}

function collectRouteFileOperations(source, routerVarName) {
  const regex = new RegExp(`\\b${routerVarName}\\.(get|post|put|patch|delete)\\('([^']+)'`, 'g');
  const ops = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    ops.push({ method: match[1].toLowerCase(), path: match[2] });
  }
  return ops;
}

function buildPaths(indexSource) {
  const paths = {};
  const routePrefixMap = parseRoutePrefixMap(indexSource);

  collectAppLevelRoutes(indexSource, paths);

  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.ts'));
  for (const file of routeFiles) {
    const full = join(routesDir, file);
    const source = readFileSync(full, 'utf-8');

    const routerMatch = source.match(/const\s+([A-Za-z0-9_]+)\s*=\s*new Hono/);
    if (!routerMatch) continue;
    const routerVar = routerMatch[1];
    const prefix = routePrefixMap.get(routerVar);
    if (!prefix) continue;

    const ops = collectRouteFileOperations(source, routerVar);
    for (const op of ops) {
      const suffix = op.path === '/' ? '' : op.path;
      const rawPath = normalizePath(`${prefix}${suffix}`);
      const openApiPath = toOpenApiPath(rawPath);
      addOperation(paths, openApiPath, op.method);
    }
  }

  const sorted = {};
  for (const pathKey of Object.keys(paths).sort()) {
    const methodEntries = Object.entries(paths[pathKey]).sort(
      (a, b) => METHOD_ORDER.indexOf(a[0]) - METHOD_ORDER.indexOf(b[0])
    );
    sorted[pathKey] = Object.fromEntries(methodEntries);
  }
  return sorted;
}

function main() {
  const indexSource = readFileSync(indexFile, 'utf-8');
  const paths = buildPaths(indexSource);

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'SaaS Maker API',
      version: '0.1.0',
      description: 'Generated route-level OpenAPI spec for CLI/docs enforcement.',
      'x-generator': 'scripts/generate-openapi.mjs',
    },
    servers: [
      { url: 'https://api.sassmaker.com' },
    ],
    paths,
  };

  mkdirSync(dirname(cliSpecOut), { recursive: true });
  mkdirSync(dirname(docsSpecOut), { recursive: true });
  mkdirSync(dirname(docsPublicSpecOut), { recursive: true });
  const json = `${JSON.stringify(spec, null, 2)}\n`;
  writeFileSync(cliSpecOut, json);
  writeFileSync(docsSpecOut, json);
  writeFileSync(docsPublicSpecOut, json);

  const routeCount = Object.keys(paths).length;
  console.log(`Generated OpenAPI spec with ${routeCount} paths.`);
  console.log(`- ${cliSpecOut}`);
  console.log(`- ${docsSpecOut}`);
  console.log(`- ${docsPublicSpecOut}`);
}

main();
