import { defineConfig } from 'blume';

/**
 * Blume configuration for the drank docs site.
 *
 * The committed Markdown under docs/ is the source of truth. Blume is only
 * the presentation and search layer — generated output (.blume/) is
 * gitignored and never committed. See docs/development/workflow.md.
 */
export default defineConfig({
  title: 'drank docs',
  description:
    'Local-first knowledge system for drank — a private Next.js dashboard for tracking Ahrefs Domain Rating over time (static export + Cloudflare Pages Functions).',

  content: {
    root: 'docs',
    // Render committed Markdown as the docs site. Archive is preserved for
    // git history and reachable via the repo, not as canonical pages.
    include: ['**/*.md'],
    exclude: ['archive/**'],
  },

  theme: {
    accent: 'sky',
    radius: 'md',
    mode: 'system',
  },

  search: {
    provider: 'orama',
  },

  markdown: {
    imageZoom: true,
    code: {
      icons: true,
      wrap: false,
    },
  },

  ai: {
    llmsTxt: true,
  },

  seo: {
    og: { enabled: true },
    sitemap: true,
    robots: true,
    structuredData: true,
  },

  deployment: {
    output: 'static',
    // No canonical docs site URL yet — set this when the docs site is
    // published. Leaving it unset keeps sitemap/feeds off until a site is chosen.
    // site: "https://docs.domains.sassmaker.com",
  },
});
