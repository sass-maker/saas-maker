import { defineConfig } from 'blume';

// When DOCS_PUBLIC_INTERNAL is unset or anything other than 'false', internal
// trees (prds/, openspec/) are published alongside the public product docs.
// Set DOCS_PUBLIC_INTERNAL=false to exclude them for a public-only build.
const publicInternal = process.env.DOCS_PUBLIC_INTERNAL !== 'false';

export default defineConfig({
  title: 'Foundry Manual',
  description:
    'Drop-in backend services for SaaS apps — API, SDK, widgets, and Foundry operations.',
  // The canonical documentation tree lives at the repository root in `docs/`.
  // Blume is only the presentation + search layer; committed Markdown is the
  // source of truth. See `docs/README.md` for the knowledge-system layout.
  content: {
    root: '../../docs',
    exclude: publicInternal ? ['archive/**'] : ['archive/**', 'prds/**', 'openspec/**'],
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
    site: 'https://sassmaker.com',
    base: '/docs',
    output: 'static',
  },
});
