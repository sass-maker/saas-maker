import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  external: ['react', 'react-dom', 'ai', '@ai-sdk/openai-compatible'],
});
