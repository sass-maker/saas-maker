import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.js' };
  },
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  minify: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@saas-maker/capability-graph', '@saas-maker/ui'],
});
