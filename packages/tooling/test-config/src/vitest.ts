/**
 * defineVitestConfig — Foundry-standard Vitest config factory.
 *
 * Defaults:
 *  - globals enabled
 *  - environment: 'node' (override to 'happy-dom' / 'jsdom' for UI tests)
 *  - testTimeout 15s
 *  - includes src/**\/__tests__/**\/*.test.ts and src/**\/*.test.ts
 *  - coverage via v8 with sane excludes
 */

import { defineConfig as defineVitest, type ViteUserConfig } from 'vitest/config';

export interface VitestOpts {
  /** 'node' (default) | 'happy-dom' | 'jsdom' */
  environment?: 'node' | 'happy-dom' | 'jsdom';
  /** Glob include patterns (replaces default). */
  include?: string[];
  /** Glob exclude patterns (added to defaults). */
  exclude?: string[];
  /** Setup files run before tests. */
  setupFiles?: string[];
  /** Coverage thresholds (warn-only by default). */
  coverage?: {
    enabled?: boolean;
    lines?: number;
    functions?: number;
    branches?: number;
    statements?: number;
  };
  /** Override or extend the resulting config. */
  extend?: ViteUserConfig;
}

export function defineVitestConfig(opts: VitestOpts = {}): ViteUserConfig {
  const cfg: ViteUserConfig = defineVitest({
    test: {
      globals: true,
      environment: opts.environment ?? 'node',
      include: opts.include ?? ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
      exclude: ['node_modules', 'dist', '.next', '.wrangler', ...(opts.exclude ?? [])],
      testTimeout: 15_000,
      setupFiles: opts.setupFiles,
      coverage: {
        enabled: opts.coverage?.enabled ?? false,
        provider: 'v8',
        reporter: ['text-summary', 'json', 'html'],
        exclude: ['node_modules', 'dist', '**/*.d.ts', '**/*.config.*', '**/__tests__/**'],
        thresholds: {
          lines: opts.coverage?.lines,
          functions: opts.coverage?.functions,
          branches: opts.coverage?.branches,
          statements: opts.coverage?.statements,
        },
      },
    },
  });

  return { ...cfg, ...opts.extend };
}
