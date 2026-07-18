import { defineConfig } from 'blume';

export default defineConfig({
  title: 'Foundry Manual',
  description:
    'Drop-in backend services for SaaS apps — API, SDK, widgets, and Foundry operations.',
  // The canonical documentation tree lives at the repository root in `docs/`.
  // Blume is only the presentation + search layer; committed Markdown is the
  // source of truth. See `docs/README.md` for the knowledge-system layout.
  content: { root: '../../docs' },
  github: {
    owner: 'sass-maker',
    repo: 'saas-maker',
    branch: 'main',
    dir: 'docs',
  },
  search: { provider: 'orama' },
  ai: { llmsTxt: true },
  seo: { agentReadability: true, sitemap: true, robots: true },
  deployment: {
    site: 'https://docs.sassmaker.com',
    output: 'static',
  },
});
