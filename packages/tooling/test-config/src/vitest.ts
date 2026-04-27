/**
 * defineVitestConfig — Foundry-standard Vitest config factory.
 *
 * Defaults:
 *  - globals enabled
 *  - environment: 'node' (override to 'happy-dom' / 'jsdom' for UI tests)
 *  - testTimeout 15s
 *  - includes src/**\/__tests__/**\/*.test.ts and src/**\/*.test.ts
 *  - coverage via v8 with sane excludes
 *
 * Pass-through: `VitestOpts` extends Vite's `UserConfig`, so any top-level
 * Vite key (`plugins`, `resolve`, `define`, `server`, etc.) and any
 * `test.*` field is accepted and merged onto the foundry defaults.
 *
 * Example:
 *   defineVitestConfig({
 *     environment: 'happy-dom',
 *     plugins: [react()],
 *     resolve: { alias: { '@': '/src' } },
 *     test: { pool: 'forks', sequence: { shuffle: true } },
 *   });
 */

import { defineConfig as defineVitest, type ViteUserConfig } from 'vitest/config';

type VitestTestOptions = NonNullable<ViteUserConfig['test']>;

/**
 * VitestOpts is a passthrough of Vite's `UserConfig` with three foundry
 * shorthand fields hoisted to the top level (`environment`, `setupFiles`,
 * `coverage`) for ergonomics. Anything else you pass — including a full
 * `test: { ... }` block — is shallow-merged onto the foundry defaults.
 */
export interface VitestOpts extends Omit<ViteUserConfig, 'test'> {
  /** Shorthand: `test.environment`. 'node' (default) | 'happy-dom' | 'jsdom'. */
  environment?: 'node' | 'happy-dom' | 'jsdom';
  /** Shorthand: `test.include` (replaces default). */
  include?: string[];
  /** Shorthand: `test.exclude` (added to defaults). */
  exclude?: string[];
  /** Shorthand: `test.setupFiles`. */
  setupFiles?: string[];
  /** Shorthand: `test.coverage` thresholds (warn-only by default). */
  coverage?: {
    enabled?: boolean;
    lines?: number;
    functions?: number;
    branches?: number;
    statements?: number;
  };
  /** Full Vitest test block — merged on top of foundry defaults. */
  test?: VitestTestOptions;
  /** @deprecated Use top-level keys directly; this passthrough remains for back-compat. */
  extend?: ViteUserConfig;
}

export function defineVitestConfig(opts: VitestOpts = {}): ViteUserConfig {
  const { environment, include, exclude, setupFiles, coverage, test, extend, ...rest } = opts;

  const cfg: ViteUserConfig = defineVitest({
    ...rest,
    test: {
      globals: true,
      environment: environment ?? 'node',
      include: include ?? ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
      exclude: ['node_modules', 'dist', '.next', '.wrangler', ...(exclude ?? [])],
      testTimeout: 15_000,
      setupFiles,
      coverage: {
        enabled: coverage?.enabled ?? false,
        provider: 'v8',
        reporter: ['text-summary', 'json', 'html'],
        exclude: ['node_modules', 'dist', '**/*.d.ts', '**/*.config.*', '**/__tests__/**'],
        thresholds: {
          lines: coverage?.lines,
          functions: coverage?.functions,
          branches: coverage?.branches,
          statements: coverage?.statements,
        },
      },
      ...test,
    },
  });

  return { ...cfg, ...extend };
}
