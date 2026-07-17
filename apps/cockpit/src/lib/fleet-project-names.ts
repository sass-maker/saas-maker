type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

export const ACTIVE_FLEET_PROJECTS = {
  anime_list: {
    name: 'MAL Explorer',
    desc: 'Browse and manage your anime/manga lists.',
    tier: 'active-ai',
    url: 'https://github.com/Significant-Hobbies/anime-list.git',
    externalDeps: ['Turso', 'Google OAuth', 'PostHog', 'Jikan/MyAnimeList'],
  },
  CodeVetter: {
    name: 'CodeVetter',
    desc: 'AI code review platform - desktop-first, works offline.',
    tier: 'core',
    url: 'git@github.com:Codevetter/codevetter.git',
    externalDeps: ['GitHub', 'Anthropic', 'OpenAI', 'OpenRouter'],
  },
  drank: {
    name: 'drank',
    desc: 'Domain Rating tracker with personal watchlists and a shared Ahrefs DR leaderboard.',
    tier: 'active-ai',
    url: 'https://github.com/High-Signal-App/drank.git',
    externalDeps: ['Ahrefs', 'GitHub Actions', 'Vercel'],
  },
  'email-manager': {
    name: 'Email Manager',
    desc: 'Unified email management and automation tool.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/email-manager.git',
    externalDeps: ['Gmail API', 'Google OAuth', 'Cloudflare D1', 'PostHog'],
  },
  'event-forecast': {
    name: 'Event Forecast',
    desc: 'Time-series forecasting product for event, order, and operations streams.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/forecast-lab.git',
    externalDeps: [],
  },
  everythingrated: {
    name: 'everythingrated',
    desc: 'Ratings and review-style app.',
    tier: 'active-ai',
    url: 'https://github.com/High-Signal-App/everythingrated.git',
    externalDeps: ['Cloudflare D1', 'PostHog', 'Rate Limiter'],
  },
  'free-ai': {
    name: 'Free AI Gateway',
    desc: 'OpenAI-compatible API gateway for free LLM providers.',
    tier: 'active-ai',
    url: 'https://github.com/sass-maker/free-ai.git',
    externalDeps: [
      'Cloudflare D1',
      'Durable Objects',
      'KV',
      'Workers AI',
      'Groq',
      'Gemini',
      'OpenRouter',
      'Cerebras',
      'SambaNova',
      'NVIDIA',
      'Voyage',
    ],
  },
  'ai-game': {
    name: 'ai-game',
    desc: 'Persistent AI world simulator - interactive RPG-style multi-agent game.',
    tier: 'core',
    url: 'https://github.com/sarthakagrawal927/ai-game.git',
    externalDeps: ['free-ai gateway'],
  },
  'high-signal': {
    name: 'High Signal',
    desc: 'Public signal log for AI infrastructure and semiconductors.',
    tier: 'core',
    url: 'https://github.com/High-Signal-App/high-signal.git',
    externalDeps: [
      'Cloudflare D1',
      'PostHog',
      'DeepSeek',
      'SEC EDGAR',
      'Reddit',
      'GitHub',
      'YouTube',
      'GDELT',
      'HKEX',
      'Prediction markets',
    ],
  },
  knowledgebase: {
    name: 'Private Agent Search',
    desc: 'Exa-style search and cited query APIs for private project corpora.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/knowledge-base.git',
    externalDeps: ['FastAPI', 'Postgres', 'Qdrant', 'MinIO'],
  },
  linkchat: {
    name: 'Linkchat',
    desc: 'Real-time chat application built with Next.js.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/karte.git',
    externalDeps: [
      'Turso',
      'Cloudflare D1',
      'Google OAuth',
      'Cloudflare R2',
      'PostHog',
      'Analytics Engine',
      'free-ai gateway',
    ],
  },
  looptv: {
    name: 'LoopTV',
    desc: 'TV-like app for YouTube curated channels.',
    tier: 'active-ai',
    url: 'https://github.com/Significant-Hobbies/looptv.git',
    externalDeps: ['YouTube IFrame API', 'YouTube Data API', 'PostHog', 'GitHub Actions'],
  },
  'open-historia': {
    name: 'Open Historia',
    desc: 'Interactive historical timeline and storytelling platform.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/open-historia.git',
    externalDeps: [
      'Turso',
      'Google OAuth',
      'free-ai gateway',
      'Anthropic',
      'OpenAI',
      'Gemini',
      'Rate Limiter',
    ],
  },
  pace: {
    name: 'Pace',
    desc: 'Local macOS menu-bar voice agent.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/clicky.git',
    externalDeps: ['macOS'],
  },
  'psi-swarm': {
    name: 'psi-swarm',
    desc: 'Local CLI and browser controller for repeated Lighthouse audits.',
    tier: 'active-ai',
    url: 'https://github.com/sass-maker/psi-swarm.git',
    externalDeps: ['Lighthouse', 'Chrome'],
  },
  reader: {
    name: 'Reader',
    desc: 'Document reading and annotation tool.',
    tier: 'active-ai',
    url: 'https://github.com/Significant-Hobbies/reader.git',
    externalDeps: [
      'Turso',
      'Google OAuth',
      'Cloudflare R2',
      'free-ai gateway',
      'OpenAI',
      'Anthropic',
      'Gemini',
    ],
  },
  researchPapers: {
    name: 'Research Papers',
    desc: 'Academic-paper intelligence platform with search, ranking, and research dashboards.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/researchPapers.git',
    externalDeps: ['ClickHouse'],
  },
  'reel-pipeline': {
    name: 'Reel Pipeline',
    desc: 'AI reel generation product with short-form video render artifacts.',
    tier: 'core',
    url: 'https://github.com/sass-maker/reel-pipeline.git',
    externalDeps: ['Cloudflare Workers', 'Cloudflare R2'],
  },
  'resume-tailor': {
    name: 'RolePatch',
    desc: 'AI-powered resume tailoring system.',
    tier: 'core',
    url: 'git@github.com:sarthakagrawal927/rolepatch.git',
    externalDeps: [
      'Turso',
      'Google OAuth',
      'free-ai gateway',
      'Cloudflare Browser Rendering',
      'PostHog',
    ],
  },
  'saas-maker': {
    name: 'SaaS Maker',
    desc: 'Foundry - The Industrial Software Factory for Project Fleets.',
    tier: 'core',
    url: 'https://github.com/sass-maker/saas-maker.git',
    externalDeps: ['Cloudflare D1', 'Google OAuth', 'PostHog', 'Cloudflare Email', 'GitHub'],
  },
  sarthakagrawal: {
    name: 'sarthakagrawal.dev',
    desc: 'Personal Astro portfolio and project archive.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/portfolio.git',
    externalDeps: ['Cloudflare Pages'],
  },
  significanthobbies: {
    name: 'Significant Hobbies',
    desc: 'Personal hobby mapping and journey visualization tool.',
    tier: 'active-ai',
    url: 'https://github.com/Significant-Hobbies/significanthobbies.git',
    externalDeps: ['Turso', 'Google OAuth', 'PostHog'],
  },
  starboard: {
    name: 'Starboard',
    desc: 'AI-built project management and dashboard system.',
    tier: 'active-ai',
    url: 'https://github.com/Codevetter/starboard.git',
    externalDeps: [
      'Turso',
      'GitHub OAuth',
      'GitHub API',
      'Workers AI',
      'free-ai gateway',
      'PostHog',
    ],
  },
  'swe-interview-prep': {
    name: 'Interview Coder',
    desc: 'Software engineering interview prep.',
    tier: 'active-ai',
    url: 'https://github.com/Significant-Hobbies/swe-interview-prep.git',
    externalDeps: [
      'Turso',
      'Google One Tap',
      'Cloudflare R2',
      'PostHog',
      'OpenAI',
      'Anthropic',
      'Gemini',
      'DeepSeek',
    ],
  },
  posttrainllm: {
    name: 'PostTrainLLM',
    desc: 'Local LLM factory, runtime, and model-learning workspace.',
    tier: 'core',
    url: 'https://github.com/PostTrainLLM/posttrainllm.git',
    externalDeps: [],
  },
  truehire: {
    name: 'TrueHire',
    desc: 'AI-powered recruitment and candidate vetting platform.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/truehire.git',
    externalDeps: ['Turso', 'GitHub OAuth', 'GitHub API'],
  },
  'verified-bases': {
    name: 'Verified Bases',
    desc: 'Personal verified-software storefront with paid delivery and creator collaboration intake.',
    tier: 'active-ai',
    url: 'https://github.com/sarthakagrawal927/verified-bases.git',
    externalDeps: [
      'Cloudflare D1',
      'Cloudflare KV',
      'Cloudflare R2',
      'Turnstile',
      'Dodo Payments',
      'Resend',
    ],
  },
} as const;

export type ActiveFleetProjectSlug = keyof typeof ACTIVE_FLEET_PROJECTS;

export const HIDDEN_FLEET_PROJECT_ALIASES = new Set([
  'a',
  'back-propogate',
  'back-propagate',
  'chess',
  'clash royale meta',
  'clash-royale-meta',
  'dev learning',
  'dev_learning',
  'dev-learning',
  'ludo',
  'local-ai',
  'personal site',
  'personalsite',
  'port-whisperer',
  'reel maker',
  'reel-maker',
  'sarthak blog',
  'sarthak-blog',
  'vaulthealth',
]);

const ACTIVE_FLEET_SLUGS_BY_NORMALIZED_VALUE = new Map(
  Object.keys(ACTIVE_FLEET_PROJECTS).map((slug) => [
    slug.toLowerCase(),
    slug as ActiveFleetProjectSlug,
  ])
);

const ACTIVE_FLEET_NAMES_BY_NORMALIZED_VALUE = new Map(
  Object.entries(ACTIVE_FLEET_PROJECTS).map(([slug, project]) => [
    project.name.toLowerCase(),
    slug as ActiveFleetProjectSlug,
  ])
);

function normalizeIdentity(value?: string | null) {
  return value?.trim().toLowerCase();
}

function getActiveFleetSlug(project: ProjectIdentity) {
  const name = normalizeIdentity(project.name);
  const slug = normalizeIdentity(project.slug);

  if (slug && ACTIVE_FLEET_SLUGS_BY_NORMALIZED_VALUE.has(slug)) {
    return ACTIVE_FLEET_SLUGS_BY_NORMALIZED_VALUE.get(slug);
  }
  if (name && ACTIVE_FLEET_NAMES_BY_NORMALIZED_VALUE.has(name)) {
    return ACTIVE_FLEET_NAMES_BY_NORMALIZED_VALUE.get(name);
  }

  return undefined;
}

export function isActiveFleetProject(project: ProjectIdentity) {
  return getActiveFleetSlug(project) !== undefined;
}

export function isHiddenFleetProject(project: ProjectIdentity) {
  const name = normalizeIdentity(project.name);
  const slug = normalizeIdentity(project.slug);

  return (
    (name !== undefined && HIDDEN_FLEET_PROJECT_ALIASES.has(name)) ||
    (slug !== undefined && HIDDEN_FLEET_PROJECT_ALIASES.has(slug)) ||
    !isActiveFleetProject(project)
  );
}

export function getCanonicalProjectName(slug?: string | null, fallback?: string | null) {
  const activeSlug = getActiveFleetSlug({ slug, name: fallback });
  if (activeSlug) {
    return ACTIVE_FLEET_PROJECTS[activeSlug].name;
  }

  return fallback?.trim() || slug?.trim() || 'Unassigned';
}

export function getActiveFleetProjectDetails(project: ProjectIdentity) {
  const activeSlug = getActiveFleetSlug(project);
  return activeSlug ? { slug: activeSlug, ...ACTIVE_FLEET_PROJECTS[activeSlug] } : null;
}

export function formatProjectLabel(slug?: string | null) {
  if (!slug) return 'Unassigned';
  const name = getCanonicalProjectName(slug);
  return name === slug ? slug : `${name} (${slug})`;
}

export function sortProjectSlugs(slugs: string[]) {
  return [...slugs].sort((a, b) => {
    const labelA = getCanonicalProjectName(a);
    const labelB = getCanonicalProjectName(b);
    return labelA.localeCompare(labelB) || a.localeCompare(b);
  });
}
