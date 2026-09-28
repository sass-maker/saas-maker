import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL('./apps/cockpit/src/', import.meta.url))}`,
      },
      {
        find: /^cloudflare:workers$/,
        replacement: fileURLToPath(
          new URL('./tests/helpers/cloudflare-workers.ts', import.meta.url)
        ),
      },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts', 'test/**/*.test.{js,ts,tsx}', 'apps/cockpit/src/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['json', 'text-summary'],
      exclude: [
        'node_modules',
        'dist',
        '.next',
        'coverage',
        '**/*.d.ts',
        '**/*.config.*',
        '**/test/**',
      ],
    },
  },
});
