/**
 * Production health contracts for fleet smoke/monitoring/perf sweeps.
 *
 * `prodUrl: null` means no stable public URL is registered for automated checks —
 * NOT that the project lacks a website. See fleet-canonical-projects.md
 * ("Website vs prodUrl") before treating null prodUrl as "no web product."
 */
export const FLEET_HEALTH_CONTRACTS = {
  'anime-list': {
    displayName: 'MAL Explorer',
    prodUrl: 'https://anime-list-9lk.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project anime-list',
  },
  CodeVetter: {
    displayName: 'CodeVetter',
    prodUrl: 'https://codevetter.com',
    expectedStatus: 200,
    criticalRoutes: ['/', '/privacy', '/download', '/sitemap.xml', '/robots.txt'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Static landing page',
    githubWorkflow: null,
    smokeCommand: 'pnpm run fleet:prod-smoke --project CodeVetter',
  },
  drank: {
    displayName: 'drank',
    prodUrl: 'https://drank-sand.vercel.app',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Vercel',
    githubWorkflow: 'update-global-dr.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project drank',
  },
  'email-manager': {
    displayName: 'Email Manager',
    prodUrl: 'https://email-manager.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project email-manager',
  },
  'free-ai': {
    displayName: 'Free AI Gateway',
    prodUrl: 'https://free-ai-gateway.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/health', '/v1/models'],
    auth: { required: true, publicProbe: '/v1/models', protectedProbe: '/v1/chat/completions' },
    requiredEnv: {
      build: [],
      runtime: ['GATEWAY_API_KEY', 'OPENROUTER_API_KEY'],
    },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'cloudflare-deploy.yml',
    smokeCommand:
      'pnpm --dir ../free-ai test && curl --fail https://free-ai-gateway.sarthakagrawal927.workers.dev/health',
  },
  'alive-ville': {
    displayName: 'AI Game',
    prodUrl: 'https://aliveville.com',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project alive-ville',
  },
  'high-signal': {
    displayName: 'High Signal',
    prodUrl: 'https://highsignal.app',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project high-signal',
  },
  'knowledge-base': {
    displayName: 'Private Agent Search',
    prodUrl: 'https://knowledgebase.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/v1/healthz'],
    auth: { required: true, publicProbe: '/v1/healthz', protectedProbe: '/v1/indexes' },
    requiredEnv: { build: [], runtime: ['RAG_SERVICE_KEYS'] },
    deployTarget: 'Cloudflare Workers + D1 + Vectorize + R2',
    githubWorkflow: null,
    smokeCommand: 'curl --fail https://knowledgebase.sarthakagrawal927.workers.dev/v1/healthz',
  },
  karte: {
    displayName: 'Karte',
    prodUrl: 'https://linkchat.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project karte',
  },
  looptv: {
    displayName: 'LoopTV',
    prodUrl: 'https://looptv.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project looptv',
  },
  pace: {
    displayName: 'Pace',
    prodUrl: 'https://pace-6xg.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages (Astro landing) + macOS app',
    githubWorkflow: null,
    smokeCommand: 'pnpm run fleet:prod-smoke --project pace',
  },
  'psi-swarm': {
    displayName: 'psi-swarm',
    prodUrl: 'https://psi-swarm-web.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/', '/gallery'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages (Astro controller) + local CLI agent',
    githubWorkflow: null,
    smokeCommand: 'pnpm run fleet:prod-smoke --project psi-swarm',
  },
  reader: {
    displayName: 'Reader',
    prodUrl: 'https://reader.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/', '/login', '/api/auth/sign-in/social'],
    auth: { required: true, provider: 'google', smokeProbe: 'google-signin-provider-configured' },
    requiredEnv: {
      build: [],
      runtime: [
        'BETTER_AUTH_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'TURSO_AUTH_TOKEN',
        'TURSO_DATABASE_URL',
      ],
    },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project reader',
  },
  'research-papers': {
    displayName: 'Research Papers',
    prodUrl: null,
    expectedStatus: null,
    criticalRoutes: ['/health', '/api/stats', '/search'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Local FastAPI + ClickHouse + Astro dashboard',
    githubWorkflow: null,
    smokeCommand: null,
  },
  'reel-pipeline': {
    displayName: 'Reel Pipeline',
    prodUrl: 'https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/health'],
    auth: { required: false },
    monitoring: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Workers + R2',
    githubWorkflow: null,
    smokeCommand:
      'pnpm run check:cloudflare && REEL_ARTIFACT_BASE_URL=https://reel-pipeline-artifacts.sarthakagrawal927.workers.dev REEL_ARTIFACT_SMOKE_KEY=fixture-real-render.mp4 pnpm run smoke:artifact',
  },
  rolepatch: {
    displayName: 'RolePatch',
    prodUrl: 'https://rolepatch.com',
    expectedStatus: 200,
    criticalRoutes: ['/', '/pricing', '/dashboard', '/tools'],
    auth: { required: true },
    requiredEnv: {
      build: [],
      runtime: [
        'BETTER_AUTH_SECRET',
        ['AUTH_GOOGLE_ID', 'GOOGLE_CLIENT_ID'],
        ['AUTH_GOOGLE_SECRET', 'GOOGLE_CLIENT_SECRET'],
      ],
    },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project rolepatch',
  },
  'saas-maker': {
    displayName: 'SaaS Maker',
    prodUrl: 'https://app.sassmaker.com/login',
    expectedStatus: 200,
    criticalRoutes: [
      'https://app.sassmaker.com/login',
      'https://sassmaker.com',
      'https://docs.sassmaker.com',
    ],
    auth: {
      required: true,
      provider: 'google',
      smokeProbe: 'cockpit-google-signin-returns-oauth-url',
    },
    requiredEnv: {
      build: [],
      runtime: [
        'BETTER_AUTH_SECRET',
        ['AUTH_GOOGLE_ID', 'GOOGLE_CLIENT_ID'],
        ['AUTH_GOOGLE_SECRET', 'GOOGLE_CLIENT_SECRET'],
      ],
    },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm smoke && pnpm run fleet:prod-smoke --project saas-maker',
  },
  sarthakagrawal: {
    displayName: 'sarthakagrawal.dev',
    prodUrl: 'https://sarthakagrawal.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/', '/projects', '/about', '/resume'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project sarthakagrawal',
  },
  significanthobbies: {
    displayName: 'Significant Hobbies',
    prodUrl: 'https://significanthobbies.com',
    expectedStatus: 200,
    criticalRoutes: ['/', '/explore'],
    auth: { required: true },
    requiredEnv: {
      build: [],
      runtime: ['BETTER_AUTH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATABASE_URL'],
    },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project significanthobbies',
  },
  starboard: {
    displayName: 'Starboard',
    prodUrl: 'https://starboard.sarthakagrawal927.workers.dev',
    expectedStatus: 200,
    criticalRoutes: ['/'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] },
    deployTarget: 'Cloudflare Workers',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project starboard',
  },
  'swe-interview-prep': {
    displayName: 'Interview Coder',
    prodUrl: 'https://swe-interview-prep.pages.dev',
    expectedStatus: 200,
    criticalRoutes: ['/', '/api/auth/verify', '/api/auth/google'],
    auth: { required: true, provider: 'google', smokeProbe: 'google-auth-is-configured' },
    requiredEnv: {
      build: ['VITE_GOOGLE_CLIENT_ID'],
      runtime: ['GOOGLE_CLIENT_ID', 'JWT_SECRET', 'TURSO_AUTH_TOKEN', 'TURSO_DATABASE_URL'],
    },
    deployTarget: 'Cloudflare Pages',
    githubWorkflow: 'deploy.yml',
    smokeCommand: 'pnpm run fleet:prod-smoke --project swe-interview-prep',
  },
  posttrainllm: {
    displayName: 'posttrainllm',
    prodUrl: 'https://posttrainllm.com',
    expectedStatus: 200,
    criticalRoutes: ['/', '/devlog.html'],
    auth: { required: false },
    requiredEnv: { build: [], runtime: [] },
    deployTarget: 'Cloudflare Pages',
    githubWorkflow: null,
    smokeCommand: 'pnpm run fleet:prod-smoke --project posttrainllm',
  },

};

export function getHealthContract(project) {
  return FLEET_HEALTH_CONTRACTS[project] ?? null;
}

export function getHealthContractStatus(project, checks = []) {
  const contract = getHealthContract(project);
  if (!contract) return 'blocked';
  if (!contract.prodUrl || !contract.smokeCommand) return 'blocked';
  const projectChecks = checks.filter((check) => check.project === project);
  if (projectChecks.length === 0) return 'blocked';
  return projectChecks.every((check) => check.ok) ? 'pass' : 'fail';
}

export function listHealthContracts() {
  return Object.entries(FLEET_HEALTH_CONTRACTS).map(([project, contract]) => ({
    project,
    ...contract,
  }));
}
