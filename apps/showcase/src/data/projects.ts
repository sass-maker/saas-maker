// Fleet inventory — verbatim port of the constants in the original
// apps/showcase/app/page.js. Both CORE (bento) and ACTIVE (mini list)
// are consumed by src/components/Fleet.astro; TICKER is consumed by
// src/components/Ticker.astro.

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

export const CORE: CoreProject[] = [
  {
    n: '001', name: 'Foundry', initials: 'Fd', tag: 'Operating layer',
    desc: 'The open-source factory floor running underneath every other project on this page. Registry, feedback, changelog, tasks, audits, widgets — one cockpit, one API, one CLI.',
    color: '#e07b3a', size: 'feature', href: GITHUB_URL,
  },
  {
    n: '002', name: 'CodeVetter', initials: 'Cv', tag: 'Desktop · core',
    desc: 'AI code review platform. Desktop-first, works offline.',
    color: '#10b981', size: 'tall', href: 'https://github.com/sarthak-fleet/CodeVetter',
  },
  {
    n: '003', name: 'Reel Pipeline', initials: 'Rp', tag: 'Automation · core',
    desc: 'AI reel generation and autopost orchestration for fleet marketing.',
    color: '#c026d3', size: 'tall', href: 'https://github.com/sarthak-fleet/reel-pipeline',
  },
  {
    n: '004', name: 'High Signal', initials: 'Hs', tag: 'Editorial · core',
    desc: 'A public signal log for AI infrastructure and semiconductors.',
    color: '#84cc16', size: 'wide', href: 'https://github.com/sarthak-fleet/high-signal',
  },
  {
    n: '005', name: 'AI Game', initials: 'Ag', tag: 'Simulation · core',
    desc: 'A persistent AI world simulator — interactive, multi-agent, RPG-shaped.',
    color: '#8b5cf6', size: 'std', href: 'https://github.com/sarthakagrawal927/ai-game',
  },
  {
    n: '006', name: 'TinyGPT', initials: 'Tg', tag: 'Research · core',
    desc: 'A small language model, built from the ground up.',
    color: '#06b6d4', size: 'std', href: 'https://github.com/sarthak-fleet/tinygpt',
  },
  {
    n: '007', name: 'RolePatch', initials: 'Rt', tag: 'AI · core',
    desc: 'AI-powered resume tailoring for a specific role and a specific story.',
    color: '#f43f5e', size: 'wide', href: 'https://github.com/sarthak-fleet/resume-tailor',
  },
];

export const ACTIVE: ActiveProject[] = [
  { name: 'free-ai', desc: 'OpenAI-compatible gateway for free LLM providers.', color: '#fbbf24', href: 'https://github.com/sarthak-fleet/free-ai' },
  { name: 'truehire', desc: 'AI-powered candidate vetting platform.', color: '#6366f1', href: 'https://github.com/sarthak-fleet/truehire' },
  { name: 'starboard', desc: 'AI-built project management dashboard.', color: '#14b8a6', href: 'https://github.com/sarthak-fleet/starboard' },
  { name: 'reader', desc: 'Web annotator for documents and articles.', color: '#94a3b8', href: 'https://github.com/sarthak-fleet/reader' },
  { name: 'email-manager', desc: 'Unified email management and automation.', color: '#3b82f6', href: 'https://github.com/sarthak-fleet/email-manager' },
  { name: 'open-historia', desc: 'Interactive historical timeline platform.', color: '#f97316', href: 'https://github.com/sarthak-fleet/open-historia' },
  { name: 'everythingrated', desc: 'Ratings and reviews — for everything.', color: '#ef4444', href: 'https://github.com/sarthak-fleet/everythingrated' },
  { name: 'looptv', desc: 'TV-like app for curated YouTube channels.', color: '#a855f7', href: 'https://github.com/sarthak-fleet/looptv' },
  { name: 'anime_list', desc: 'MAL explorer for anime and manga lists.', color: '#ec4899', href: 'https://github.com/sarthak-fleet/anime_list' },
  { name: 'linkchat', desc: 'Real-time chat, built with Next.js.', color: '#0ea5e9', href: 'https://github.com/sarthak-fleet/linkchat' },
  { name: 'today-little-log', desc: 'Daily logging and micro-journaling.', color: '#a8a29e', href: 'https://github.com/sarthak-fleet/today-little-log' },
  { name: 'swe-interview-prep', desc: 'Interview prep tooling for engineers.', color: '#22c55e', href: 'https://github.com/sarthak-fleet/swe-interview-prep' },
  { name: 'significanthobbies', desc: 'Personal hobby mapping and journey visualizer.', color: '#f472b6', href: 'https://github.com/sarthak-fleet/significanthobbies' },
];

export const TICKER: string[] = [...CORE.map((p) => p.name), ...ACTIVE.map((p) => p.name)];

export const SPEC: Array<[string, string]> = [
  ['Operator', 'Sarthak Agrawal'],
  ['Runtime', 'Cloudflare Workers · D1 · KV · R2'],
  ['Interfaces', 'REST · CLI · TypeScript SDK · Widgets'],
  ['Primitives', 'registry · feedback · changelog · tasks · audits · waitlist'],
  ['Origin', '2024 →'],
  ['License', 'MIT'],
  ['Source', 'github.com/sarthak-fleet/saas-maker'],
];
