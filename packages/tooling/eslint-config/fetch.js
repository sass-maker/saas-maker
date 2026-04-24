import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const CACHE_FILE = join(homedir(), '.foundry', 'standards-cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const API_BASE = 'https://saasmaker-api.sarthakagrawal927.workers.dev';

function findFoundryJson(dir = process.cwd()) {
  let current = dir;
  for (let i = 0; i < 5; i++) {
    const candidate = join(current, 'foundry.json');
    if (existsSync(candidate)) {
      try { return JSON.parse(readFileSync(candidate, 'utf-8')); } catch {}
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function readCache() {
  try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch { return {}; }
}

function writeCache(data) {
  try {
    mkdirSync(join(homedir(), '.foundry'), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

export async function fetchStandards(type) {
  const foundry = findFoundryJson();
  const projectKey = foundry?.projectKey;

  // Try cache first
  const cache = readCache();
  const cacheKey = `${projectKey ?? 'default'}:${type}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch from API (fail silently — don't break linting if API is down)
  try {
    const headers = projectKey ? { 'X-Project-Key': projectKey } : {};
    const res = await fetch(`${API_BASE}/v1/standards/${type}`, { headers, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    cache[cacheKey] = { ts: Date.now(), data };
    writeCache(cache);
    return data;
  } catch {
    return null; // API down → use defaults, never break lint
  }
}
