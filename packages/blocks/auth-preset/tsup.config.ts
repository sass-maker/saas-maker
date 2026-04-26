import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/next.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'better-auth', 'drizzle-orm', 'next'],
});
