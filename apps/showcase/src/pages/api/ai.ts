import publicCatalog from '../../../../../catalog/generated/public.json';
import tokenWorld from '../../data/tokenWorld.json';
import { PACKAGE_URL } from '../../data/links';
import { TOOLING_CAPABILITIES } from '../../data/tooling';
import { STUDIO_PROFILE } from '../../data/studio';
import { publicMcpCatalog } from '../../data/publicMcpCatalog';
export const prerender = true;
export function GET() {
  return new Response(
    JSON.stringify(
      {
        name: 'SaaS Maker',
        schemaVersion: 1,
        version: '1',
        url: 'https://sassmaker.com',
        llms: 'https://sassmaker.com/llms.txt',
        llmsFull: 'https://sassmaker.com/llms-full.txt',
        sitemap: 'https://sassmaker.com/sitemap.xml',
        markdown: { suffix: '.md', negotiation: true },
        canonical: 'https://sassmaker.com',
        sourceOfTruth: 'SaaS Maker privacy-checked public product catalog',
        studio: {
          ...STUDIO_PROFILE,
          page: 'https://sassmaker.com/studio',
          markdown: 'https://sassmaker.com/studio.md',
        },
        surfaces: publicMcpCatalog.surfaces,
        externalResources: [
          {
            id: 'feedback-package',
            url: PACKAGE_URL,
            kind: 'documentation',
            description: 'Published feedback package and hosted submission service',
          },
        ],
        tooling: {
          url: 'https://sassmaker.com/tools',
          json: 'https://sassmaker.com/tools.json',
          generatedFrom: 'sass-maker/saas-maker/tooling',
          capabilities: TOOLING_CAPABILITIES,
        },
        auth: { public: true, notes: 'Private Fleet controls are intentionally excluded.' },
        tokenImpact: {
          name: 'Tokens Spent for the World',
          metric: 'Verified provider-reported model tokens from contributing products',
          ...tokenWorld,
        },
        products: publicMcpCatalog.products,
        directory: publicCatalog.directory,
        archivedDirectory: publicCatalog.archivedDirectory,
        historySemantics: publicCatalog.historySemantics,
        pastProjects: publicCatalog.pastProjects,
        learnings: publicMcpCatalog.learnings,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
