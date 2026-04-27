import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/playwright.ts', 'src/vitest.ts', 'src/a11y.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  external: ['@playwright/test', '@axe-core/playwright', 'vitest'],
});
