// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Fleet web stack standard (VoidZero ecosystem). Mirrors
// linkchat/landing-astro and apps/docs:
// - Pure static output (no SSR adapter) — sassmaker.com is fully static.
// - `build.format: 'file'` emits `about.html` rather than
//   `about/index.html`, so no 308 redirect on every link.
// - `build.inlineStylesheets: 'always'` inlines the CSS into the HTML so
//   the LCP path is one round-trip: HTML → fonts → paint.
// - Lightning CSS as both transformer and minifier.
export default defineConfig({
  site: 'https://sassmaker.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  integrations: [sitemap({ customPages: ['https://sassmaker.com/docs/'] })],
  vite: {
    css: { transformer: 'lightningcss' },
    build: { cssMinify: 'lightningcss' },
  },
});
