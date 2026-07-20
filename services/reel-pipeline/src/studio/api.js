import { generateIdeas, exploreNiche, suggestChannelNames } from './ideas.js';
import { generateTitles, generateDescription, generateTags, organizeTags } from './metadata.js';
import { generateScript } from './script.js';
import { deriveVoiceProfile } from './brand-voice.js';
import { researchKeywords } from './keywords.js';
import { fetchTranscript } from './transcript.js';
import { generateThumbnailConcepts } from './thumbnails.js';
import { IdeaStore } from './idea-store.js';
import { runFacelessWorkflow } from './workflow.js';
import { planIdeas, produceNext, factoryStatus } from './factory.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FACELESS_ENGINES = new Set(['mock', 'moneyprinterturbo', 'kokoro']);

function toolHandlers(options) {
  const llm = options.llm;
  const store = () => options.ideaStore ?? new IdeaStore(options.ideaStoreOptions);
  return {
    ideas: (body) => generateIdeas({ niche: body.niche, count: body.count, llm }),
    niche: (body) => exploreNiche({ niche: body.niche, llm }),
    channel: (body) => suggestChannelNames({ niche: body.niche, count: body.count, llm }),
    titles: (body) => generateTitles({ topic: body.topic, count: body.count, llm }),
    description: (body) => generateDescription({ topic: body.topic, hook: body.hook, cta: body.cta, llm }),
    tags: (body) => generateTags({ topic: body.topic, niche: body.niche, llm }),
    organize: (body) => organizeTags(Array.isArray(body.tags) ? body.tags : String(body.tags ?? '').split(',')),
    script: (body) => generateScript({
      topic: body.topic,
      durationSeconds: body.durationSeconds ?? body.duration,
      niche: body.niche,
      article: body.article,
      inspiration: body.inspiration,
      voiceProfile: body.voiceProfile,
      llm,
    }),
    voice: (body) => deriveVoiceProfile({
      transcripts: Array.isArray(body.samples) ? body.samples : [body.samples],
      llm,
    }),
    keywords: (body) => researchKeywords({ seed: body.seed, fetchImpl: options.fetchImpl ?? fetch }),
    transcript: (body) => fetchTranscript({ url: body.url, fetchImpl: options.fetchImpl ?? fetch }),
    thumbnails: (body) => generateThumbnailConcepts({ topic: body.topic, count: body.count, llm }),
    plan: (body) => planIdeas({ niche: body.niche, count: body.count, store: options.ideaStore, llm }),
    produce: (body) => produceNext({
      count: body.count,
      engine: FACELESS_ENGINES.has(body.engine) ? body.engine : 'kokoro',
      durationSeconds: body.durationSeconds ?? body.duration,
      store: options.ideaStore,
      outputDir: options.facelessOutputDir,
      rendererOptions: options.rendererOptions ?? {},
      llm,
      logger: options.logger ?? console,
    }),
    save: (body) => store().saveIdea(body),
    status: (body) => store().updateIdeaStatus(body.id, body.to ?? body.status),
    faceless: (body) => runFacelessWorkflow({
      topic: body.topic,
      niche: body.niche,
      durationSeconds: body.durationSeconds ?? body.duration,
      engine: FACELESS_ENGINES.has(body.engine) ? body.engine : 'mock',
      voice: body.voice,
      voiceRotation: Boolean(body.voiceRotation),
      voiceProfile: body.voiceProfile,
      outputDir: options.facelessOutputDir,
      ideaStore: options.ideaStore,
      rendererOptions: options.rendererOptions ?? {},
      llm,
      logger: options.logger ?? console,
    }),
  };
}

function artifactRoots(options) {
  const roots = options.artifactRoots ?? [
    path.resolve('tmp/studio'),
    path.resolve('artifacts'),
  ];
  return roots.map((root) => path.resolve(root));
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function listRenders(options) {
  const store = options.ideaStore ?? new IdeaStore(options.ideaStoreOptions);
  const ideas = await store.listIdeas();
  const renders = [];
  for (const idea of ideas) {
    if (idea.status !== 'rendered' && idea.status !== 'posted') continue;
    const artifactDir = idea.notes?.match(/artifacts: (.+)$/)?.[1];
    if (!artifactDir) continue;
    const render = await readJsonIfPresent(path.join(artifactDir, 'render.json'));
    const quality = await readJsonIfPresent(path.join(artifactDir, 'quality.json'));
    renders.push({
      ideaId: idea.id,
      title: idea.title,
      status: idea.status,
      updatedAt: idea.updatedAt,
      video: render?.videos?.[0] ?? null,
      provider: render?.provider ?? null,
      quality: quality ? { overall: quality.overall, verdict: quality.verdict, videoEvidence: quality.videoEvidence } : null,
      artifactDir,
    });
  }
  renders.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  return renders;
}

const FILE_TYPES = { '.mp4': 'video/mp4', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.json': 'application/json' };

async function serveRenderFile(rawPath, options) {
  const resolved = path.resolve(String(rawPath ?? ''));
  const roots = artifactRoots(options);
  if (!roots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
    return { status: 403, body: { error: 'path outside artifact roots' } };
  }
  const type = FILE_TYPES[path.extname(resolved).toLowerCase()];
  if (!type) return { status: 403, body: { error: 'unsupported file type' } };
  try {
    const content = await readFile(resolved);
    return { status: 200, raw: { content, contentType: type } };
  } catch {
    return { status: 404, body: { error: 'file not found' } };
  }
}

export async function handleStudioRequest(method, pathname, readBody, options = {}, query = {}) {
  if (!pathname.startsWith('/studio/')) return null;
  const tool = pathname.slice('/studio/'.length);

  if (method === 'GET' && tool === 'ideas-list') {
    const store = options.ideaStore ?? new IdeaStore(options.ideaStoreOptions);
    return { status: 200, body: { data: await store.listIdeas() } };
  }
  if (method === 'GET' && tool === 'renders-list') {
    return { status: 200, body: { data: await listRenders(options) } };
  }
  if (method === 'GET' && tool === 'render-file') {
    return serveRenderFile(query.path, options);
  }
  if (method === 'GET' && tool === 'factory-status') {
    const store = options.ideaStore ?? new IdeaStore(options.ideaStoreOptions);
    return { status: 200, body: { data: await factoryStatus({ store }) } };
  }
  if (method !== 'POST') return { status: 404, body: { error: 'not found' } };

  const handlers = toolHandlers(options);
  const handler = handlers[tool];
  if (!handler) return { status: 404, body: { error: `unknown studio tool: ${tool}` } };

  const body = await readBody();
  const data = await handler(body ?? {});
  return { status: 200, body: { data } };
}
