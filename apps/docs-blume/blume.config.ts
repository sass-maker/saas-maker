import { defineConfig } from 'blume';

export default defineConfig({
  title: 'Foundry Manual',
  description:
    'Drop-in backend services for SaaS apps — API, SDK, widgets, and Foundry operations.',
  content: { root: 'docs' },
  github: {
    owner: 'sass-maker',
    repo: 'saas-maker',
    branch: 'main',
    dir: 'apps/docs-blume/docs',
  },
  search: { provider: 'orama' },
  ai: { llmsTxt: true },
  seo: { agentReadability: true, sitemap: true, robots: true },
  deployment: {
    site: 'https://docs.sassmaker.com',
    output: 'static',
  },
});
