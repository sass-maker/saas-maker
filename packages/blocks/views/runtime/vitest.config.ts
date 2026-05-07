import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@saas-maker/capability-graph': fileURLToPath(
        new URL('../capability-graph/src/index.ts', import.meta.url),
      ),
      '@saas-maker/ui': fileURLToPath(new URL('../../../ui/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
