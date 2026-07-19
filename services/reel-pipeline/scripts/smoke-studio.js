#!/usr/bin/env node
// Offline readiness smoke for the content studio + faceless workflow.
// Every tool must succeed in template mode with no credentials or network.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { StudioLlm } from '../src/studio/llm.js';
import { generateIdeas, exploreNiche, suggestChannelNames } from '../src/studio/ideas.js';
import { generateTitles, generateDescription, generateTags } from '../src/studio/metadata.js';
import { generateScript } from '../src/studio/script.js';
import { deriveVoiceProfile } from '../src/studio/brand-voice.js';
import { researchKeywords } from '../src/studio/keywords.js';
import { generateThumbnailConcepts, renderConceptHtml } from '../src/studio/thumbnails.js';
import { IdeaStore } from '../src/studio/idea-store.js';
import { runFacelessWorkflow } from '../src/studio/workflow.js';

const offlineLlm = new StudioLlm({ apiKey: '' });
const offlineFetch = async () => { throw new Error('network disabled for smoke'); };
const silent = { info: () => {}, warn: () => {} };

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

const scratch = await mkdtemp(path.join(tmpdir(), 'studio-smoke-'));

await check('ideas', async () => {
  const result = await generateIdeas({ niche: 'home espresso', count: 5, llm: offlineLlm });
  if (result.data.ideas.length !== 5) throw new Error('expected 5 ideas');
});
await check('niche-explorer', () => exploreNiche({ niche: 'home espresso', llm: offlineLlm }));
await check('channel-names', () => suggestChannelNames({ niche: 'home espresso', llm: offlineLlm }));
await check('titles', () => generateTitles({ topic: 'latte art basics', llm: offlineLlm }));
await check('description', () => generateDescription({ topic: 'latte art basics', llm: offlineLlm }));
await check('tags', () => generateTags({ topic: 'latte art basics', llm: offlineLlm }));
await check('script-short', () => generateScript({ topic: 'latte art basics', durationSeconds: 60, llm: offlineLlm }));
await check('script-long', () => generateScript({ topic: 'latte art basics', durationSeconds: 600, llm: offlineLlm }));
await check('brand-voice', () => deriveVoiceProfile({ transcripts: ['Short punchy sample. It works! Try it now. Really simple stuff.'], llm: offlineLlm }));
await check('keywords-offline-fallback', async () => {
  const result = await researchKeywords({ seed: 'latte art', fetchImpl: offlineFetch, logger: silent });
  if (result.source !== 'template') throw new Error('expected template fallback');
});
await check('thumbnails', async () => {
  const result = await generateThumbnailConcepts({ topic: 'latte art basics', llm: offlineLlm });
  await renderConceptHtml(result.data.concepts[0], path.join(scratch, 'thumbs'));
});
await check('idea-store', async () => {
  const store = new IdeaStore({ filePath: path.join(scratch, 'ideas.json') });
  const idea = await store.saveIdea({ title: 'smoke idea' });
  await store.updateIdeaStatus(idea.id, 'scripted');
});
await check('faceless-workflow-mock', async () => {
  const summary = await runFacelessWorkflow({
    topic: 'latte art basics',
    engine: 'mock',
    outputDir: path.join(scratch, 'faceless'),
    ideaStore: new IdeaStore({ filePath: path.join(scratch, 'workflow-ideas.json') }),
    rendererOptions: { mock: { artifactDir: path.join(scratch, 'renders') } },
    llm: offlineLlm,
    logger: silent,
  });
  if (summary.renderStatus !== 'completed') throw new Error('mock render did not complete');
});

const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.error ? ` — ${entry.error}` : ''}`);
}
console.log(`\nstudio smoke: ${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
