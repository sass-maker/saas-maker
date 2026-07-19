import assert from 'node:assert/strict';
import { mkdtemp, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { StudioLlm } from '../src/studio/llm.js';
import { IdeaStore } from '../src/studio/idea-store.js';
import { generateScript } from '../src/studio/script.js';
import { scriptToBrief, runFacelessWorkflow, runBatch } from '../src/studio/workflow.js';

const offlineLlm = new StudioLlm({ apiKey: '' });
const silent = { info: () => {}, warn: () => {} };

async function tempDir(prefix) {
  return mkdtemp(path.join(tmpdir(), prefix));
}

test('idea store saves, lists, and updates status', async () => {
  const dir = await tempDir('studio-ideas-');
  const store = new IdeaStore({ filePath: path.join(dir, 'ideas.json') });
  const idea = await store.saveIdea({ title: 'Test idea', niche: 'testing' });
  assert.equal(idea.status, 'new');
  const listed = await store.listIdeas();
  assert.equal(listed.length, 1);
  const updated = await store.updateIdeaStatus(idea.id, 'scripted');
  assert.equal(updated.status, 'scripted');
  await assert.rejects(() => store.updateIdeaStatus(idea.id, 'bogus'), /unsupported idea status/);
  await assert.rejects(() => store.saveIdea({}), /requires a title/);
});

test('scriptToBrief produces a valid brief with a single voice by default', async () => {
  const script = await generateScript({ topic: 'meal prep basics', durationSeconds: 60, llm: offlineLlm });
  const { brief, voicePlan } = scriptToBrief(script, { engine: 'mock' });
  assert.equal(brief.channel, 'youtube_shorts');
  assert.equal(brief.renderMode, 'mock');
  assert.equal(voicePlan.rotation, false);
  assert.equal(new Set(voicePlan.scenes.map((scene) => scene.voice)).size, 1);
});

test('voice rotation requires explicit opt-in', async () => {
  const script = await generateScript({ topic: 'meal prep basics', durationSeconds: 60, llm: offlineLlm });
  const { voicePlan } = scriptToBrief(script, { engine: 'mock', voiceRotation: true });
  assert.equal(voicePlan.rotation, true);
  assert.ok(new Set(voicePlan.scenes.map((scene) => scene.voice)).size > 1);
});

test('long-form scripts clamp the brief duration without losing script length', async () => {
  const script = await generateScript({ topic: 'the history of aviation', durationSeconds: 600, llm: offlineLlm });
  const { brief } = scriptToBrief(script, { engine: 'mock' });
  assert.equal(brief.durationSeconds, 90);
  assert.equal(script.targetDurationSeconds, 600);
});

test('faceless workflow runs mock end-to-end and writes artifacts', async () => {
  const out = await tempDir('studio-faceless-');
  const storeDir = await tempDir('studio-store-');
  const summary = await runFacelessWorkflow({
    topic: 'five minute stretching routine',
    durationSeconds: 60,
    engine: 'mock',
    outputDir: out,
    ideaStore: new IdeaStore({ filePath: path.join(storeDir, 'ideas.json') }),
    rendererOptions: { mock: { artifactDir: path.join(out, 'renders') } },
    llm: offlineLlm,
    logger: silent,
  });
  assert.equal(summary.renderStatus, 'completed');
  assert.ok(summary.video);
  for (const file of ['script.json', 'brief.json', 'metadata.json', 'render.json']) {
    await access(path.join(summary.artifactDir, file));
  }
  const metadata = JSON.parse(await readFile(path.join(summary.artifactDir, 'metadata.json'), 'utf8'));
  assert.ok(metadata.titles.length >= 5);
  assert.ok(metadata.tags.length >= 1);
  assert.equal(metadata.voicePlan.rotation, false);
});

test('workflow does not auto-post and surfaces the handoff command only on request', async () => {
  const out = await tempDir('studio-faceless-');
  const storeDir = await tempDir('studio-store-');
  const base = {
    topic: 'desk posture fixes',
    engine: 'mock',
    outputDir: out,
    ideaStore: new IdeaStore({ filePath: path.join(storeDir, 'ideas.json') }),
    rendererOptions: { mock: { artifactDir: path.join(out, 'renders') } },
    llm: offlineLlm,
    logger: silent,
  };
  const without = await runFacelessWorkflow(base);
  assert.equal(without.postHandoff, null);
  const withHandoff = await runFacelessWorkflow({ ...base, postHandoff: true });
  assert.match(withHandoff.postHandoff.command, /post:ready/);
});

test('batch isolates per-topic failures and reports the split', async () => {
  const out = await tempDir('studio-batch-');
  const storeDir = await tempDir('studio-store-');
  const failingRenderer = {
    createVideo: async (brief) => {
      if (brief.title.includes('broken')) throw new Error('render exploded');
      return { provider: 'mock', externalTaskId: 't', status: 'completed', videos: ['/tmp/x.mp4'] };
    },
  };
  const summary = await runBatch({
    topics: ['good topic one', 'broken topic', 'good topic two'],
    engine: 'mock',
    outputDir: out,
    ideaStore: new IdeaStore({ filePath: path.join(storeDir, 'ideas.json') }),
    rendererOptions: { renderer: failingRenderer },
    llm: offlineLlm,
    logger: silent,
  });
  assert.equal(summary.total, 3);
  assert.equal(summary.succeeded, 2);
  assert.equal(summary.failed, 1);
  const failure = summary.results.find((r) => !r.ok);
  assert.equal(failure.topic, 'broken topic');
  await access(path.join(out, 'batch-summary.json'));
});
