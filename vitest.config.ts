import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    testTimeout: 15000,
  },
coverage: {
    provider: 'v8',
    reporter: ['json', 'text-summary'],
    exclude: ['node_modules', 'dist', '.next', 'coverage', '**/*.d.ts', '**/*.config.*', '**/test/**'],
  },,
});
