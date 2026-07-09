import { generateIdeas, exploreNiche, suggestChannelNames } from './ideas.js';
import { generateTitles, generateDescription, generateTags, organizeTags } from './metadata.js';
import { generateScript } from './script.js';
import { deriveVoiceProfile } from './brand-voice.js';
import { researchKeywords } from './keywords.js';
import { fetchTranscript } from './transcript.js';
import { generateThumbnailConcepts } from './thumbnails.js';
import { IdeaStore } from './idea-store.js';
import { runFacelessWorkflow } from './workflow.js';

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

export async function handleStudioRequest(method, pathname, readBody, options = {}) {
  if (!pathname.startsWith('/studio/')) return null;
  const tool = pathname.slice('/studio/'.length);

  if (method === 'GET' && tool === 'ideas-list') {
    const store = options.ideaStore ?? new IdeaStore(options.ideaStoreOptions);
    return { status: 200, body: { data: await store.listIdeas() } };
  }
  if (method !== 'POST') return { status: 404, body: { error: 'not found' } };

  const handlers = toolHandlers(options);
  const handler = handlers[tool];
  if (!handler) return { status: 404, body: { error: `unknown studio tool: ${tool}` } };

  const body = await readBody();
  const data = await handler(body ?? {});
  return { status: 200, body: { data } };
}
