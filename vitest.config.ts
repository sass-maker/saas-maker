import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL('./apps/cockpit/src/', import.meta.url))}`,
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
