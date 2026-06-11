import { readFile } from 'node:fs/promises';
import { postReadyMarketingVideos } from '../src/posting.js';

const args = parseArgs(process.argv.slice(2));

const result = await postReadyMarketingVideos({
  providerMode: args.provider ?? process.env.REEL_POST_PROVIDER ?? 'manual',
  limit: Number(args.limit ?? process.env.REEL_POST_LIMIT ?? 5),
  channel: args.channel,
  projectSlug: args.project,
  includeUnscheduled: parseBool(args.includeUnscheduled ?? args['include-unscheduled']),
  confirmPost: parseBool(args.confirm ?? args['confirm-post']),
  ...(args.fixture ? { saasMakerClient: await fixtureClient(args.fixture) } : {}),
});

console.log(JSON.stringify(result, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function fixtureClient(file) {
  const posts = JSON.parse(await readFile(file, 'utf8'));
  return {
    listMarketingPosts: async () => Array.isArray(posts) ? posts : posts.data,
    updateMarketingPost: async (id, patch) => ({ skipped: false, data: { id, ...patch } }),
  };
}

function parseBool(value) {
  if (value === undefined || value === null || value === '') return false;
  if (value === true) return true;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}
