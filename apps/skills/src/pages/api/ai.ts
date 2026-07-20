import skillsCatalog from '../../../../../catalog/generated/skills.json';
export const prerender = true;
export function GET() {
  return new Response(
    JSON.stringify(
      {
        name: 'Foundry Skills',
        schemaVersion: 1,
        version: '1',
        url: 'https://skills.sassmaker.com',
        llms: 'https://skills.sassmaker.com/llms.txt',
        llmsFull: null,
        sitemap: 'https://skills.sassmaker.com/sitemap-index.xml',
        markdown: { suffix: '.md', negotiation: false },
        canonical: 'https://skills.sassmaker.com',
        sourceOfTruth: 'catalog/foundry.json',
        surfaces: [
          {
            id: 'skills',
            url: 'https://skills.sassmaker.com/',
            md: 'https://skills.sassmaker.com/index.md',
            kind: 'collection',
            description: 'Versioned public Foundry capabilities',
          },
        ],
        auth: {
          public: true,
          notes: 'Skill source is public; private operating state is excluded.',
        },
        skills: skillsCatalog.skills,
      },
      null,
      2
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}
