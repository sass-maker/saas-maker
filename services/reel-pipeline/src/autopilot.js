import { readFile } from 'node:fs/promises';
import { SaaSMakerClient } from './saas-maker-client.js';
import {
  postReadyMarketingVideos,
  createPostingProvider,
} from './posting.js';
import { renderAcceptedMarketingPosts } from './pipeline.js';
import { loadSocialAccountsConfig } from './config/social-accounts.js';

export function createFixtureClient(initialPosts = []) {
  const posts = initialPosts.map((post) => ({ ...post }));
  const updates = [];
  return {
    posts,
    updates,
    listMarketingPosts: async (filters = {}) => {
      return posts.filter((post) => {
        if (filters.status && post.status !== filters.status) return false;
        if (filters.project_slug && post.project_slug !== filters.project_slug) return false;
        if (filters.channel && post.channel !== filters.channel) return false;
        return true;
      });
    },
    updateMarketingPost: async (id, patch) => {
      const target = posts.find((post) => post.id === id);
      if (target) Object.assign(target, patch);
      updates.push({ id, patch });
      return { skipped: false, data: target ?? { id, ...patch } };
    },
  };
}

export async function loadFixtureClient(path) {
  const raw = JSON.parse(await readFile(path, 'utf8'));
  const posts = Array.isArray(raw) ? raw : (raw.data ?? raw.posts ?? []);
  return createFixtureClient(posts);
}

export async function runAutopilotTick(options = {}) {
  const client = options.saasMakerClient ?? new SaaSMakerClient(options.saasMaker);
  const now = options.now ?? new Date();
  const log = options.log ?? (() => {});
  const limit = Number(options.limit ?? process.env.AUTOPILOT_LIMIT ?? 10);

  const accepted = await autoAcceptIntake({
    log,
  });

  log(`▸ render: scanning accepted marketing posts`);
  const rendered = await renderAcceptedMarketingPosts({
    ...options.render,
    saasMakerClient: client,
    limit,
  });
  log(`✓ render: scanned=${rendered.scanned} eligible=${rendered.eligible} results=${rendered.results.length}`);

  const provider = options.postingProvider ?? buildDefaultPostingProvider(options);
  log(`▸ post: posting ready marketing videos`);
  const posted = await postReadyMarketingVideos({
    ...options.posting,
    saasMakerClient: client,
    provider,
    confirmPost: true,
    includeUnscheduled: true,
    limit,
  });
  log(`✓ post: scanned=${posted.scanned} results=${posted.results.length}`);

  return { accepted, rendered, posted };
}

export async function autoAcceptIntake(options) {
  options.log('intake: automatic acceptance disabled; explicit approval required');
  return [];
}

function buildDefaultPostingProvider(options) {
  const accounts = options.accounts;
  if (!accounts) throw new Error('runAutopilotTick requires options.accounts (resolved social-accounts config)');
  return createPostingProvider('auto', {
    youtube: { accounts: accounts.youtube ?? {} },
    instagram: { accounts: accounts.instagram ?? {} },
  });
}

export async function loadAutopilotAccounts() {
  return loadSocialAccountsConfig();
}
