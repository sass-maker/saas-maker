import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://skills.sassmaker.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file', inlineStylesheets: 'always' },
  integrations: [sitemap()],
  vite: { css: { transformer: 'lightningcss' }, build: { cssMinify: 'lightningcss' } },
});
