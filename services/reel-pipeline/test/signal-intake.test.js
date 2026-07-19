import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { createDraftVideo } from '../src/pipeline.js';
import { createReelDraft } from '../src/reel-intake.js';
import { FileReelStore } from '../src/file-reel-store.js';
import {
  SIGNAL_SOURCE_TYPES,
  briefFromHighSignalReelBrief,
  briefFromProductImprovement,
  briefFromSignal,
  detectSignalSource,
  normalizeReelDraftFromSignal,
  reelDraftInputFromSignal,
} from '../src/signal-intake.js';

async function loadFixture(name) {
  const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('detectSignalSource recognizes High Signal reel brief fixtures', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  assert.equal(detectSignalSource(fixture), SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF);
});

test('detectSignalSource recognizes SaaS Maker improvement fixtures', async () => {
  const fixture = await loadFixture('saas-maker-improvement.json');
  assert.equal(detectSignalSource(fixture), SIGNAL_SOURCE_TYPES.SAAS_MAKER_IMPROVEMENT);
});

test('briefFromHighSignalReelBrief maps hook, scenes, captions, assets, and CTA', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const brief = briefFromHighSignalReelBrief(fixture);

  assert.equal(brief.projectSlug, 'high-signal');
  assert.equal(brief.hook, fixture.hook);
  assert.equal(brief.cta, fixture.cta);
  assert.equal(brief.template, 'teardown_audit');
  assert.equal(brief.proofType, 'screenshot');
  assert.equal(brief.productUrl, 'https://highsignal.app');
  assert.match(brief.body, /Script:/i);
  assert.match(brief.body, /Shot list:/i);
  assert.match(brief.body, /Captions:/i);
  assert.match(brief.body, /Asset prompts:/i);
  assert.match(brief.body, /agent-readiness audit screen/i);
});

test('briefFromProductImprovement maps changelog-style improvements into VideoBrief', async () => {
  const fixture = await loadFixture('saas-maker-improvement.json');
  const brief = briefFromProductImprovement(fixture);

  assert.equal(brief.projectSlug, 'linkchat');
  assert.equal(brief.taskId, 'task-linkchat-profile-answers');
  assert.equal(brief.template, 'problem_proof_cta');
  assert.match(brief.hook, /POV:/);
  assert.match(brief.body, /Script:/i);
  assert.match(brief.body, /Shot list:/i);
  assert.match(brief.body, /Captions:/i);
  assert.match(brief.body, /Asset prompts:/i);
  assert.match(brief.body, /profile now answers repeated questions/i);
});

test('reelDraftInputFromSignal keeps generated status for human review', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const input = reelDraftInputFromSignal(fixture);

  assert.equal(input.status, 'generated');
  assert.equal(input.source, 'high-signal');
  assert.equal(input.realDetails.signalSource, SIGNAL_SOURCE_TYPES.HIGH_SIGNAL_REEL_BRIEF);
  assert.equal(input.realDetails.evidenceUrls.length, 2);
});

test('normalizeReelDraftFromSignal produces a reviewable draft reel record', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const record = normalizeReelDraftFromSignal(fixture, { now: () => new Date('2026-06-04T12:00:00.000Z') });

  assert.equal(record.status, 'generated');
  assert.equal(record.projectSlug, 'high-signal');
  assert.equal(record.brief.hook, fixture.hook);
  assert.equal(record.decision, null);
  assert.equal(record.renderJobId, null);
});

test('createReelDraft from signal fixture stays unapproved until review', async () => {
  const fixture = await loadFixture('saas-maker-improvement.json');
  const store = new FileReelStore({ rootDir: './tmp/signal-intake-review' });
  const record = await createReelDraft(reelDraftInputFromSignal(fixture), { reelStore: store });

  assert.equal(record.status, 'generated');
  assert.equal(record.source, 'saas-maker-improvement');
  assert.match(record.body, /Asset prompts:/i);
});

test('signal brief flows through mock renderer', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const brief = briefFromSignal(fixture);
  const job = await createDraftVideo(brief, {
    mode: 'mock',
    mock: { artifactDir: './tmp/signal-intake-mock' },
  });

  assert.equal(job.status, 'video_ready');
  assert.equal(job.brief.hook, fixture.hook);
  assert.ok(Array.isArray(job.render?.videos) || job.render?.videoUrl);
});
