import publicCatalog from '../../../../../catalog/generated/public.json';
import { PACKAGE_DOCS_URL } from '../../data/links';
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
        sitemap: 'https://sassmaker.com/sitemap-index.xml',
        markdown: { suffix: '.md', negotiation: false },
        canonical: 'https://sassmaker.com',
        sourceOfTruth: 'sass-maker/fleet-workspace: fleet-ops/public/products.json',
        surfaces: [
          {
            id: 'directory',
            url: 'https://sassmaker.com/',
            md: 'https://sassmaker.com/index.md',
            kind: 'collection',
            description: 'Public product directory',
          },
          {
            id: 'packages',
            url: `${PACKAGE_DOCS_URL}/`,
            md: `${PACKAGE_DOCS_URL}/index.md`,
            kind: 'collection',
            description: 'Public package documentation',
          },
          {
            id: 'feedback',
            url: `${PACKAGE_DOCS_URL}/widgets/feedback/`,
            md: `${PACKAGE_DOCS_URL}/widgets/feedback.md`,
            kind: 'documentation',
            description: 'Published feedback package documentation',
          },
        ],
        auth: { public: true, notes: 'Private cockpit routes are intentionally excluded.' },
        products: publicCatalog.products,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
