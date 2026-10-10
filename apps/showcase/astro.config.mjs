// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  site: 'https://sassmaker.com',
  output: 'static',
  trailingSlash: 'never',
  // Preserve Astro 5's lossless whitespace handling instead of JSX rules.
  compressHTML: true,
  vite: {
    // Keep the previous minifiers' CSS compatibility and script output.
    build: { minify: 'esbuild', cssMinify: 'esbuild' },
    define: {
      // Resolve before bundling: prerender chunks have a different module URL.
      'import.meta.env.TOOLING_ROOT': JSON.stringify(
        fileURLToPath(new URL('../../tooling', import.meta.url))
      ),
    },
  },
  build: {
    // `file` keeps slashless canonicals mapping straight onto `/learnings.html`
    // on Cloudflare Pages. `directory` would emit `learnings/index.html` and
    // make Pages 308-redirect `/learnings` to `/learnings/`, which contradicts
    // `trailingSlash: 'never'` and the canonical URLs this site publishes.
    // HEAD parity (issue #93) is handled in `functions/_middleware.ts`, which
    // was the actual cause: it resolved HEAD against an empty body and its
    // soft-404 detector then rejected every interior page.
    format: 'file',
    inlineStylesheets: 'always',
  },
});
