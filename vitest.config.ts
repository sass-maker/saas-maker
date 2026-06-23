import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['json', 'text-summary'],
      include: ['workers/api/src/**/*.ts', 'packages/blocks/src/**/*.ts'],
      exclude: ['node_modules', 'dist', '.next', 'coverage', '**/*.d.ts', '**/*.config.*', '**/test/**', '**/*.test.ts', '**/index.ts', '.wrangler'],
      // Ratchet strategy: thresholds are set at the current coverage floor so
      // any drop fails CI while incremental improvement is captured by raising
      // these values over time. Baseline measured on 351 tests:
      //   lines 39.4%, functions 30.3%, branches 29.3%, statements 36.2%.
      // Raise these values as coverage grows; target is 80%+ across all metrics.
      // See docs/test-coverage.md for the full ratchet policy and per-package targets.
      thresholds: { lines: 39, functions: 30, branches: 29, statements: 36 },
    },
  },
});
