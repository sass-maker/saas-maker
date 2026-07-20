import { defineConfig } from 'blume';

export default defineConfig({
  title: 'SaaS Maker Packages',
  description: 'Install and use the SaaS Maker API, SDK, CLI, widgets, and reusable packages.',
  // The canonical documentation tree lives at the repository root in `docs/`.
  // Blume is only the presentation + search layer; committed Markdown is the
  // source of truth. See `docs/README.md` for the knowledge-system layout.
  content: {
    root: '../../docs',
    // Blume exposes only package/product documentation. Foundry architecture,
    // operations, plans, private status, and learnings stay committed but are
    // never part of this public build.
    exclude: [
      'README.md',
      'archive/**',
      'architecture/**',
      'current/**',
      'development/**',
      'knowledge/**',
      'operations/**',
      'org-profiles/**',
      'product/**',
      'superpowers/**',
      'prds/**',
      'openspec/**',
    ],
  },
  github: {
    owner: 'sass-maker',
    repo: 'saas-maker',
    branch: 'main',
    dir: 'docs',
  },
  theme: {
    accent: { light: '#c65d28', dark: '#f08a4b' },
    action: '#b94f20',
    radius: 'lg',
    mode: 'system',
    fonts: {
      display: 'space-grotesk',
      body: 'inter',
      mono: 'ibm-plex-mono',
    },
  },
  navigation: {
    sidebar: { display: 'group' },
  },
  search: { provider: 'orama' },
  ai: { llmsTxt: true },
  seo: { agentReadability: true, sitemap: true, robots: true },
  deployment: {
    site: 'https://packages.sassmaker.com',
    base: '/',
    output: 'static',
  },
});
