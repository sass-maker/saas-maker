type ProjectIdentity = {
  name?: string | null;
  slug?: string | null;
};

export const ACTIVE_FLEET_PROJECTS = {
  anime_list: {
    name: "MAL Explorer",
    desc: "Browse and manage your anime/manga lists.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/anime_list.git",
    externalDeps: ["Turso", "Google OAuth", "PostHog", "Jikan/MyAnimeList"],
  },
  CodeVetter: {
    name: "CodeVetter",
    desc: "AI code review platform - desktop-first, works offline.",
    tier: "core",
    url: "git@github.com:sarthakagrawal927/CodeVetter.git",
    externalDeps: ["GitHub", "Anthropic", "OpenAI", "OpenRouter"],
  },
  "email-manager": {
    name: "Email Manager",
    desc: "Unified email management and automation tool.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/email-manager.git",
    externalDeps: ["Gmail API", "Google OAuth", "Cloudflare D1", "PostHog"],
  },
  everythingrated: {
    name: "everythingrated",
    desc: "Ratings and review-style app.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/everythingrated.git",
    externalDeps: ["Cloudflare D1", "PostHog", "Rate Limiter"],
  },
  "free-ai": {
    name: "Free AI Gateway",
    desc: "OpenAI-compatible API gateway for free LLM providers.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/free-ai.git",
    externalDeps: ["Cloudflare D1", "Durable Objects", "KV", "Workers AI", "Groq", "Gemini", "OpenRouter", "Cerebras", "SambaNova", "NVIDIA", "Voyage"],
  },
  "ai-game": {
    name: "ai-game",
    desc: "Persistent AI world simulator - interactive RPG-style multi-agent game.",
    tier: "core",
    url: "https://github.com/sarthakagrawal927/ai-game.git",
    externalDeps: ["free-ai gateway"],
  },
  "high-signal": {
    name: "High Signal",
    desc: "Public signal log for AI infrastructure and semiconductors.",
    tier: "core",
    url: "https://github.com/sarthakagrawal927/high-signal.git",
    externalDeps: ["Cloudflare D1", "PostHog", "DeepSeek", "SEC EDGAR", "Reddit", "GitHub", "YouTube", "GDELT", "HKEX", "Prediction markets"],
  },
  linkchat: {
    name: "Linkchat",
    desc: "Real-time chat application built with Next.js.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/linkchat.git",
    externalDeps: ["Turso", "Cloudflare D1", "Google OAuth", "Cloudflare R2", "PostHog", "Analytics Engine", "free-ai gateway"],
  },
  looptv: {
    name: "LoopTV",
    desc: "TV-like app for YouTube curated channels.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/looptv.git",
    externalDeps: ["YouTube IFrame API", "YouTube Data API", "PostHog", "GitHub Actions"],
  },
  "open-historia": {
    name: "Open Historia",
    desc: "Interactive historical timeline and storytelling platform.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/open-historia.git",
    externalDeps: ["Turso", "Google OAuth", "free-ai gateway", "Anthropic", "OpenAI", "Gemini", "Rate Limiter"],
  },
  reader: {
    name: "Reader",
    desc: "Document reading and annotation tool.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/reader.git",
    externalDeps: ["Turso", "Google OAuth", "Cloudflare R2", "free-ai gateway", "OpenAI", "Anthropic", "Gemini"],
  },
  "resume-tailor": {
    name: "RolePatch",
    desc: "AI-powered resume tailoring system.",
    tier: "core",
    url: "git@github.com:sarthakagrawal927/resume-tailor.git",
    externalDeps: ["Turso", "Google OAuth", "free-ai gateway", "Cloudflare Browser Rendering", "PostHog"],
  },
  "saas-maker": {
    name: "SaaS Maker",
    desc: "Foundry - The Industrial Software Factory for Project Fleets.",
    tier: "core",
    url: "https://github.com/sarthakagrawal927/saas-maker.git",
    externalDeps: ["Cloudflare D1", "Google OAuth", "PostHog", "Cloudflare Email", "GitHub"],
  },
  significanthobbies: {
    name: "Significant Hobbies",
    desc: "Personal hobby mapping and journey visualization tool.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/significanthobbies.git",
    externalDeps: ["Turso", "Google OAuth", "PostHog"],
  },
  starboard: {
    name: "Starboard",
    desc: "AI-built project management and dashboard system.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/starboard.git",
    externalDeps: ["Turso", "GitHub OAuth", "GitHub API", "Workers AI", "free-ai gateway", "PostHog"],
  },
  "swe-interview-prep": {
    name: "Interview Coder",
    desc: "Software engineering interview prep.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/swe-interview-prep.git",
    externalDeps: ["Turso", "Google One Tap", "Cloudflare R2", "PostHog", "OpenAI", "Anthropic", "Gemini", "DeepSeek"],
  },
  tinygpt: {
    name: "TinyGPT",
    desc: "TinyGPT.",
    tier: "core",
    url: "https://github.com/sarthakagrawal927/tinygpt.git",
    externalDeps: [],
  },
  "today-little-log": {
    name: "Today Little Log",
    desc: "Daily logging and micro-journaling application.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/today-little-log.git",
    externalDeps: ["Turso", "Google OAuth", "free-ai gateway", "PostHog"],
  },
  truehire: {
    name: "TrueHire",
    desc: "AI-powered recruitment and candidate vetting platform.",
    tier: "active-ai",
    url: "https://github.com/sarthakagrawal927/truehire.git",
    externalDeps: ["Turso", "GitHub OAuth", "GitHub API"],
  },
} as const;

export type ActiveFleetProjectSlug = keyof typeof ACTIVE_FLEET_PROJECTS;

export const HIDDEN_FLEET_PROJECT_ALIASES = new Set([
  "a",
  "back-propogate",
  "back-propagate",
  "chess",
  "clash royale meta",
  "clash-royale-meta",
  "dev learning",
  "dev_learning",
  "dev-learning",
  "ludo",
  "personal site",
  "personalsite",
  "port-whisperer",
  "reel maker",
  "reel-maker",
  "sarthak blog",
  "sarthak-blog",
  "vaulthealth",
]);

const ACTIVE_FLEET_SLUGS_BY_NORMALIZED_VALUE = new Map(
  Object.keys(ACTIVE_FLEET_PROJECTS).map((slug) => [slug.toLowerCase(), slug as ActiveFleetProjectSlug])
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

  return fallback?.trim() || slug?.trim() || "Unassigned";
}

export function getActiveFleetProjectDetails(project: ProjectIdentity) {
  const activeSlug = getActiveFleetSlug(project);
  return activeSlug ? { slug: activeSlug, ...ACTIVE_FLEET_PROJECTS[activeSlug] } : null;
}

export function formatProjectLabel(slug?: string | null) {
  if (!slug) return "Unassigned";
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
