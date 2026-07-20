import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scoreRender, assessRender } from '../src/studio/quality.js';
import { planIdeas, produceNext, factoryStatus } from '../src/studio/factory.js';
import { buildPublishPacket } from '../src/studio/packet.js';
import { IdeaStore } from '../src/studio/idea-store.js';
import { StudioLlm } from '../src/studio/llm.js';
import { generateScript } from '../src/studio/script.js';

const offlineLlm = new StudioLlm({ apiKey: '' });
const silent = { info: () => {}, warn: () => {} };

async function tempStore(prefix = 'factory-') {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  return { dir, store: new IdeaStore({ filePath: path.join(dir, 'ideas.json') }) };
}

test('scoreRender passes a healthy render and reports dimensions', async () => {
  const script = await generateScript({ topic: 'test factory', durationSeconds: 60, llm: offlineLlm });
  const probe = { ok: true, durationSeconds: 58, width: 1080, height: 1920, hasAudio: true };
  const report = scoreRender({ script, probe });
  assert.equal(report.verdict, 'pass');
  assert.equal(report.videoEvidence, true);
  assert.ok(report.dimensions.durationFit >= 90);
  assert.equal(report.dimensions.audioPresence, 100);
});

test('scoreRender degrades to script-only when the probe fails', async () => {
  const script = await generateScript({ topic: 'test factory', durationSeconds: 60, llm: offlineLlm });
  const report = scoreRender({ script, probe: { ok: false, reason: 'placeholder' } });
  assert.equal(report.videoEvidence, false);
  assert.equal(report.probeReason, 'placeholder');
  assert.equal(report.dimensions.durationFit, undefined);
  assert.ok(report.dimensions.hookStrength > 0);
});

test('scoreRender penalizes weak openers and silent or wrong-shape video', () => {
  const script = {
    hook: 'In this video we will talk about things',
    targetDurationSeconds: 60,
    scenes: [{ narration: 'In this video we will talk about things at length today okay', onScreenText: null }],
  };
  const report = scoreRender({ script, probe: { ok: true, durationSeconds: 90, width: 1920, height: 1080, hasAudio: false } });
  assert.ok(report.dimensions.hookStrength <= 30);
  assert.equal(report.dimensions.audioPresence, 0);
  assert.equal(report.dimensions.resolution, 20);
  assert.equal(report.verdict, 'fail');
});

test('assessRender wires the prober through', async () => {
  const script = await generateScript({ topic: 'probe wiring', durationSeconds: 60, llm: offlineLlm });
  const report = await assessRender({
    script,
    videoPath: '/x/video.mp4',
    prober: async () => ({ ok: true, durationSeconds: 60, width: 1080, height: 1920, hasAudio: true }),
  });
  assert.equal(report.videoEvidence, true);
});

test('plan then produce advances exactly N ideas and leaves the rest', async () => {
  const { store } = await tempStore();
  const planned = await planIdeas({ niche: 'test niche', count: 5, store, llm: offlineLlm });
  assert.equal(planned.planned.length, 5);

  const result = await produceNext({
    count: 2,
    engine: 'mock',
    store,
    llm: offlineLlm,
    logger: silent,
    workflow: async ({ ideaId, ideaStore }) => {
      const idea = await ideaStore.updateIdea(ideaId, { status: 'rendered', notes: 'artifacts: /tmp/x' });
      return { artifactDir: '/tmp/x', video: '/tmp/x/video.mp4', quality: { verdict: 'pass', overall: 90 }, ideaId: idea.id };
    },
    packetBuilder: async () => ({ packetDir: '/tmp/x/packet' }),
  });
  assert.equal(result.succeeded, 2);
  assert.equal((await store.listIdeas({ status: 'new' })).length, 3);
  assert.equal((await store.listIdeas({ status: 'rendered' })).length, 2);
});

test('produce isolates failures and leaves failed ideas as new', async () => {
  const { store } = await tempStore();
  await planIdeas({ niche: 'flaky niche', count: 2, store, llm: offlineLlm });
  const result = await produceNext({
    count: 2,
    store,
    llm: offlineLlm,
    logger: silent,
    workflow: async ({ topic, ideaId, ideaStore }) => {
      if (topic.includes('Beginner')) throw new Error('render exploded');
      await ideaStore.updateIdea(ideaId, { status: 'rendered', notes: 'artifacts: /tmp/y' });
      return { artifactDir: '/tmp/y', video: '/tmp/y/v.mp4', quality: null };
    },
    packetBuilder: async () => null,
  });
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal((await store.listIdeas({ status: 'new' })).length, 1);
});

test('factoryStatus counts stages and surfaces recent renders', async () => {
  const { store } = await tempStore();
  const idea = await store.saveIdea({ title: 'done one', notes: 'artifacts: /tmp/z' });
  await store.updateIdea(idea.id, { status: 'rendered' });
  await store.saveIdea({ title: 'waiting' });
  const status = await factoryStatus({ store });
  assert.equal(status.total, 2);
  assert.equal(status.counts.new, 1);
  assert.equal(status.counts.rendered, 1);
  assert.equal(status.recentRenders[0].artifactDir, '/tmp/z');
});

test('publish packet writes upload.md and a thumbnail', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'packet-'));
  const script = await generateScript({ topic: 'packet topic', durationSeconds: 60, llm: offlineLlm });
  await writeFile(path.join(dir, 'script.json'), JSON.stringify(script));
  await writeFile(path.join(dir, 'metadata.json'), JSON.stringify({ titles: ['Best Title', 'Alt Title'], tags: ['a', 'b'], hashtags: ['#x'] }));
  await writeFile(path.join(dir, 'render.json'), JSON.stringify({ videos: [path.join(dir, 'video.mp4')] }));
  await writeFile(path.join(dir, 'quality.json'), JSON.stringify({ verdict: 'pass', overall: 88 }));

  const packet = await buildPublishPacket({ artifactDir: dir, llm: offlineLlm, screenshotter: async () => false });
  await access(packet.uploadPath);
  const upload = await (await import('node:fs/promises')).readFile(packet.uploadPath, 'utf8');
  assert.match(upload, /## Title/);
  assert.match(upload, /Best Title/);
  assert.match(upload, /## Tags/);
  assert.match(upload, /pass \(88\/100\)/);
  await access(packet.thumbnail);
});
