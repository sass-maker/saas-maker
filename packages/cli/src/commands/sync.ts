import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import ora from 'ora';

import { buildLocalTsConfig } from '../lib/forge.js';
import { requestApi } from '../lib/request.js';
import { log } from '../lib/ui.js';

const CACHE_FILE = join(homedir(), '.foundry', 'standards-cache.json');
const TSCONFIG_CACHE_DIR = join(homedir(), '.foundry', 'tsconfig');

export async function syncCommand(): Promise<void> {
  const spinner = ora('Syncing Foundry Standards...').start();

  const types = ['next', 'vite', 'node'] as const;
  const cache: Record<string, { ts: number; data: unknown }> = {};
  const results: { type: string; ok: boolean }[] = [];

  for (const type of types) {
    try {
      const res = await requestApi<{
        type: string;
        eslint_rules: Record<string, string>;
        tsconfig_options: Record<string, boolean | string>;
        prettier_options: Record<string, unknown>;
      }>({ path: `/v1/standards/${type}`, auth: 'session' });

      if (!res.ok || !res.data) {
        results.push({ type, ok: false });
        continue;
      }

      // Write remote standards cache (merged into local configs via fnd fleet fix)
      const cacheKey = `default:${type}`;
      cache[cacheKey] = { ts: Date.now(), data: res.data };

      // Write tsconfig snapshot (tsc can't fetch remote, so we write locally)
      mkdirSync(TSCONFIG_CACHE_DIR, { recursive: true });
      const tsconfigPath = join(TSCONFIG_CACHE_DIR, `${type}.json`);
      writeFileSync(
        tsconfigPath,
        JSON.stringify(buildLocalTsConfig(type, res.data), null, 2) + '\n',
      );

      results.push({ type, ok: true });
    } catch {
      results.push({ type, ok: false });
    }
  }

  // Persist ESLint cache
  mkdirSync(join(homedir(), '.foundry'), { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));

  spinner.stop();

  for (const r of results) {
    if (r.ok) log.success(`Synced ${r.type} standards`);
    else log.warn(`Failed to sync ${r.type} standards`);
  }

  if (results.some((r) => r.ok)) {
    log.info(`Cache written to ~/.foundry/standards-cache.json`);
    log.info(`TSConfig snapshots at ~/.foundry/tsconfig/{next,vite,node}.json`);
  }
}
