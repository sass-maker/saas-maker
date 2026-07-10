/**
 * Production health contracts for fleet smoke/monitoring/perf sweeps.
 *
 * `prodUrl: null` means no stable public URL is registered for automated checks —
 * NOT that the project lacks a website. See fleet-canonical-projects.md
 * ("Website vs prodUrl") before treating null prodUrl as "no web product."
 */
export const FLEET_HEALTH_CONTRACTS = {
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
