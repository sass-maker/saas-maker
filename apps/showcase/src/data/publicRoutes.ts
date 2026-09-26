import publicCatalog from '../../../../catalog/generated/public.json';
import tokenWorld from './tokenWorld.json';
import { CHANGELOG } from './changelog';
import { FUNDING, FUNDING_DOCS, FUNDING_VIEWS } from './funding';
import archiveMd from './funding-docs/archive.md?raw';
import materialsMd from './funding-docs/materials.md?raw';
import methodologyMd from './funding-docs/methodology.md?raw';
import strategyMd from './funding-docs/strategy.md?raw';
import { DOMAIN_RANKS, RANKS_UPDATED } from './domainRanks';
import { LEARNINGS } from './learnings';
import ideas from './ideas.json';
import { CORE } from './projects';
import { DIRECTORY_PROJECTS, type DirectoryProject } from './directory';
import { STUDIO_PROFILE } from './studio';
import { TOOLING_CAPABILITIES, TOOLING_GROUPS } from './tooling';

export type PublicRoute = {
  id: string;
  path: string;
  description: string;
  kind: 'article' | 'collection' | 'profile' | 'static';
  markdown: string;
};

const SITE_URL = 'https://sassmaker.com';

function productMarkdown(product: DirectoryProject): string {
  const lines = [
    `# ${product.name}`,
    '',
    product.description,
    '',
    '## Why I made this',
    '',
    product.makerNote,
    '',
    ...(product.purposeContract
      ? [
          '## Product contract',
          '',
          product.purposeContract.purpose,
          '',
          `- Audience: ${product.purposeContract.audience}`,
          `- Outcome: ${product.purposeContract.outcome}`,
          `- Mechanism: ${product.purposeContract.mechanism}`,
          `- Proof: ${product.purposeContract.proof}`,
          `- Next action: ${product.purposeContract.nextAction}`,
          '',
        ]
      : []),
    '## Public anatomy',
    '',
    `- Form: ${product.form}`,
    `- Platforms: ${product.platforms.join(', ')}`,
    `- Prominent tools: ${product.technologies.join(', ')}`,
    `- Deployment: ${product.deployed ? 'deployed' : 'not deployed'}`,
    ...(product.deploymentProviders.length > 0
      ? [`- Providers: ${product.deploymentProviders.join(', ')}`]
      : []),
    `- First retained commit: ${product.firstCommitAt ?? 'not retained'}`,
    `- Latest retained commit: ${product.latestCommitAt ?? 'not retained'}`,
    '',
  ];
  const links = [
    ...product.domains.map((domain) => ({ title: domain, url: `https://${domain}` })),
    ...(product.changelogUrl ? [{ title: 'Changelog', url: product.changelogUrl }] : []),
    ...(product.roadmapUrl ? [{ title: 'Issues', url: product.roadmapUrl }] : []),
    ...(product.repositoryUrl ? [{ title: 'Source', url: product.repositoryUrl }] : []),
  ];

  if (links.length > 0) {
    lines.push(
      '## Public evidence',
      '',
      ...links.map((link) => `- [${link.title}](${link.url})`),
      ''
    );
  }

  lines.push(
    '## Directory boundary',
    '',
    `This profile is generated from reviewed public facts. Private work and operations stay private.`,
    ''
  );
  return lines.join('\n');
}

function homeMarkdown(): string {
  const latestLearning = LEARNINGS[0];
  const featuredProducts = CORE.flatMap((project) => [
    `### ${project.name}`,
    '',
    project.desc,
    '',
    `- SaaS Maker profile: ${SITE_URL}${project.href}`,
    '',
  ]);

  return [
    '# SaaS Maker',
    '',
    STUDIO_PROFILE.oneLine,
    '',
    `Founded and built by [${STUDIO_PROFILE.owner.name}](${STUDIO_PROFILE.owner.url}).`,
    '',
    '## Studio thesis',
    '',
    STUDIO_PROFILE.thesis,
    '',
    `> ${STUDIO_PROFILE.ownerVoice}`,
    '',
    `- Human page: ${SITE_URL}/studio`,
    `- Markdown: ${SITE_URL}/studio.md`,
    '',
    '## Tokens Spent for the World',
    '',
    `${tokenWorld.lifetimeTokens.toLocaleString('en-US')} verified model tokens across ${tokenWorld.projectsContributing} contributing project as of ${tokenWorld.snapshotDate}.`,
    '',
    `- Latest seeded day: ${tokenWorld.todayTokens.toLocaleString('en-US')} tokens`,
    `- Last updated at: ${tokenWorld.lastUpdatedAt}`,
    '- Projects used: Worldwide',
    `- Projects contributing: ${tokenWorld.projectsContributing}`,
    `- Coverage: ${tokenWorld.coverage}`,
    '',
    '## Products in focus',
    '',
    ...featuredProducts,
    '## Complete directory',
    '',
    `Current, supporting, parked, and past work is enumerated once at ${SITE_URL}/projects.`,
    '',
    `- Human directory: ${SITE_URL}/projects`,
    `- Agent-readable directory: ${SITE_URL}/projects.md`,
    `- JSON directory: ${SITE_URL}/projects.json`,
    '',
    '## Latest learning',
    '',
    `### ${latestLearning.title}`,
    '',
    latestLearning.description,
    '',
    `- Article: ${SITE_URL}${latestLearning.href}`,
    `- Published: ${latestLearning.publishedAt}`,
    `- Author: ${latestLearning.author}`,
    '',
    '## Public package',
    '',
    '@saas-maker/feedback is a React widget for bugs, feature requests, screenshots, and page-specific feedback.',
    '',
    `- Package overview: ${SITE_URL}/#package`,
  ].join('\n');
}

function studioMarkdown(): string {
  return [
    `# ${STUDIO_PROFILE.name} studio thesis`,
    '',
    STUDIO_PROFILE.oneLine,
    '',
    `Founder and builder: [${STUDIO_PROFILE.owner.name}](${STUDIO_PROFILE.owner.url})`,
    '',
    '## Why the studio exists',
    '',
    STUDIO_PROFILE.thesis,
    '',
    '## The owner’s position on AI',
    '',
    `> ${STUDIO_PROFILE.ownerVoice}`,
    '',
    STUDIO_PROFILE.aiPosition,
    '',
    '## Operating principles',
    '',
    ...STUDIO_PROFILE.principles.flatMap((principle) => [
      `### ${principle.title}`,
      '',
      principle.summary,
      '',
    ]),
    '## Representative work',
    '',
    ...STUDIO_PROFILE.representativeWork.flatMap((project) => [
      `### ${project.name}`,
      '',
      project.description,
      '',
      project.studioSignal,
      '',
      `- Why it was made: ${project.makerNote}`,
      `- SaaS Maker profile: ${project.profileUrl}`,
      ...(project.destinationUrl ? [`- Product: ${project.destinationUrl}`] : []),
      ...(project.repositoryUrl ? [`- Source: ${project.repositoryUrl}`] : []),
      '',
    ]),
    '## Boundaries',
    '',
    ...STUDIO_PROFILE.boundaries.map((boundary) => `- ${boundary}`),
    '',
    `- Complete project register: ${SITE_URL}/projects`,
    `- Machine-readable studio and project catalog: ${SITE_URL}/api/ai`,
  ].join('\n');
}

function directoryMarkdown(): string {
  const groups = [
    ['current', 'Current work'],
    ['supporting', 'Supporting and parked'],
    ['past', 'Past projects'],
  ] as const;
  const entries = groups.flatMap(([group, label]) => [
    `# ${label}`,
    '',
    ...publicCatalog.directory
      .filter((project) => project.group === group)
      .flatMap((project) => [
        `## ${project.name}`,
        '',
        project.description,
        '',
        `> ${project.makerNote}`,
        '',
        `- Project note: ${SITE_URL}${project.id === 'saas-maker' ? '/' : `/p/${project.id}`}`,
        `- Form: ${project.form}`,
        `- Platforms: ${project.platforms.join(', ')}`,
        `- Uses: ${project.technologies.join(', ')}`,
        `- Deployment: ${project.deployed ? 'deployed' : 'not deployed'}`,
        ...(project.deploymentProviders.length > 0
          ? [`- Providers: ${project.deploymentProviders.join(', ')}`]
          : []),
        ...project.domains.map((domain) => `- Public destination: https://${domain}`),
        ...(project.repositoryUrl ? [`- Public source: ${project.repositoryUrl}`] : []),
        `- First retained commit: ${project.firstCommitAt ?? 'not retained'}`,
        `- Latest retained commit: ${project.latestCommitAt ?? 'not retained'}`,
        '',
      ]),
  ]);

  return [
    '# SaaS Maker shareable projects',
    '',
    `${publicCatalog.directory.length} shareable projects and experiments. Paused entries have no active development commitment; inclusion does not mean a finished product.`,
    '',
    publicCatalog.historySemantics,
    '',
    ...entries,
  ].join('\n');
}

function ideasMarkdown(): string {
  return [
    '# SaaS Maker ideas',
    '',
    'A scored decision ledger of tech-heavy product ideas. This is a SaaS Maker surface, not a separate product identity.',
    '',
    '## Scoring',
    '',
    '- Fun = F + T: enjoyment plus technical challenge.',
    '- Money = M + Feas - C: raw potential plus solo feasibility, less competition.',
    '- The dataset is hard-filtered to T >= 7.',
    '',
    `- Human catalog: ${SITE_URL}/ideas`,
    `- JSON dataset: ${SITE_URL}/ideas.json`,
    `- Total ideas: ${ideas.length}`,
    '',
    '## Catalog',
    '',
    ...ideas.flatMap((idea, index) => [
      `### ${index + 1}. ${idea.best_bet ? 'Best bet' : 'Idea'}`,
      '',
      idea.idea,
      '',
      `- Money: ${idea.money}`,
      `- Fun: ${idea.fun}`,
      `- Feasibility: ${idea.f_feas}/10${idea.f_feas_why ? ` — ${idea.f_feas_why}` : ''}`,
      `- Customer: ${idea.customer}`,
      `- Source: ${idea.source}`,
      '',
    ]),
  ].join('\n');
}

function toolsMarkdown(): string {
  return [
    '# SaaS Maker reusable tools',
    '',
    'The canonical public register of credential-free Fleet workflows, agent skills, scripts, templates, and guides that have earned reuse across projects.',
    '',
    `- Human catalog: ${SITE_URL}/tools`,
    `- JSON catalog: ${SITE_URL}/tools.json`,
    `- Total reusable capabilities: ${TOOLING_CAPABILITIES.length}`,
    '',
    ...TOOLING_GROUPS.filter((group) => group.items.length > 0).flatMap((group) => [
      `## ${group.label}`,
      '',
      ...group.items.flatMap((item) => [
        `### ${item.name}`,
        '',
        item.summary,
        '',
        `- Capability ID: ${item.id}`,
        `- Source: https://github.com/sass-maker/saas-maker/blob/main/tooling/${item.path}`,
        '',
      ]),
    ]),
  ].join('\n');
}

const fixedRoutes: PublicRoute[] = [
  {
    id: 'directory',
    path: '/',
    description: 'Software as a specialized service: a living studio of focused products',
    kind: 'collection',
    markdown: homeMarkdown(),
  },
  {
    id: 'studio',
    path: '/studio',
    description: STUDIO_PROFILE.oneLine,
    kind: 'static',
    markdown: studioMarkdown(),
  },
  {
    id: 'projects',
    path: '/projects',
    description: 'Public directory of shareable Fleet projects and experiments',
    kind: 'collection',
    markdown: directoryMarkdown(),
  },
  {
    id: 'ideas',
    path: '/ideas',
    description: 'Scored decision ledger of tech-heavy product ideas',
    kind: 'collection',
    markdown: ideasMarkdown(),
  },
  {
    id: 'tools',
    path: '/tools',
    description: 'Canonical public catalog of reusable Fleet capabilities',
    kind: 'collection',
    markdown: toolsMarkdown(),
  },
  {
    id: 'launchdesk',
    path: '/launchdesk',
    description: 'SaaS Maker launch-destination catalog with source-attributed metrics',
    kind: 'collection',
    markdown: [
      '# SaaS Maker launch catalog',
      '',
      'A provenance-honest catalog of launch and submission destinations. Reported DR, link type, pricing and submission routes are shown with their source claims rather than smoothed away.',
      '',
      `- Catalog: ${SITE_URL}/launchdesk`,
      `- JSON: ${SITE_URL}/launchdesk.json`,
      `- Per-platform playbooks: ${SITE_URL}/launchdesk-playbooks.json (index) and ${SITE_URL}/launchdesk/<domain>.json`,
      `- Per-project coverage ledger: ${SITE_URL}/launch-coverage.json`,
      `- Free agent-executable toolkit: ${SITE_URL}/launchkit`,
      `- Source: https://github.com/sass-maker/saas-maker`,
      '',
    ].join('\n'),
  },
  {
    id: 'launchkit',
    path: '/launchkit',
    description: 'Free agent-executable launch toolkit on the launchdesk catalog',
    kind: 'static',
    markdown: [
      '# SaaS Maker Launchkit',
      '',
      'A free, agent-executable launch toolkit: fill one product brief, generate a truthful run plan, execute each route from its per-platform playbook with human gates, and record submitted/scheduled/live states with evidence.',
      '',
      `- Manifest: ${SITE_URL}/launchkit.json`,
      `- Human page: ${SITE_URL}/launchkit`,
      `- Destination catalog: ${SITE_URL}/launchdesk.json`,
      `- Playbook index: ${SITE_URL}/launchdesk-playbooks.json`,
      `- Playbook pattern: ${SITE_URL}/launchdesk/<domain>.json`,
      `- Source: https://github.com/sass-maker/saas-maker/tree/main/tooling/launchkit`,
      '',
      '## Quickstart',
      '',
      '```bash',
      'git clone --depth 1 https://github.com/sass-maker/saas-maker.git',
      'cd saas-maker && cp tooling/launchkit/brief.template.md brief.md',
      'node tooling/launchkit/scripts/plan-run.mjs --brief brief.md --n 10 --out run-plan.json',
      'node tooling/launchkit/scripts/report.mjs --tracker tracker.json',
      '```',
      '',
      'Honesty rules: playbook grade "researched" means assembled from cited public pages, not a completed submission. A saved draft is prepared, a confirmed date is scheduled, and live requires a resolving public URL.',
      '',
    ].join('\n'),
  },
  {
    id: 'funding',
    path: '/funding',
    description: 'Funding and accelerator directory — 184 programs with per-row evidence grading',
    kind: 'collection',
    markdown: [
      '# SaaS Maker funding directory',
      '',
      `${FUNDING.count} accelerators, residencies, funds, credit schemes, and resources — one row per specific program, with fit, terms, deadlines, and evidence quality preserved per row.`,
      '',
      `Imported from the Funding & Accelerators workspace rebuilt ${FUNDING.workspaceRebuilt}. Assessments — fit, priority, recommendation — are the portfolio's judgment, not the programs' claims. Stale, niche, and unresolved items stay searchable rather than being deleted or presented as fact.`,
      '',
      `- Directory: ${SITE_URL}/funding`,
      `- JSON: ${SITE_URL}/funding.json`,
      `- Per-program records: ${SITE_URL}/funding/<slug>`,
      `- Docs: ${FUNDING_DOCS.map((doc) => `${SITE_URL}/funding/docs/${doc.slug}`).join(', ')}`,
      '',
      '## Decision views',
      '',
      ...FUNDING_VIEWS.map(
        (view) => `- ${view.label} — ${view.slugs.length} programs (original workspace ordering)`
      ),
      '',
    ].join('\n'),
  },
  {
    id: 'search',
    path: '/search',
    description: 'Unified search across every public SaaS Maker surface',
    kind: 'collection',
    markdown: [
      '# SaaS Maker search',
      '',
      'One index across products, ideas, funding programs, launch destinations, tools, learnings, docs, and pages.',
      '',
      `- Human search: ${SITE_URL}/search?q=<query>`,
      `- Full machine index: ${SITE_URL}/search.json — fetch once, filter on title+summary+keywords`,
      '',
    ].join('\n'),
  },
  {
    id: 'ranks',
    path: '/ranks',
    description: 'Provider-reported Ahrefs DR board for all owned Fleet domains',
    kind: 'collection',
    markdown: [
      '# SaaS Maker domain ranks',
      '',
      `Provider-reported Ahrefs Domain Rating for ${DOMAIN_RANKS.length} owned Fleet domains. Snapshot of ${RANKS_UPDATED}; a missing rating means "not reported", never zero.`,
      '',
      `- Human board: ${SITE_URL}/ranks`,
      `- JSON: ${SITE_URL}/ranks.json`,
      '',
      ...DOMAIN_RANKS.map(
        (rank) =>
          `- ${rank.domain}: DR ${rank.current === null ? 'not reported' : rank.current}${
            rank.delta !== null && rank.delta !== 0
              ? ` (${rank.delta > 0 ? '+' : ''}${rank.delta.toFixed(1)})`
              : ''
          }${rank.tracked ? '' : ' — history only'}`
      ),
      '',
    ].join('\n'),
  },
  {
    id: 'privacy',
    path: '/privacy',
    description: 'Privacy policy for the SaaS Maker product directory',
    kind: 'static',
    markdown: `# SaaS Maker privacy policy

Last updated: July 24, 2026

## What this site is

sassmaker.com is a static directory for maintained products. It does not require an account and does not collect form submissions on this domain.

## What we may collect

- Cloudflare may log standard request metadata such as IP address, user agent, and path at the edge.
- Individual linked products have their own policies.

## Contact

- Email: sarthakagrawal927@gmail.com
- Website: https://sarthakagrawal.dev
`,
  },
  {
    id: 'terms',
    path: '/terms',
    description: 'Terms of use for the SaaS Maker product directory',
    kind: 'static',
    markdown: `# SaaS Maker terms of use

Last updated: July 24, 2026

## Use of this site

sassmaker.com describes open-source and personal projects maintained by Sarthak Agrawal. Content is provided as-is for informational purposes. Linked products may have separate terms.

## No warranty

Software and documentation are provided without warranty. You use linked products and repositories at your own risk.

## Contact

- Email: sarthakagrawal927@gmail.com
- Website: https://sarthakagrawal.dev
`,
  },
  {
    id: 'changelog',
    path: '/changelog',
    description: 'Product-owned history of meaningful changes shipped by SaaS Maker',
    kind: 'collection',
    markdown: [
      '# SaaS Maker changelog',
      '',
      'A product-owned history of meaningful changes shipped by SaaS Maker.',
      '',
      ...CHANGELOG.flatMap((entry) => [
        `## ${entry.label} — ${entry.title}`,
        '',
        entry.summary,
        '',
        ...entry.changes.map((change) => `- ${change}`),
        '',
      ]),
    ].join('\n'),
  },
  {
    id: 'learnings',
    path: '/learnings',
    description: 'First-party builder notes and agent-tooling learnings',
    kind: 'collection',
    markdown: [
      '# SaaS Maker learnings',
      '',
      'First-party notes from building products, agent workflows, and the systems around them.',
      '',
      ...LEARNINGS.flatMap((learning) => [
        `## ${learning.title}`,
        '',
        learning.description,
        '',
        `- Published: ${learning.publishedAt}`,
        `- Read: ${SITE_URL}${learning.href}`,
        `- Markdown: ${SITE_URL}${learning.href}.md`,
        '',
      ]),
    ].join('\n'),
  },
];

const learningRoutes: PublicRoute[] = LEARNINGS.map((learning) => ({
  id: `learning-${learning.href.split('/').filter(Boolean).at(-1)}`,
  path: learning.href,
  description: learning.description,
  kind: 'article',
  markdown: learning.markdown,
}));

const fundingDocMarkdown: Record<string, string> = {
  strategy: strategyMd,
  materials: materialsMd,
  methodology: methodologyMd,
  archive: archiveMd,
};

const fundingDocRoutes: PublicRoute[] = FUNDING_DOCS.map((doc) => ({
  id: `funding-doc-${doc.slug}`,
  path: `/funding/docs/${doc.slug}`,
  description: doc.description,
  kind: 'article',
  markdown: fundingDocMarkdown[doc.slug],
}));

const productRoutes: PublicRoute[] = DIRECTORY_PROJECTS.filter(
  (product) => product.id !== 'saas-maker'
).map((product) => ({
  id: `product-${product.id}`,
  path: `/p/${product.id}`,
  description: product.description,
  kind: 'profile',
  markdown: productMarkdown(product),
}));

export const PUBLIC_ROUTES = [
  ...fixedRoutes,
  ...fundingDocRoutes,
  ...learningRoutes,
  ...productRoutes,
];

export function publicRouteUrl(route: PublicRoute): string {
  return new URL(route.path, SITE_URL).toString();
}

export function markdownPath(route: PublicRoute): string {
  if (route.path === '/') return 'index';
  return route.path.replace(/^\//, '');
}
