import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  globalName: 'sm',
  minify: true,
  outDir: 'dist',
  dts: false,
  clean: true,
});
