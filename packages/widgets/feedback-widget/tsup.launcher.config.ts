import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/launcher.tsx'],
  format: ['iife'],
  globalName: 'SaasMakerFeedback',
  platform: 'browser',
  target: 'es2020',
  outDir: 'dist/browser',
  dts: false,
  splitting: false,
  minify: true,
  noExternal: ['react', 'react-dom'],
  injectStyle: true,
});
