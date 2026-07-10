// Fleet inventory is derived from the root foundry.projects.json so the
// showcase updates whenever the canonical registry changes. The override map
// below only owns presentation details that the registry does not model.

import registry from '../../../../foundry.projects.json';

export const GITHUB_URL = 'https://github.com/sarthak-fleet/saas-maker';

export interface CoreProject {
  n: string;
  name: string;
  initials: string;
  tag: string;
  desc: string;
  color: string;
  size: 'feature' | 'tall' | 'wide' | 'std';
  href: string;
}

export interface ActiveProject {
  name: string;
  desc: string;
  color: string;
  href: string;
}

interface RegistryProject {
  desc: string;
  url: string;
  tier?: 'core' | 'active-ai' | 'helper' | string;
  category?: 'product' | 'helper' | string;
  priority?: 'P0' | 'P1' | 'P2' | string;
}

interface ShowcaseOverride {
  name?: string;
  initials?: string;
  tag?: string;
  desc?: string;
  color?: string;
  size?: CoreProject['size'];
  href?: string;
}

const OVERRIDES: Record<string, ShowcaseOverride> = {
  'anime-list': {
    name: 'Shelf',
    desc: 'MAL explorer for anime and manga lists.',
    color: '#ec4899',
  },
  CodeVetter: {
    initials: 'Cv',
    tag: 'Desktop · core',
    desc: 'AI code review platform. Desktop-first, works offline.',
    color: '#10b981',
    size: 'tall',
  },
  'email-manager': {
    desc: 'Unified email management and automation.',
    color: '#3b82f6',
  },
  'free-ai': {
    name: 'Free AI',
    tag: 'Helper',
    desc: 'OpenAI-compatible gateway for free LLM providers.',
    color: '#fbbf24',
  },
  'alive-ville': {
    name: 'AliveVille',
    initials: 'Av',
    tag: 'Simulation · core',
    desc: 'A persistent AI world simulator. Multi-agent and RPG-shaped.',
    color: '#8b5cf6',
  },
  'high-signal': {
    name: 'High Signal',
    tag: 'Editorial · core',
    desc: 'A public signal log for AI infrastructure and semiconductors.',
    color: '#84cc16',
    size: 'wide',
  },
  looptv: {
    name: 'LoopTV',
    desc: 'TV-like app for curated YouTube channels.',
    color: '#a855f7',
  },
  'psi-swarm': {
    name: 'psi-swarm',
    tag: 'Helper',
    desc: 'Lighthouse swarms for p50/p75/p90/p99 Web Vitals.',
    color: '#22d3ee',
  },
  reader: {
    name: 'Reader',
    desc: 'Web annotator for documents and articles.',
    color: '#94a3b8',
  },
  'reel-pipeline': {
    name: 'Reel Pipeline',
    tag: 'Automation · core',
    desc: 'AI reel generation and autopost orchestration for fleet marketing.',
    color: '#c026d3',
    size: 'tall',
  },
  rolepatch: {
    name: 'RolePatch',
    initials: 'Rp',
    tag: 'AI · core',
    desc: 'AI-powered resume tailoring for a specific role and a specific story.',
    color: '#f43f5e',
    size: 'wide',
  },
  'saas-maker': {
    name: 'Foundry',
    initials: 'Fd',
    tag: 'Helper',
    desc: 'The open-source factory floor running underneath every other project on this page. Registry, feedback, changelog, tasks, audits, widgets, all behind one cockpit, one API, and one CLI.',
    color: '#e07b3a',
    size: 'feature',
    href: GITHUB_URL,
  },
  significanthobbies: {
    name: 'Significant Hobbies',
    desc: 'Personal hobby mapping and journey visualizer.',
    color: '#f472b6',
  },
  starboard: {
    name: 'Starboard',
    desc: 'Organize and filter your GitHub starred repos.',
    color: '#14b8a6',
  },
  'swe-interview-prep': {
    name: 'Interview Coder',
    desc: 'Interview prep tooling for engineers.',
    color: '#22c55e',
  },
  posttrainllm: {
    name: 'PostTrainLLM',
    initials: 'Pt',
    tag: 'Research · core',
    desc: 'A small language model, built from the ground up.',
    color: '#06b6d4',
  },
};

const SPOTLIGHT_ORDER = ['CodeVetter', 'high-signal', 'alive-ville', 'rolepatch'];

const HELPER_ORDER = ['saas-maker', 'free-ai', 'psi-swarm'];

const FALLBACK_COLORS = [
  '#e07b3a',
  '#10b981',
  '#c026d3',
  '#84cc16',
  '#8b5cf6',
  '#06b6d4',
  '#f43f5e',
  '#fbbf24',
  '#6366f1',
  '#14b8a6',
  '#94a3b8',
  '#3b82f6',
  '#f97316',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#0ea5e9',
  '#a8a29e',
  '#22c55e',
  '#f472b6',
  '#38bdf8',
];

const entries = Object.entries(registry as Record<string, RegistryProject>);

function titleCase(slug: string): string {
  return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function repoHref(url: string): string {
  const ssh = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  return url.replace(/\.git$/, '');
}

function projectHref(slug: string, project: RegistryProject): string {
  return OVERRIDES[slug]?.href ?? repoHref(project.url);
}

function isHelper(project: RegistryProject): boolean {
  return project.category === 'helper' || project.tier === 'helper';
}

function isSpotlight(project: RegistryProject): boolean {
  return (
    !isHelper(project) &&
    (project.priority === 'P0' || project.priority === 'P1' || project.tier === 'core')
  );
}

function priorityRank(project: RegistryProject): number {
  if (project.priority === 'P0') return 0;
  if (project.priority === 'P1') return 1;
  if (project.priority === 'P2') return 2;
  return 3;
}

function compareSpotlight(
  [a, aProject]: [string, RegistryProject],
  [b, bProject]: [string, RegistryProject]
): number {
  const priorityDiff = priorityRank(aProject) - priorityRank(bProject);
  if (priorityDiff !== 0) return priorityDiff;

  const aIndex = SPOTLIGHT_ORDER.indexOf(a);
  const bIndex = SPOTLIGHT_ORDER.indexOf(b);
  if (aIndex !== -1 || bIndex !== -1) {
    return (
      (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
      (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
    );
  }
  return a.localeCompare(b);
}

function toCoreProject([slug, project]: [string, RegistryProject], index: number): CoreProject {
  const override = OVERRIDES[slug] ?? {};
  const name = override.name ?? titleCase(slug);
  return {
    n: String(index + 1).padStart(3, '0'),
    name,
    initials: override.initials ?? initials(name),
    tag: override.tag ?? `${project.priority ?? project.tier ?? 'fleet'} · product`,
    desc: override.desc ?? project.desc,
    color: override.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    size: override.size ?? 'std',
    href: projectHref(slug, project),
  };
}

function toActiveProject([slug, project]: [string, RegistryProject], index: number): ActiveProject {
  const override = OVERRIDES[slug] ?? {};
  return {
    name: override.name ?? titleCase(slug),
    desc: override.desc ?? project.desc,
    color: override.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    href: projectHref(slug, project),
  };
}

const coreEntries = entries.filter(([, project]) => isSpotlight(project)).sort(compareSpotlight);
const helperEntries = entries
  .filter(([, project]) => isHelper(project))
  .sort(([a], [b]) => {
    const aIndex = HELPER_ORDER.indexOf(a);
    const bIndex = HELPER_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      return (
        (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
        (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
      );
    }
    return a.localeCompare(b);
  });
const activeEntries = entries
  .filter(([, project]) => !isSpotlight(project) && !isHelper(project))
  .sort(([a, aProject], [b, bProject]) => {
    const priorityDiff = priorityRank(aProject) - priorityRank(bProject);
    if (priorityDiff !== 0) return priorityDiff;
    return a.localeCompare(b);
  });

export const CORE: CoreProject[] = coreEntries.map(toCoreProject);
export const HELPERS: ActiveProject[] = helperEntries.map(toActiveProject);
export const ACTIVE: ActiveProject[] = activeEntries.map(toActiveProject);
export const PROJECT_COUNT = CORE.length + HELPERS.length + ACTIVE.length;
export const PRODUCT_COUNT = CORE.length + ACTIVE.length;
export const TICKER: string[] = [
  ...CORE.map((p) => p.name),
  ...HELPERS.map((p) => p.name),
  ...ACTIVE.map((p) => p.name),
];

export const SPEC: Array<[string, string]> = [
  ['Operator', 'Sarthak Agrawal'],
  ['Runtime', 'Cloudflare Workers · D1 · KV · R2'],
  ['Interfaces', 'REST · CLI · TypeScript SDK · Widgets'],
  ['Primitives', 'registry · feedback · changelog · tasks · audits · waitlist'],
  ['Projects', String(PROJECT_COUNT)],
  ['Helper systems', String(HELPERS.length)],
  ['Origin', '2024 →'],
  ['License', 'MIT'],
  ['Source', 'github.com/sarthak-fleet/saas-maker'],
];
