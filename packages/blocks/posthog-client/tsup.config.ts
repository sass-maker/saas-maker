import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/provider.tsx', 'src/server.ts', 'src/schema.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'posthog-js', 'posthog-node'],
});
