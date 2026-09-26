// Unified build-time search index across every public surface — products,
// ideas, funding programs, launch destinations, tools, learnings, docs, and
// fixed pages. Emitted as /search.json and consumed by /search client-side.
import { DIRECTORY_PROJECTS } from './directory';
import launchdeskData from './launchdesk.json';
import { DOMAIN_RANKS } from './domainRanks';
import { field, FUNDING_DOCS, FUNDING_PROGRAMS } from './funding';
import { IDEA_ENTRIES } from './ideas';
import { LEARNINGS } from './learnings';
import { TOOLING_CAPABILITIES } from './tooling';

export type SearchEntry = {
  type: 'product' | 'idea' | 'funding' | 'launchdesk' | 'tool' | 'learning' | 'doc' | 'page';
  title: string;
  url: string;
  summary: string;
  keywords: string;
};

const toolSlug = (id: string) =>
  id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type LaunchdeskRow = {
  domain: string;
  name: string;
  category: string | null;
  type: string | null;
  dr: number | null;
  link: string | null;
  pricing: string | null;
  quarantined: boolean;
  submissionUrl: string | null;
};

const launchdeskRows = (launchdeskData as { destinations: LaunchdeskRow[] }).destinations.filter(
  (row) => !row.quarantined
);

const productEntries: SearchEntry[] = DIRECTORY_PROJECTS.map((product) => ({
  type: 'product',
  title: product.name,
  url: product.id === 'saas-maker' ? '/' : `/p/${product.id}`,
  summary: product.description,
  keywords: [product.form, ...product.technologies, ...product.domains].filter(Boolean).join(' '),
}));

const ideaEntries: SearchEntry[] = IDEA_ENTRIES.map(({ idea, slug }) => ({
  type: 'idea',
  title: (idea.idea.match(/^\*\*(.+?)\*\*/)
    ? idea.idea.match(/^\*\*(.+?)\*\*/)![1]
    : idea.idea.split('.')[0]
  )
    .replace(/\.+$/, '')
    .trim(),
  url: `/ideas/${slug}`,
  summary: idea.idea.replace(/[*`[\]()]/g, ' ').slice(0, 220),
  keywords: [idea.source, idea.customer, idea.best_bet ? 'best bet' : ''].join(' '),
}));

const fundingEntries: SearchEntry[] = FUNDING_PROGRAMS.map((program) => ({
  type: 'funding',
  title: (field(program, 'Program') as string | null) ?? program.slug,
  url: `/funding/${program.slug}`,
  summary: [
    (field(program, 'Organization') as string | null) ?? '',
    (field(program, 'Category') as string | null) ?? '',
    (field(program, 'Investment Terms') as string | null) ?? '',
    (field(program, 'Recommendation') as string | null) ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 220),
  keywords: [
    (field(program, 'Category') as string | null) ?? '',
    (field(program, 'Region') as string | null) ?? '',
    (field(program, 'Sector or Thesis') as string | null) ?? '',
  ].join(' '),
}));

const launchdeskEntries: SearchEntry[] = launchdeskRows.map((row) => ({
  type: 'launchdesk',
  title: row.name || row.domain,
  url: `/launchdesk/${row.domain}`,
  summary: [
    row.domain,
    row.category,
    row.type,
    row.dr != null ? `DR ${row.dr}` : null,
    row.link ? `${row.link} link` : null,
    row.pricing,
  ]
    .filter(Boolean)
    .join(' · '),
  keywords: [row.domain, row.category ?? '', row.type ?? ''].join(' '),
}));

const toolEntries: SearchEntry[] = TOOLING_CAPABILITIES.map((cap) => ({
  type: 'tool',
  title: cap.name,
  url: `/tools/${toolSlug(cap.id)}`,
  summary: cap.summary,
  keywords: `${cap.type} ${cap.id}`,
}));

const learningEntries: SearchEntry[] = LEARNINGS.map((learning) => ({
  type: 'learning',
  title: learning.title,
  url: learning.href,
  summary: learning.description,
  keywords: learning.publishedAt,
}));

const docEntries: SearchEntry[] = FUNDING_DOCS.map((doc) => ({
  type: 'doc',
  title: `Funding doc — ${doc.title}`,
  url: `/funding/docs/${doc.slug}`,
  summary: doc.description,
  keywords: 'funding accelerator workspace',
}));

const pageEntries: SearchEntry[] = [
  ['Studio', '/studio', 'The SaaS Maker studio thesis, operating principles, and owner position'],
  ['Projects directory', '/projects', 'Complete public directory of shareable Fleet projects'],
  ['Ideas', '/ideas', 'Scored decision ledger of tech-heavy product ideas'],
  ['Launch catalog', '/launchdesk', 'Provenance-honest launch and submission destination catalog'],
  ['Launchkit', '/launchkit', 'Free agent-executable launch toolkit on the launchdesk catalog'],
  ['Funding', '/funding', 'Funding and accelerator directory with decision views'],
  ['Tools', '/tools', 'Reusable Fleet skills, scripts, templates, and guides'],
  ['Domain ranks', '/ranks', 'Provider-reported Ahrefs DR board for owned Fleet domains'],
  ['Learnings', '/learnings', 'First-party builder notes and agent-tooling learnings'],
  ['Changelog', '/changelog', 'Product-owned history of shipped changes'],
  ['Privacy', '/privacy', 'Privacy policy'],
  ['Terms', '/terms', 'Terms of use'],
].map(([title, url, summary]) => ({ type: 'page' as const, title, url, summary, keywords: '' }));

const rankEntries: SearchEntry[] = DOMAIN_RANKS.map((rank) => ({
  type: 'doc',
  title: `${rank.domain} — domain rank`,
  url: '/ranks',
  summary: `Provider-reported DR ${rank.current === null ? 'not reported' : rank.current}`,
  keywords: 'domain rank dr ahrefs',
}));

export const SEARCH_INDEX: SearchEntry[] = [
  ...pageEntries,
  ...productEntries,
  ...ideaEntries,
  ...fundingEntries,
  ...docEntries,
  ...launchdeskEntries,
  ...toolEntries,
  ...learningEntries,
  ...rankEntries,
];

export const SEARCH_TYPES = [...new Set(SEARCH_INDEX.map((entry) => entry.type))];
