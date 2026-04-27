import { describe, it, expect } from 'vitest';
import { defineWrangler, FOUNDRY_COMPATIBILITY_DATE } from '../index.js';
import { baseDefaults, spaAssets } from '../snippets.js';

describe('defineWrangler', () => {
  it('produces minimal config with sane defaults', () => {
    const cfg = defineWrangler({ name: 'my-worker' });
    expect(cfg).toMatchObject({
      name: 'my-worker',
      main: 'src/index.ts',
      compatibility_date: FOUNDRY_COMPATIBILITY_DATE,
      observability: { enabled: true },
    });
  });

  it('wires AI binding', () => {
    const cfg = defineWrangler({ name: 'a', bindings: { ai: true } });
    expect(cfg.ai).toEqual({ binding: 'AI' });
  });

  it('respects custom AI binding name', () => {
    const cfg = defineWrangler({ name: 'a', bindings: { ai: { binding: 'WORKERS_AI' } } });
    expect(cfg.ai).toEqual({ binding: 'WORKERS_AI' });
  });

  it('wires D1 with default migrations_dir', () => {
    const cfg = defineWrangler({
      name: 'a',
      bindings: { d1_databases: [{ binding: 'DB', database_name: 'app', database_id: 'id-1' }] },
    });
    expect(cfg.d1_databases).toEqual([
      { binding: 'DB', database_name: 'app', database_id: 'id-1', migrations_dir: 'migrations' },
    ]);
  });

  it('lets caller override migrations_dir', () => {
    const cfg = defineWrangler({
      name: 'a',
      bindings: {
        d1_databases: [
          { binding: 'DB', database_name: 'app', database_id: 'id-1', migrations_dir: 'db/m' },
        ],
      },
    });
    expect(cfg.d1_databases?.[0].migrations_dir).toBe('db/m');
  });

  it('attaches assets with SPA fallback default', () => {
    const cfg = defineWrangler({
      name: 'pages-app',
      bindings: { assets: { directory: './out' } },
    });
    expect(cfg.assets).toEqual({
      directory: './out',
      not_found_handling: 'single-page-application',
    });
  });

  it('preserves custom routes and vars', () => {
    const cfg = defineWrangler({
      name: 'a',
      vars: { ENV: 'prod' },
      routes: [{ pattern: 'api.example.com/*', zone_name: 'example.com' }],
    });
    expect(cfg.vars).toEqual({ ENV: 'prod' });
    expect(cfg.routes?.[0].pattern).toBe('api.example.com/*');
  });

  it('disables observability when requested', () => {
    const cfg = defineWrangler({ name: 'a', observability: false });
    expect(cfg.observability).toEqual({ enabled: false });
  });

  it('matches snapshot for full config', () => {
    const cfg = defineWrangler({
      name: 'fleet-api',
      main: 'src/worker.ts',
      compatibility_flags: ['nodejs_compat'],
      bindings: {
        ai: true,
        d1_databases: [{ binding: 'DB', database_name: 'app', database_id: 'abc' }],
        r2_buckets: [{ binding: 'BUCKET', bucket_name: 'uploads' }],
      },
      vars: { LOG_LEVEL: 'info' },
    });
    expect(cfg).toMatchSnapshot();
  });
});

describe('snippets', () => {
  it('exports baseDefaults with current compat date', () => {
    expect(baseDefaults.compatibility_date).toBe(FOUNDRY_COMPATIBILITY_DATE);
    expect(baseDefaults.observability.enabled).toBe(true);
  });

  it('exports spaAssets snippet', () => {
    expect(spaAssets.not_found_handling).toBe('single-page-application');
  });
});
