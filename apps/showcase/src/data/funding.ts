import fundingData from './funding.json';

interface FundingSchemaProp {
  name: string;
  type: string;
  options?: { value: string; color?: string }[];
}

export interface FundingProgram {
  id: string;
  slug: string;
  name: string;
  fields: Record<string, string | number | boolean | string[] | null>;
}

interface FundingFilterLeaf {
  property: string;
  filter: { operator: string; value?: { type: string; value: unknown } };
}
interface FundingFilterGroup {
  filters: (FundingFilterLeaf | FundingFilterGroup)[];
  operator: 'and' | 'or';
}
type FundingFilter = FundingFilterLeaf | FundingFilterGroup;

interface FundingView {
  id: string;
  name: string;
  type: string;
  filter: FundingFilter | null;
  sort: { property: string; direction: 'ascending' | 'descending' }[] | null;
}

export const FUNDING = fundingData as unknown as {
  exportedAt: string;
  source: string;
  workspaceRebuilt: string;
  collection: string;
  count: number;
  schema: Record<string, FundingSchemaProp>;
  views: FundingView[];
  programs: FundingProgram[];
};

export const FUNDING_PROGRAMS = FUNDING.programs;

const KEY_BY_NAME = Object.fromEntries(
  Object.entries(FUNDING.schema).map(([key, prop]) => [prop.name, key])
);

export function field(program: FundingProgram, name: string) {
  const key = KEY_BY_NAME[name];
  return key ? (program.fields[key] ?? null) : null;
}

// --- Notion view semantics -------------------------------------------------
// The workspace's 16 decision views are query2 filter/sort structures. They
// are evaluated once here at build time so the page ships plain membership and
// ordering data rather than a query engine.

function leafMatches(leaf: FundingFilterLeaf, fields: FundingProgram['fields']): boolean {
  const value = fields[leaf.property];
  const expected = leaf.filter?.value?.value;
  switch (leaf.filter?.operator) {
    case 'enum_is':
      return Array.isArray(value) ? value.includes(expected as string) : value === expected;
    case 'enum_is_not':
      return Array.isArray(value) ? !value.includes(expected as string) : value !== expected;
    case 'string_contains':
      return String(value ?? '')
        .toLowerCase()
        .includes(String(expected ?? '').toLowerCase());
    case 'string_is':
      return String(value ?? '') === String(expected ?? '');
    case 'string_is_not':
      return String(value ?? '') !== String(expected ?? '');
    case 'is_not_empty':
      return value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);
    case 'is_empty':
      return value === null || value === '' || (Array.isArray(value) && value.length === 0);
    case 'checkbox_is':
      return Boolean(value) === Boolean(expected);
    default:
      return true;
  }
}

function matchesFilter(filter: FundingFilter | null, fields: FundingProgram['fields']): boolean {
  if (!filter) return true;
  if ('property' in filter) return leafMatches(filter, fields);
  const list = filter.filters ?? [];
  return filter.operator === 'or'
    ? list.some((child) => matchesFilter(child, fields))
    : list.every((child) => matchesFilter(child, fields));
}

function optionRank(key: string, value: unknown): number {
  const opts = FUNDING.schema[key]?.options;
  if (!opts) return 0;
  const needle = Array.isArray(value) ? value[0] : value;
  const index = opts.findIndex((o) => o.value === needle);
  return index === -1 ? opts.length : index;
}

function sortKey(program: FundingProgram, property: string): string | number {
  if (property === 'title') return program.name.toLowerCase();
  const value = program.fields[property];
  const type = FUNDING.schema[property]?.type;
  if (type === 'select' || type === 'multi_select') return optionRank(property, value);
  if (type === 'date') return typeof value === 'string' ? value : '9999';
  if (type === 'number') return typeof value === 'number' ? value : Infinity;
  return String(value ?? '').toLowerCase();
}

function comparePrograms(a: FundingProgram, b: FundingProgram, sorts: FundingView['sort']) {
  for (const sort of sorts ?? []) {
    const av = sortKey(a, sort.property);
    const bv = sortKey(b, sort.property);
    const dir = sort.direction === 'descending' ? -1 : 1;
    const diff =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
    if (diff !== 0) return diff * dir;
  }
  return a.name.localeCompare(b.name);
}

const PRIORITY_ORDER = ['P0 Apply now', 'P1 Apply soon', 'P2 Later', 'Monitor', 'Skip now'];

const defaultSort = [
  { property: KEY_BY_NAME.Priority, direction: 'ascending' as const },
  { property: 'title', direction: 'ascending' as const },
];

export interface FundingViewDef {
  key: string;
  id: string;
  name: string;
  label: string;
  type: string;
  slugs: string[];
}

const viewKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const FUNDING_VIEWS: FundingViewDef[] = FUNDING.views.map((view) => {
  const label = view.name.replace(/^\d+ — /, '');
  const members = FUNDING_PROGRAMS.filter((program) => matchesFilter(view.filter, program.fields));
  const ordered = [...members].sort((a, b) => comparePrograms(a, b, view.sort));
  return {
    key: viewKey(label),
    id: view.id,
    name: view.name,
    label,
    type: view.type,
    slugs: ordered.map((p) => p.slug),
  };
});

export const FUNDING_VIEW_ORDER = Object.fromEntries(
  FUNDING_VIEWS.map((view) => [view.key, view.slugs])
);

export const FUNDING_PROGRAMS_SORTED = [...FUNDING_PROGRAMS].sort((a, b) =>
  comparePrograms(a, b, defaultSort)
);

export const FUNDING_CATEGORIES = [
  ...new Set(FUNDING_PROGRAMS.map((p) => field(p, 'Category')).filter(Boolean)),
].sort() as string[];

export const FUNDING_PRIORITIES = PRIORITY_ORDER.filter((priority) =>
  FUNDING_PROGRAMS.some((p) => field(p, 'Priority') === priority)
);

export const FUNDING_FITS = [
  ...new Set(FUNDING_PROGRAMS.map((p) => field(p, 'Fit for Current Stage')).filter(Boolean)),
].sort() as string[];

// Field groups for the detail pages — every imported field lands in exactly
// one group so the detail view covers the full record.
export const FUNDING_FIELD_GROUPS: { title: string; fields: string[] }[] = [
  {
    title: 'Assessment & status',
    fields: [
      'Recommendation',
      'Priority',
      'Fit for Current Stage',
      'Preference Alignment',
      'My Status',
      'External Status',
      'Applied On',
      'Next Review',
    ],
  },
  {
    title: 'Funding & terms',
    fields: [
      'Investment Terms',
      'Company Funding',
      'Cash / Benefit Type',
      'Credits or Perks',
      'Estimated Credit Value USD',
      'Fee or Cost',
      'Funding Timing',
      'Funding Before Full-time',
      'Economic Caveats',
    ],
  },
  {
    title: 'Eligibility',
    fields: [
      'Stage Accepted',
      'Traction Requirement',
      'Sector or Thesis',
      'Region',
      'Location',
      'Format',
      'Solo Eligibility',
      'Company Required',
      'Cofounder Support',
      'Visa or Work Rights',
      'Relocation Required',
    ],
  },
  {
    title: 'Commitment & support',
    fields: [
      'Can Keep Job',
      'Full-time Expected',
      'Weekly Load',
      'Duration',
      'Next Cohort',
      'Commitment Details',
      'Mentorship Depth',
      'Structure or Accountability',
      'Personal Support',
      'Personal Support Details',
      'Customer or GTM Support',
    ],
  },
  {
    title: 'Application',
    fields: [
      'Deadline',
      'Application Timing Notes',
      'Application Requirements',
      'Application Effort',
      'Primary Value',
      'Brand Value',
      'Next Action',
    ],
  },
  {
    title: 'Notes & provenance',
    fields: [
      'Why or Decisive Note',
      'Outcome Notes',
      'Original Inventory',
      'Legacy Row URL',
      'Legacy Commitment Signal',
      'Newly Discovered',
      'Evidence Quality',
      'Website Status',
      'Last Verified',
    ],
  },
];

export interface FundingDoc {
  slug: string;
  title: string;
  description: string;
}

export const FUNDING_DOCS: FundingDoc[] = [
  {
    slug: 'strategy',
    title: 'Application strategy',
    description:
      'Current priorities, preference logic, the action calendar, and the questions to answer before accepting any intensive program.',
  },
  {
    slug: 'materials',
    title: 'Application materials',
    description:
      'The source-of-truth founder profile, reusable answers, and the evidence checklist behind every application.',
  },
  {
    slug: 'methodology',
    title: 'Methodology & coverage',
    description:
      'What “exhaustive” means here: which fields are objective, how uncertain evidence is graded, and how the directory stays maintained.',
  },
  {
    slug: 'archive',
    title: 'Legacy archive',
    description:
      'Original Stumble-era applications, raw lists, and unresolved artifacts — preserved as history, not current guidance.',
  },
];
