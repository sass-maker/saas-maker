import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  generateSignalReelDraftBundle,
  reviewSignalClaims,
} from '../src/signal-draft-generator.js';

async function loadFixture(name) {
  const raw = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return JSON.parse(raw);
}

test('fixture brief includes audience, offer, constraints, and evidence', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  assert.ok(fixture.targetAudience);
  assert.ok(fixture.offer);
  assert.equal(fixture.productConstraints.length, 4);
  assert.equal(fixture.evidenceUrls.length, 2);
});

test('generateSignalReelDraftBundle emits two variants with storyboard script shot list captions', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const bundle = generateSignalReelDraftBundle(fixture, { variantCount: 2, now: () => new Date('2026-06-04T12:00:00.000Z') });

  assert.equal(bundle.variants.length, 2);
  assert.equal(bundle.experimentPlan.minDailyPosts, 5);
  assert.equal(bundle.experimentPlan.maxDailyPosts, 7);
  assert.equal(bundle.experimentPlan.decisionPostCount, 35);
  assert.equal(bundle.targetAudience, fixture.targetAudience);
  assert.equal(bundle.offer, fixture.offer);
  assert.deepEqual(bundle.productConstraints, fixture.productConstraints);

  for (const variant of bundle.variants) {
    assert.ok(variant.growthFormat.id);
    assert.ok(variant.formatExecution.ctaPlacement);
    assert.ok(variant.storyboard.length >= 3);
    assert.match(variant.script, /HOOK:/);
    assert.match(variant.script, /FORMAT:/);
    assert.match(variant.script, /CTA:/);
    assert.ok(variant.shotList.length >= 3);
    assert.ok(variant.captions.hook);
    assert.ok(variant.captions.proof);
    assert.ok(variant.captions.cta);
    assert.ok(Array.isArray(variant.claims));
  }

  const templates = new Set(bundle.variants.map((variant) => variant.template));
  assert.ok(templates.size >= 1);
});

test('generateSignalReelDraftBundle defaults to five growth formats for a 35-post experiment', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const bundle = generateSignalReelDraftBundle(fixture, { now: () => new Date('2026-06-04T12:00:00.000Z') });

  assert.equal(bundle.variants.length, 5);
  assert.deepEqual(
    bundle.variants.map((variant) => variant.growthFormat.id),
    ['ranking_system', 'sound_sync', 'tutorial_value', 'trend_copy', 'before_after'],
  );
  assert.match(bundle.experimentPlan.decisionRule, /35 posts/i);
});

test('reviewSignalClaims marks evidence requirements and rejects unsupported claims', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const withBadClaim = {
    ...fixture,
    hook: 'High Signal guarantees top placement in every AI assistant ranking.',
  };
  const review = reviewSignalClaims(withBadClaim);

  const rejectedTexts = review.rejectedClaims.map((claim) => claim.text);
  assert.ok(rejectedTexts.some((text) => /guarantees top placement/i.test(text)));

  const requiresEvidence = review.claimsRequiringEvidence.filter((claim) => !claim.rejected);
  assert.ok(requiresEvidence.length >= 1);
  assert.ok(review.summary.rejected >= 1);
});

test('fixture unsupportedClaims are rejected even when not used in hooks', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const review = reviewSignalClaims(fixture);
  const rejectedTexts = review.rejectedClaims.map((claim) => claim.text);
  assert.ok(rejectedTexts.some((text) => /guarantees top placement/i.test(text)));
});

test('bundle keeps rejected fixture claims out of variant scripts', async () => {
  const fixture = await loadFixture('high-signal-reel-brief.json');
  const bundle = generateSignalReelDraftBundle({
    ...fixture,
    unsupportedClaims: ['High Signal guarantees top placement in every AI assistant ranking.'],
    hook: 'High Signal guarantees top placement in every AI assistant ranking.',
  });

  const rejected = bundle.claimReview.rejectedClaims.map((claim) => claim.text).join(' ');
  assert.match(rejected, /guarantees top placement/i);
  for (const variant of bundle.variants) {
    assert.doesNotMatch(variant.script, /guarantees top placement/i);
    assert.doesNotMatch(variant.captions.hook, /guarantees top placement/i);
  }
});
