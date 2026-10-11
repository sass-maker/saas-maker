import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // Frontend tests use the cockpit's declared dependencies rather than root hoisting.
      {
        find: /^@saas-maker\/ui\/(components|blocks)\/(.*)$/,
        replacement: `${fileURLToPath(new URL('./apps/cockpit/node_modules/@saas-maker/ui/src/', import.meta.url))}$1/$2.tsx`,
      },
      {
        find: /^@saas-maker\/ui\/lib\/(.*)$/,
        replacement: `${fileURLToPath(new URL('./apps/cockpit/node_modules/@saas-maker/ui/src/lib/', import.meta.url))}$1.ts`,
      },
      {
        find: 'react-dom',
        replacement: fileURLToPath(
          new URL('./apps/cockpit/node_modules/react-dom', import.meta.url)
        ),
      },
      {
        find: 'react',
        replacement: fileURLToPath(new URL('./apps/cockpit/node_modules/react', import.meta.url)),
      },
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
