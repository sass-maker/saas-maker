import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  loadToolboxRegistry,
  validateToolboxRegistry,
  productForDomain,
  ToolboxRegistryError,
} from '../lib/toolbox-automation/registry.mjs';
import {
  buildChildEvidence,
  buildFamilySnapshot,
  evaluateFreshness,
  findPrivatePayloadLeaks,
  STATUS,
} from '../lib/toolbox-automation/evidence.mjs';
import {
  validateExperiment,
  validateExperiments,
  EXPERIMENT_OUTCOME,
} from '../lib/toolbox-automation/experiments.mjs';

const registry = JSON.parse(
  await readFile(new URL('../config/significant-hobbies-toolbox.json', import.meta.url), 'utf8')
);
const valid = validateToolboxRegistry(registry);

const NOW = '2026-07-19T12:00:00Z';
const PRODUCT_IDS = ['significanthobbies', 'reader', 'anime-list', 'swe-interview-prep', 'looptv', 'chess'];

describe('registry: complete family mapping', () => {
  it('maps each of the six products to a unique canonical domain, owner, and repo', () => {
    assert.equal(valid.products.length, 6);
    const domains = new Set();
    const owners = new Set();
    const repos = new Set();
    for (const p of valid.products) {
      domains.add(p.domain);
      owners.add(p.owner);
      repos.add(p.repo);
    }
    assert.equal(domains.size, 6);
    assert.equal(owners.size, 6);
    assert.equal(repos.size, 6);
  });

  it('includes exactly the six in-scope products and excludes materia and protein-index', () => {
    const ids = valid.products.map((p) => p.id).sort();
    assert.deepEqual(ids, [...PRODUCT_IDS].sort());
    assert.deepEqual(valid.family.outOfScope, ['materia', 'protein-index']);
  });

  it('scenario: child domain lacks owner — validation fails when a domain maps to no product', () => {
    // productForDomain returns null for an unmapped domain; the CLI's
    // domain-ownership check treats this as a failure.
    assert.equal(productForDomain(valid, 'https://unknown.significanthobbies.com'), null);
    const clone = structuredClone(registry);
    clone.products.push({
      id: 'ghost',
      name: 'Ghost',
      runtime: 'spa-static-pages',
      repo: 'ghost',
      domain: 'https://significanthobbies.com', // duplicate domain
      cfProject: 'ghost',
      deployKind: 'pages',
      owner: 'ghost',
      activation: { type: 'ghost', notApplicable: false, definition: 'x' },
      privacy: { excludedCategories: ['credentials'] },
      evidenceSources: { build: 'x', live: 'x', indexing: 'x', errors: 'x', revision: 'x' },
      backgroundJobs: [],
      experimentMode: 'evergreen',
    });
    assert.throws(() => validateToolboxRegistry(clone), (err) => {
      assert.ok(err instanceof ToolboxRegistryError);
      assert.match(err.message, /belongs to both/);
      return true;
    });
  });

  it('rejects duplicate owners and duplicate repos', () => {
    const dupOwner = structuredClone(registry);
    dupOwner.products.find((p) => p.id === 'chess').owner = 'reader';
    assert.throws(() => validateToolboxRegistry(dupOwner), /owner reader belongs to both/);

    const dupRepo = structuredClone(registry);
    dupRepo.products.find((p) => p.id === 'chess').repo = 'reader';
    assert.throws(() => validateToolboxRegistry(dupRepo), /repo reader belongs to both/);
  });

  it('rejects a product missing required evidence sources or privacy categories', () => {
    const missingEvidence = structuredClone(registry);
    delete missingEvidence.products.find((p) => p.id === 'chess').evidenceSources.live;
    assert.throws(() => validateToolboxRegistry(missingEvidence), /missing evidenceSources.live/);

    const noPrivacy = structuredClone(registry);
    noPrivacy.products.find((p) => p.id === 'chess').privacy.excludedCategories = [];
    assert.throws(() => validateToolboxRegistry(noPrivacy), /at least one privacy.excludedCategories/);
  });
});

describe('evidence: per-child usability evidence', () => {
  it('each product exposes build/live/indexing/errors/revision + activation or N/A', () => {
    for (const p of valid.products) {
      const env = buildChildEvidence(valid, p.id, {}, NOW);
      assert.equal(env.productId, p.id);
      assert.ok(env.build && env.live && env.indexing && env.errors && env.activation);
      assert.equal(typeof env.revision, 'undefined'); // unknown until adapter wired
    }
  });

  it('scenario: LoopTV loads but cannot play — page probe passes but playback activation fails independently', () => {
    const env = buildChildEvidence(valid, 'looptv', {
      live: { status: STATUS.PASS, detail: 'page loaded' },
      activation: { status: STATUS.FAIL, detail: 'playback did not reach 30s' },
    }, NOW);
    assert.equal(env.live.status, STATUS.PASS);
    assert.equal(env.activation.status, STATUS.FAIL);
    // The child summary must fail, and the failure reason must be activation,
    // not page availability.
    const snap = buildFamilySnapshot(valid, [env], { now: NOW });
    assert.equal(snap.perChild.looptv.status, STATUS.FAIL);
    assert.equal(snap.perChild.looptv.reason, 'one-or-more-blocks-failed');
  });
});

describe('evidence: private personal data protection', () => {
  it('scenario: Reader sync is measured — only aggregate status/count/freshness is retained', () => {
    const env = buildChildEvidence(valid, 'reader', {
      activation: { status: STATUS.PASS, count: 7, detail: '7 saves' },
      backgroundJobs: [
        { id: 'reader-weekly-quality', lastSuccess: '2026-07-15T00:00:00Z' },
      ],
      private: {
        'article-bodies': 'PRIVATE ARTICLE TEXT — must never leave Reader',
        'ai-chat-prompts': 'summarize my private library',
        'user-library-contents': ['private-article-1', 'private-article-2'],
        'credentials': 'sk_live_secret',
      },
    }, NOW);
    // The envelope must not contain any of the private payload values.
    const leaks = findPrivatePayloadLeaks(env, valid.products.find((p) => p.id === 'reader').privacy.excludedCategories);
    assert.deepEqual(leaks, []);
    // The redactor must have marked the envelope and recorded the dropped categories.
    assert.equal(env.redacted, true);
    assert.ok(env.redactedCategories.includes('article-bodies'));
    assert.ok(env.redactedCategories.includes('ai-chat-prompts'));
    assert.ok(env.redactedCategories.includes('user-library-contents'));
    assert.ok(env.redactedCategories.includes('credentials'));
    // The aggregate signal is retained.
    assert.equal(env.activation.count, 7);
    assert.equal(env.activation.status, STATUS.PASS);
  });

  it('findPrivatePayloadLeaks catches credential-shaped values and forbidden keys', () => {
    const leaks = findPrivatePayloadLeaks({
      meta: { ok: true },
      token: 'pk_live_abc123',
      nested: { 'saved-games': ['game1'], safe: 'ok' },
    });
    assert.ok(leaks.some((l) => l.includes('token') && l.includes('credential-shaped')));
    assert.ok(leaks.some((l) => l.includes('saved-games')));
  });

  it('every product declares at least one privacy exclusion category', () => {
    for (const p of valid.products) {
      assert.ok(p.privacy.excludedCategories.length > 0, `${p.id} must declare privacy exclusions`);
    }
  });
});

describe('evidence: background freshness by declared cadence', () => {
  it('scenario: quarterly job within its freshness window is not stale merely because no daily run exists', () => {
    const quarterlyJob = valid.products
      .find((p) => p.id === 'anime-list')
      .backgroundJobs.find((j) => j.cadence === 'quarterly');
    assert.ok(quarterlyJob, 'anime-list must declare a quarterly job');
    // Last success 30 days ago — well inside the 95-day quarterly window.
    const result = evaluateFreshness(
      quarterlyJob,
      { lastSuccess: '2026-06-19T00:00:00Z' },
      NOW
    );
    assert.equal(result.status, STATUS.PASS);
    assert.equal(result.ageDays, 30);
    assert.ok(result.freshnessWindowDays >= 90);
  });

  it('marks a daily job stale when it slips past its 2-day window', () => {
    const dailyJob = valid.products
      .find((p) => p.id === 'anime-list')
      .backgroundJobs.find((j) => j.cadence === 'daily');
    const result = evaluateFreshness(
      dailyJob,
      { lastSuccess: '2026-07-15T00:00:00Z' }, // 4 days ago
      NOW
    );
    assert.equal(result.status, 'stale');
  });

  it('marks a job failed when the last failure is more recent than the last success', () => {
    const job = valid.products
      .find((p) => p.id === 'anime-list')
      .backgroundJobs.find((j) => j.cadence === 'daily');
    const result = evaluateFreshness(
      job,
      {
        lastSuccess: '2026-07-18T00:00:00Z',
        lastFailure: '2026-07-19T00:00:00Z',
      },
      NOW
    );
    assert.equal(result.status, STATUS.FAIL);
  });
});

describe('evidence: independent failure and digest policy', () => {
  it('scenario: Chess is unavailable — the report names Chess only and preserves other child statuses', () => {
    const envelopes = valid.products.map((p) => {
      if (p.id === 'chess') {
        return buildChildEvidence(valid, 'chess', {
          live: { status: STATUS.FAIL, detail: 'pages deploy unavailable' },
        }, NOW);
      }
      return buildChildEvidence(valid, p.id, {
        build: { status: STATUS.PASS },
        live: { status: STATUS.PASS },
        indexing: { status: STATUS.PASS },
        errors: { status: STATUS.PASS },
        activation: { status: STATUS.PASS, count: 1 },
        backgroundJobs: p.backgroundJobs.map((j) => ({
          id: j.id,
          lastSuccess: '2026-07-18T00:00:00Z',
        })),
      }, NOW);
    });
    const snap = buildFamilySnapshot(valid, envelopes, { now: NOW });
    // Chess is the only failing child.
    assert.equal(snap.perChild.chess.status, STATUS.FAIL);
    // Every other child passes.
    for (const id of PRODUCT_IDS) {
      if (id === 'chess') continue;
      assert.equal(snap.perChild[id].status, STATUS.PASS, `${id} should pass`);
    }
    // Family status is NOT fail — one child failure does not mark family failed.
    assert.equal(snap.familyStatus, 'pass-with-child-failures');
    // The digest names Chess only.
    assert.deepEqual(snap.digest.failing, ['chess']);
    // Routine failure is deduplicated, not paged.
    assert.equal(snap.digest.page, false);
    assert.equal(snap.digest.deduplicated, true);
  });

  it('family status is fail only when every child fails', () => {
    const envelopes = valid.products.map((p) =>
      buildChildEvidence(valid, p.id, { live: { status: STATUS.FAIL } }, NOW)
    );
    const snap = buildFamilySnapshot(valid, envelopes, { now: NOW });
    assert.equal(snap.familyStatus, STATUS.FAIL);
  });
});

describe('experiments: quiet experiment boundaries', () => {
  const baseExperiment = {
    hypothesis: 'A clearer CTA increases anime-list watchlist adds',
    approvedAsset: 'anime-list/cta-v2',
    attributionKey: 'anime-list-cta-v2-2026-07',
    start: '2026-07-01T00:00:00Z',
    expiry: '2026-07-31T00:00:00Z',
    budget: { paid: false },
    successMetric: { threshold: 100, observed: 0 },
    stopRule: 'Stop if error rate exceeds 1% or after 31 days.',
    owner: 'anime-list',
  };

  it('scenario: Anime List experiment is inconclusive — attribution missing or threshold unmet at expiry', () => {
    // Threshold unmet at expiry.
    const expired = validateExperiment(
      valid,
      { ...baseExperiment, expiry: '2026-07-10T00:00:00Z', successMetric: { threshold: 100, observed: 12 } },
      { now: '2026-07-19T12:00:00Z', reviewApproved: true }
    );
    assert.equal(expired.outcome, EXPERIMENT_OUTCOME.INCONCLUSIVE);
    assert.ok(expired.stops.includes('threshold-unmet-at-expiry'));

    // Missing attribution signal during the run (the attribution key is
    // declared but no observed attribution was recorded).
    const noAttribution = validateExperiment(
      valid,
      { ...baseExperiment },
      { now: '2026-07-15T12:00:00Z', reviewApproved: true, attributionPresent: false }
    );
    assert.equal(noAttribution.outcome, EXPERIMENT_OUTCOME.INCONCLUSIVE);
    assert.ok(noAttribution.stops.includes('missing-attribution'));
  });

  it('requires review approval — a valid experiment without approval is stopped, not running', () => {
    const verdict = validateExperiment(valid, baseExperiment, {
      now: '2026-07-15T12:00:00Z',
      reviewApproved: false,
    });
    assert.equal(verdict.outcome, EXPERIMENT_OUTCOME.STOPPED);
    assert.ok(verdict.stops.includes('pending-review-approval'));
  });

  it('rejects paid marketing, missing fields, and unknown owners', () => {
    assert.equal(
      validateExperiment(valid, { ...baseExperiment, budget: { paid: true } }).outcome,
      EXPERIMENT_OUTCOME.REJECTED
    );
    assert.equal(
      validateExperiment(valid, { ...baseExperiment, hypothesis: undefined }).outcome,
      EXPERIMENT_OUTCOME.REJECTED
    );
    assert.equal(
      validateExperiment(valid, { ...baseExperiment, owner: 'not-a-family-product' }).outcome,
      EXPERIMENT_OUTCOME.REJECTED
    );
  });

  it('no automatic replacement campaign is created when an experiment expires or fails', () => {
    const batch = validateExperiments(
      valid,
      [
        { ...baseExperiment, expiry: '2026-07-10T00:00:00Z', successMetric: { threshold: 100, observed: 5 } },
        { ...baseExperiment, attributionKey: '' },
      ],
      { now: '2026-07-19T12:00:00Z', reviewApproved: true }
    );
    assert.equal(batch.summary.replacementCampaignsCreated, 0);
    assert.equal(batch.summary.noAutomaticReplacement, true);
    // Both verdicts are inconclusive/stopped, none are running.
    assert.equal(batch.verdicts.filter((v) => v.outcome === EXPERIMENT_OUTCOME.RUNNING).length, 0);
  });

  it('a successful experiment produces a promotion recommendation, not an automatic promotion', () => {
    const verdict = validateExperiment(valid, baseExperiment, {
      now: '2026-07-15T12:00:00Z',
      reviewApproved: true,
      thresholdMet: true,
    });
    assert.equal(verdict.outcome, EXPERIMENT_OUTCOME.RUNNING);
    assert.equal(verdict.recommendation, 'promotion-recommendation-for-sarthak-decision');
    assert.equal(verdict.noAutomaticPromotion, true);
  });
});

describe('CLI: toolbox-family-evidence script', () => {
  it('the registry loads via loadToolboxRegistry and is the canonical six-product family', () => {
    const loaded = loadToolboxRegistry();
    assert.equal(loaded.products.length, 6);
    assert.equal(loaded.family.id, 'significanthobbies');
  });
});
