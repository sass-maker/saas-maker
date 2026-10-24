import { describe, expect, it } from 'vitest';
import {
  SCORE_CATEGORIES,
  addAssessmentHistory,
  archiveAssessment,
  assessmentHistory,
  compareAssessments,
  createWorkspace,
  currentAssessment,
  formatUsageCount,
  importSnapshot,
  mergePortfolioUsage,
  parsePortfolioUsageBundle,
  parseWorkspace,
  portfolioUsageStatus,
  recordOwnerUse,
  planNextLever,
  prerequisiteSatisfied,
  productPriority,
  productPriorityLabel,
  readScoreboardStorage,
  safeEvidenceUrl,
  scoreTotal,
  scoreReading,
  sortableTotal,
  transitionLever,
  validateSnapshot,
  type ScoreProject,
  type ScoreSnapshot,
} from '../../apps/cockpit/src/lib/scoreboard';

const usageFixture = (now: number, patch: Record<string, unknown> = {}) => {
  const end = new Date(now).toISOString();
  const start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    windowStart: start,
    windowEnd: end,
    checkedAt: end,
    proxy: { count: 0, unit: 'browsers', precision: 'exact' },
    core: {
      count: 0,
      definition: 'A completed synthetic core task',
      lastUsedAt: null,
      qualified: true,
      precision: 'exact',
      coverage: 'complete',
    },
    tracking: 'healthy',
    evidence: [{ source: 'synthetic-runtime-report', date: end, note: 'Synthetic dated proof.' }],
    limitations: '',
    ...patch,
  };
};

describe('owner purpose and product priority', () => {
  it('prioritizes either learning or commercial intent and preserves overlapping personal use', () => {
    const snapshot = fixture();
    const project = snapshot.projects[0];
    expect(productPriorityLabel(project)).toBe('Unclassified');
    project.purposeCategories = ['personal-use'];
    expect(productPriorityLabel(project)).toBe('Standard');
    expect(productPriority(project)).toBe(1);
    for (const purpose of ['learn-skill-showoff', 'attention-money-grabber'] as const) {
      project.purposeCategories = [purpose, 'personal-use'];
      expect(productPriority(project)).toBe(0);
      expect(productPriorityLabel(project)).toBe('Focus');
      expect(
        parseWorkspace(JSON.stringify(snapshot)).snapshot.projects[0].purposeCategories
      ).toEqual([purpose, 'personal-use']);
    }
  });

  it('rejects invalid or duplicated purposes while accepting older imports', () => {
    const snapshot = fixture();
    expect(() => validateSnapshot(snapshot)).not.toThrow();
    for (const purposes of [['unknown'], ['__proto__'], ['personal-use', 'personal-use']]) {
      const invalid = structuredClone(snapshot) as unknown as {
        projects: { purposeCategories: string[] }[];
      };
      invalid.projects[0].purposeCategories = purposes;
      expect(() => validateSnapshot(invalid)).toThrow(/Purpose categories/);
    }
  });
});

describe('rolling portfolio usage', () => {
  const now = Date.parse('2026-10-24T12:00:00.000Z');

  it('derives closure review only from a fresh, healthy, exact complete zero', () => {
    const record = usageFixture(now);
    const usage = {
      schemaVersion: 1 as const,
      updatedAt: new Date(now).toISOString(),
      records: { 'example-one': record },
    };
    expect(portfolioUsageStatus(usage, 'example-one', now)).toBe('closure_review');
    const estimated = structuredClone(record);
    estimated.core.precision = 'estimate';
    expect(
      portfolioUsageStatus({ ...usage, records: { 'example-one': estimated } }, 'example-one', now)
    ).toBe('tracking_gap');
    const partial = structuredClone(record);
    partial.core.coverage = 'partial';
    expect(
      portfolioUsageStatus({ ...usage, records: { 'example-one': partial } }, 'example-one', now)
    ).toBe('tracking_gap');
  });

  it('renders proxy precision as part of the displayed value', () => {
    expect(formatUsageCount(5, 'exact')).toBe('5');
    expect(formatUsageCount(5, 'lower_bound')).toBe('≥5');
    expect(formatUsageCount(1.5, 'estimate')).toBe('~1.5');
    expect(formatUsageCount(null, 'unknown')).toBe('Unknown');
  });

  it('labels proxy counts as audience only and rejects sampled zeros as inactivity', () => {
    const base = usageFixture(now, {
      proxy: { count: 7, unit: 'sessions', precision: 'estimate' },
      core: {
        count: null,
        definition: 'Unreviewed task',
        lastUsedAt: null,
        qualified: false,
        precision: 'unknown',
        coverage: 'unknown',
      },
      tracking: 'partial',
      events: [
        {
          name: 'task.complete',
          count: 4,
          lastSeen: new Date(now).toISOString(),
          precision: 'exact',
        },
      ],
    });
    const usage = {
      schemaVersion: 1 as const,
      updatedAt: new Date(now).toISOString(),
      records: { 'example-one': base },
    };
    expect(portfolioUsageStatus(usage, 'example-one', now)).toBe('audience_only');
    const zeroProxy = structuredClone(base);
    zeroProxy.proxy = { count: 0, unit: 'browsers', precision: 'exact' };
    expect(
      portfolioUsageStatus({ ...usage, records: { 'example-one': zeroProxy } }, 'example-one', now)
    ).toBe('tracking_gap');
  });

  it('does not present a stale positive core count as current use', () => {
    const record = usageFixture(now, {
      core: {
        count: 4,
        definition: 'Reviewed core task',
        lastUsedAt: new Date(now - 31 * 86400000).toISOString(),
        qualified: true,
        precision: 'exact',
        coverage: 'complete',
      },
    });
    const usage = {
      schemaVersion: 1 as const,
      updatedAt: new Date(now).toISOString(),
      records: { 'example-one': record },
    };
    expect(portfolioUsageStatus(usage, 'example-one', now)).toBe('tracking_gap');
    record.core.lastUsedAt = new Date(now - 29 * 86400000).toISOString();
    expect(portfolioUsageStatus(usage, 'example-one', now)).toBe('use_recorded');
  });

  it('requires dated evidence and an in-window last-use date for qualified core counts', () => {
    const base = usageFixture(now, {
      core: {
        count: 2,
        definition: 'Reviewed core task',
        lastUsedAt: new Date(now - 31 * 86400000).toISOString(),
        qualified: true,
        precision: 'exact',
        coverage: 'complete',
      },
    });
    const bundle = (record: unknown) =>
      JSON.stringify({
        kind: 'portfolio-usage',
        schemaVersion: 1,
        usage: {
          schemaVersion: 1,
          updatedAt: new Date(now).toISOString(),
          records: { 'example-one': record },
        },
      });
    expect(() => parsePortfolioUsageBundle(bundle(base))).toThrow(/core-action/);
    const noProof = structuredClone(base);
    noProof.core.lastUsedAt = new Date(now - 2 * 86400000).toISOString();
    noProof.evidence = [];
    expect(() => parsePortfolioUsageBundle(bundle(noProof))).toThrow(/core-action/);
    const zeroWithLastUse = usageFixture(now);
    zeroWithLastUse.core.lastUsedAt = new Date(now - 86400000).toISOString();
    expect(() => parsePortfolioUsageBundle(bundle(zeroWithLastUse))).toThrow(/core-action/);
    const evidenceAfterCheck = structuredClone(base);
    evidenceAfterCheck.core.lastUsedAt = new Date(now - 86400000).toISOString();
    evidenceAfterCheck.evidence[0].date = new Date(now + 86400000).toISOString();
    expect(() => parsePortfolioUsageBundle(bundle(evidenceAfterCheck))).toThrow(/core-action/);
  });

  it('preserves workspace history and local reports when merging only matching records', () => {
    const current = createWorkspace(fixture());
    const withHistory = transitionLever(current, 'example-one:product', 'active');
    const nowIso = new Date(now).toISOString();
    const incoming = parsePortfolioUsageBundle(
      JSON.stringify({
        kind: 'portfolio-usage',
        schemaVersion: 1,
        usage: {
          schemaVersion: 1,
          updatedAt: nowIso,
          records: {
            'example-one': usageFixture(now, {
              core: {
                count: null,
                definition: 'Unknown',
                lastUsedAt: null,
                qualified: false,
                precision: 'unknown',
                coverage: 'unknown',
              },
              tracking: 'missing',
            }),
            'not-in-review': usageFixture(now),
          },
        },
      })
    );
    const before = structuredClone(withHistory);
    const first = mergePortfolioUsage(withHistory, incoming);
    expect(first.matched).toBe(1);
    expect(first.unmatched).toBe(1);
    const reported = recordOwnerUse(
      first.workspace,
      'example-one',
      { date: '2026-10-24', note: 'Completed a local planning task.' },
      nowIso,
      now
    );
    expect(reported.usage?.ownerReports?.['example-one']).toHaveLength(1);
    expect(reported.usage?.records['example-one'].proxy).toEqual(
      first.workspace.usage?.records['example-one'].proxy
    );
    expect(reported.snapshot).toEqual(before.snapshot);
    expect(reported.progress).toEqual(before.progress);
    expect(reported.history).toEqual(before.history);
    expect(reported.assessments).toEqual(before.assessments);
    expect(reported.updatedAt).toBe(before.updatedAt);
    expect(portfolioUsageStatus(reported.usage, 'example-one', now)).toBe('use_recorded');
  });

  it('validates safe aggregate identifiers and preserves usage through old backup restore', () => {
    const nowIso = new Date(now).toISOString();
    const record = usageFixture(now, {
      core: {
        count: null,
        definition: 'Unknown',
        lastUsedAt: null,
        qualified: false,
        precision: 'unknown',
        coverage: 'unknown',
      },
      tracking: 'missing',
      events: [{ name: 'task:complete.v1', count: 1.5, lastSeen: nowIso, precision: 'exact' }],
    });
    const json = JSON.stringify({
      kind: 'portfolio-usage',
      schemaVersion: 1,
      usage: { schemaVersion: 1, updatedAt: nowIso, records: { 'example-one': record } },
    });
    expect(parsePortfolioUsageBundle(json).usage.records['example-one'].events).toHaveLength(1);
    const unsafe = JSON.parse(json);
    unsafe.usage.records['example-one'].events[0].name = 'https://private.example/?q=raw';
    expect(() => parsePortfolioUsageBundle(JSON.stringify(unsafe))).toThrow(/candidate event/);
    const existing = createWorkspace(fixture());
    const enriched = mergePortfolioUsage(existing, parsePortfolioUsageBundle(json)).workspace;
    const legacy = parseWorkspace(JSON.stringify(existing));
    expect(importSnapshot(enriched, legacy).usage).toEqual(enriched.usage);
    expect(parseWorkspace(JSON.stringify(enriched)).usage).toEqual(enriched.usage);
    expect(() =>
      recordOwnerUse(enriched, 'example-one', { date: '2026-02-30', note: 'Bad date' }, nowIso, now)
    ).toThrow(/past date/);
  });

  it('accepts the shared safe aggregate shape with fractional event estimates', () => {
    const shared = {
      kind: 'portfolio-usage',
      schemaVersion: 1,
      usage: {
        schemaVersion: 1,
        updatedAt: '2026-10-24T00:00:00.000Z',
        records: {
          'sample-project': {
            windowStart: '2026-09-24T00:00:00.000Z',
            windowEnd: '2026-10-24T00:00:00.000Z',
            checkedAt: '2026-10-24T00:00:00.000Z',
            proxy: { count: 5, unit: 'browsers', precision: 'lower_bound' },
            core: {
              count: null,
              definition: 'No owner-reviewed core action is mapped.',
              lastUsedAt: null,
              qualified: false,
              precision: 'unknown',
              coverage: 'unknown',
            },
            tracking: 'partial',
            evidence: [
              {
                source: 'app-health.browser-report',
                date: '2026-10-24T00:00:00.000Z',
                note: 'Synthetic aggregate example.',
              },
            ],
            limitations: 'Synthetic example; not product evidence.',
            events: [
              {
                name: 'sample.action',
                count: 1.5,
                lastSeen: '2026-10-23T00:00:00.000Z',
                precision: 'estimate',
              },
            ],
          },
        },
      },
    };
    expect(
      parsePortfolioUsageBundle(JSON.stringify(shared)).usage.records['sample-project'].events?.[0]
        .count
    ).toBe(1.5);
  });

  it('accepts the local owner date just after midnight even when UTC is the previous day', () => {
    const justAfterLocalMidnight = new Date(2026, 9, 24, 0, 15).getTime();
    const date = new Date(justAfterLocalMidnight);
    const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const workspace = createWorkspace(fixture());
    const updated = recordOwnerUse(
      workspace,
      'example-one',
      { date: localDate, note: 'Completed a real local task.' },
      new Date(justAfterLocalMidnight).toISOString(),
      justAfterLocalMidnight
    );
    expect(updated.usage?.ownerReports?.['example-one']).toHaveLength(1);
    expect(portfolioUsageStatus(updated.usage, 'example-one', justAfterLocalMidnight)).toBe(
      'use_recorded'
    );
  });

  it('does not replace a newer provider record with an older import', () => {
    const nowIso = new Date(now).toISOString();
    const current = createWorkspace(fixture());
    const newest = parsePortfolioUsageBundle(
      JSON.stringify({
        kind: 'portfolio-usage',
        schemaVersion: 1,
        usage: {
          schemaVersion: 1,
          updatedAt: nowIso,
          records: { 'example-one': usageFixture(now) },
        },
      })
    );
    const currentWithUsage = mergePortfolioUsage(current, newest).workspace;
    const olderEnd = now - 86400000;
    const older = parsePortfolioUsageBundle(
      JSON.stringify({
        kind: 'portfolio-usage',
        schemaVersion: 1,
        usage: {
          schemaVersion: 1,
          updatedAt: new Date(olderEnd).toISOString(),
          records: { 'example-one': usageFixture(olderEnd) },
        },
      })
    );
    const result = mergePortfolioUsage(currentWithUsage, older);
    expect(result.matched).toBe(1);
    expect(result.skippedOlder).toBe(1);
    expect(result.workspace.usage?.records['example-one'].checkedAt).toBe(nowIso);
  });
});

function fixture(): ScoreSnapshot {
  const projects = ['example-one', 'example-two'].map((id) => ({
    id,
    name: id,
    segment: 'A concrete synthetic task',
    domains: [`${id}.example.com`],
    internal: false,
    bestNextLeverId: `${id}:product`,
    sourceRevision: 'fixture-source',
    limitations: ['Synthetic test only.'],
    scores: Object.fromEntries(
      SCORE_CATEGORIES.map((c) => [
        c,
        {
          value: c === 'geo' || c === 'seo' ? null : c === 'product' ? 0 : 6.25,
          status: c === 'geo' ? 'unknown' : c === 'seo' ? 'not_applicable' : 'estimated',
          confidence: 'medium',
          reason: 'A bounded source observation.',
          evidence: [
            {
              source: 'https://example.com/proof',
              date: '2026-10-22',
              note: 'Known synthetic evidence.',
            },
          ],
        },
      ])
    ),
  })) as ScoreProject[];
  return validateSnapshot({
    schemaVersion: 1,
    assessedAt: '2026-10-22',
    label: 'Synthetic review',
    target: 8.75,
    projects,
    levers: projects.flatMap((p) =>
      SCORE_CATEGORIES.map((category) => ({
        id: `${p.id}:${category}`,
        projectId: p.id,
        category,
        title: `Improve ${category}`,
        action: 'Make one bounded change.',
        why: 'A known gap.',
        proof: 'Observe a correct outcome.',
        priority: 'high',
        kind: category === 'seo' ? 'scope' : 'action',
        dependencies: [],
      }))
    ),
  });
}

describe('scoreboard evidence semantics', () => {
  it('keeps zero distinct from unknown and exempt; totals have the correct denominator', () => {
    const p = fixture().projects[0];
    expect(scoreTotal(p)).toEqual({
      sum: 18.75,
      knownMax: 40,
      maximum: 50,
      unknown: 1,
      exempt: 1,
      complete: false,
    });
    for (const c of SCORE_CATEGORIES)
      p.scores[c] = { ...p.scores[c], status: 'estimated', value: 10 };
    expect(scoreTotal(p)).toEqual({
      sum: 60,
      knownMax: 60,
      maximum: 60,
      unknown: 0,
      exempt: 0,
      complete: true,
    });
  });
  it('rejects incomplete grids, missing evidence, impossible scores and dependency cycles', () => {
    const incomplete = fixture();
    incomplete.levers.pop();
    expect(() => validateSnapshot(incomplete)).toThrow(/six category/);
    const unknown = fixture();
    unknown.projects[0].scores.geo.value = 0;
    expect(() => validateSnapshot(unknown)).toThrow(/Unknown and exempt/);
    const noEvidence = fixture();
    noEvidence.projects[0].scores.design.evidence = [];
    expect(() => validateSnapshot(noEvidence)).toThrow(/dated evidence/);
    const range = fixture();
    range.projects[0].scores.product.value = 10.1;
    expect(() => validateSnapshot(range)).toThrow(/0–10/);
    const cycle = fixture();
    cycle.levers[0].dependencies = [cycle.levers[1].id];
    cycle.levers[1].dependencies = [cycle.levers[0].id];
    expect(() => validateSnapshot(cycle)).toThrow(/cycle/);
  });
  it('supports an import/export session when browser storage access throws', () => {
    const storage = readScoreboardStorage(() => {
      throw new DOMException('Storage denied', 'SecurityError');
    });
    expect(storage).toEqual({ available: false, raw: null });
    const imported = parseWorkspace(JSON.stringify(fixture()));
    const active = transitionLever(imported, 'example-one:product', 'active');
    expect(parseWorkspace(JSON.stringify(active)).progress['example-one:product']?.status).toBe(
      'active'
    );
    expect(readScoreboardStorage(() => 'saved backup')).toEqual({
      available: true,
      raw: 'saved backup',
    });
  });
  it('opens only credential-free http(s) evidence links', () => {
    expect(safeEvidenceUrl('https://example.com/evidence')).toBe('https://example.com/evidence');
    for (const source of [
      'javascript:alert(1)',
      'data:text/html,hello',
      'file:///private/example',
      '/private/review.md',
      'https://user:password@example.com/',
    ])
      expect(safeEvidenceUrl(source)).toBeNull();
  });
});

describe('independent effort and result scores', () => {
  function splitFixture() {
    const snapshot = fixture();
    for (const p of snapshot.projects)
      for (const c of SCORE_CATEGORIES) {
        const s = p.scores[c];
        s.effort = {
          ...s,
          value: s.status === 'not_applicable' ? null : 7,
          status: s.status === 'not_applicable' ? 'not_applicable' : 'estimated',
        };
        s.result = {
          ...s,
          value: s.status === 'not_applicable' ? null : 3,
          status: s.status === 'not_applicable' ? 'not_applicable' : 'estimated',
        };
      }
    return snapshot;
  }
  it('preserves combined legacy estimates without turning them into effort or outcome proof', () => {
    const old = fixture().projects[0];
    expect(old.scores.design.value).toBe(6.25);
    expect(scoreReading(old.scores.design, 'result')).toMatchObject({
      status: 'unknown',
      value: null,
    });
    expect(scoreReading(old.scores.design, 'effort')).toMatchObject({
      status: 'unknown',
      value: null,
    });
    expect(scoreReading(old.scores.seo, 'result').status).toBe('not_applicable');
    expect(scoreTotal(old, 'result')).toMatchObject({ sum: 0, unknown: 5, maximum: 50 });
  });
  it('validates both readings and computes two separate totals with scope preserved', () => {
    const snapshot = validateSnapshot(splitFixture());
    expect(scoreTotal(snapshot.projects[0], 'effort')).toMatchObject({
      sum: 35,
      maximum: 50,
      complete: true,
    });
    expect(scoreTotal(snapshot.projects[0], 'result')).toMatchObject({
      sum: 15,
      maximum: 50,
      complete: true,
    });
    expect(sortableTotal(snapshot.projects[0], 'effort')).toBe(35);
    delete snapshot.projects[0].scores.design.result;
    expect(() => validateSnapshot(snapshot)).toThrow(/both effort and result/);
    const inconsistent = splitFixture();
    inconsistent.projects[0].scores.seo.result!.status = 'unknown';
    expect(() => validateSnapshot(inconsistent)).toThrow(/preserve the category scope/);
    const badEvidence = splitFixture();
    badEvidence.projects[0].scores.design.result!.evidence = [];
    expect(() => validateSnapshot(badEvidence)).toThrow(/dated evidence/);
  });
  it('retains changes to each metric even when the previous combined grade stays the same', () => {
    const before = splitFixture(),
      after = splitFixture();
    after.projects[0].scores.design.effort!.value = 8;
    after.projects[0].scores.design.result!.value = 2;
    const a = archiveAssessment(before),
      b = archiveAssessment(after);
    expect(
      compareAssessments(a, b, 'effort').find((c) => c.id === 'example-one:design')
    ).toMatchObject({ delta: 1, state: 'increased' });
    expect(
      compareAssessments(a, b, 'result').find((c) => c.id === 'example-one:design')
    ).toMatchObject({ delta: -1, state: 'decreased' });
    expect(
      compareAssessments(archiveAssessment(fixture()), a, 'result').find(
        (c) => c.id === 'example-one:design'
      )
    ).toMatchObject({ delta: null, state: 'newly_assessed' });
    const merged = importSnapshot(createWorkspace(before), createWorkspace(after));
    expect(assessmentHistory(parseWorkspace(JSON.stringify(merged)))).toHaveLength(2);
  });
  it('records completed work separately and requires an observed result before verification', () => {
    let w = transitionLever(createWorkspace(splitFixture()), 'example-one:product', 'active');
    w = transitionLever(w, 'example-one:product', 'awaiting_evidence', {
      result: 'Implemented the change.',
      work: 'Implemented the change.',
      observedResult: '',
    });
    expect(w.progress['example-one:product']?.plan).toMatchObject({
      baselineEffort: 7,
      baselineResult: 3,
    });
    expect(() =>
      transitionLever(w, 'example-one:product', 'verified', {
        result: 'Work done.',
        work: 'Work done.',
        observedResult: '',
        evidence: 'A deployment receipt.',
        outcome: 'helped',
      })
    ).toThrow(/observed result/);
    w = transitionLever(w, 'example-one:product', 'verified', {
      result: 'Observed the outcome.',
      work: 'Implemented the change.',
      observedResult: 'The qualified task completed.',
      evidence: 'A dated observation.',
      outcome: 'helped',
    });
    const restored = parseWorkspace(JSON.stringify(w));
    expect(restored.progress['example-one:product']?.work).toBe('Implemented the change.');
    expect(restored.progress['example-one:product']?.observedResult).toBe(
      'The qualified task completed.'
    );
    expect(restored.snapshot.projects[0].scores.product.result!.value).toBe(3);
  });
});

describe('retained score assessments', () => {
  it('migrates old backups without changing their active plan or outcomes', () => {
    const original = transitionLever(createWorkspace(fixture()), 'example-one:product', 'active');
    delete original.assessments;
    const migrated = parseWorkspace(JSON.stringify(original));
    expect(migrated.snapshot).toEqual(original.snapshot);
    expect(migrated.progress).toEqual(original.progress);
    expect(migrated.history).toEqual(original.history);
    expect(assessmentHistory(migrated)).toHaveLength(1);
    expect(parseWorkspace(JSON.stringify(migrated))).toEqual(migrated);
  });

  it('archives each changed review and its evidence while deduplicating repeat imports', () => {
    const current = createWorkspace(fixture(), '2026-10-22T10:00:00Z');
    const next = fixture();
    next.projects[0].scores.product.value = 6.25;
    next.projects[0].scores.product.reason = 'A later observed result.';
    const incoming = createWorkspace(next, '2026-10-22T11:00:00Z');
    const merged = importSnapshot(current, incoming);
    expect(assessmentHistory(merged)).toHaveLength(2);
    expect(merged.assessments![0].projects[0].scores.product.value).toBe(0);
    expect(merged.assessments![0].projects[0].scores.product.reason).toBe(
      'A bounded source observation.'
    );
    next.projects[0].scores.product.evidence[0].note = 'Mutated input';
    expect(merged.assessments![1].projects[0].scores.product.evidence[0].note).toBe(
      'Known synthetic evidence.'
    );
    const repeated = importSnapshot(merged, createWorkspace(merged.snapshot));
    expect(assessmentHistory(repeated)).toHaveLength(3);
    expect(
      assessmentHistory(importSnapshot(repeated, createWorkspace(repeated.snapshot)))
    ).toHaveLength(3);
  });

  it('adds an older review without replacing current scores, progress or lever history', () => {
    const current = transitionLever(createWorkspace(fixture()), 'example-one:product', 'active');
    const older = fixture();
    older.assessedAt = '2026-10-20';
    older.projects[0].scores.product.value = 1;
    const merged = addAssessmentHistory(current, createWorkspace(older));
    expect(merged.snapshot).toEqual(current.snapshot);
    expect(merged.progress).toEqual(current.progress);
    expect(merged.history).toEqual(current.history);
    expect(assessmentHistory(merged)).toHaveLength(2);
    expect(currentAssessment(merged).projects[0].scores.product.value).toBe(0);
    const future = fixture();
    future.assessedAt = '2026-10-25';
    const withFuture = addAssessmentHistory(merged, createWorkspace(future));
    expect(currentAssessment(withFuture).assessedAt).toBe('2026-10-22');
    expect(assessmentHistory(withFuture)).toHaveLength(3);
  });

  it('distinguishes numeric changes, new evidence, new coverage and changed scope', () => {
    const first = fixture();
    const next = fixture();
    next.projects[0].scores.product.value = 6.25;
    next.projects[0].scores.geo = { ...next.projects[0].scores.geo, status: 'estimated', value: 5 };
    next.projects[0].scores.design.reason = 'Clarified evidence, same score.';
    next.projects[0].scores.seo = { ...next.projects[0].scores.seo, status: 'estimated', value: 6 };
    next.projects[1].internal = true;
    const changes = compareAssessments(archiveAssessment(first), archiveAssessment(next));
    const byId = Object.fromEntries(changes.map((c) => [c.id, c]));
    expect(byId['example-one:product']).toMatchObject({ delta: 6.25, state: 'increased' });
    expect(byId['example-one:geo']).toMatchObject({ delta: null, state: 'newly_assessed' });
    expect(byId['example-one:design']).toMatchObject({ delta: 0, state: 'evidence_updated' });
    expect(byId['example-one:seo']).toMatchObject({ delta: null, state: 'scope_changed' });
    expect(byId['example-two:design']).toMatchObject({ delta: null, state: 'scope_changed' });
    const removed = archiveAssessment(next);
    removed.projects.pop();
    expect(
      compareAssessments(archiveAssessment(first), removed).filter((c) => c.state === 'removed')
    ).toHaveLength(6);
    expect(
      compareAssessments(removed, archiveAssessment(first)).filter((c) => c.state === 'added')
    ).toHaveLength(6);
  });

  it('rejects malformed archived evidence without accepting a partial history', () => {
    const workspace = createWorkspace(fixture());
    workspace.assessments![0].projects[0].scores.design.evidence = [];
    expect(() => parseWorkspace(JSON.stringify(workspace))).toThrow(/dated evidence/);
  });

  it('rejects conflicting archive identities rather than producing an unreadable backup', () => {
    const current = createWorkspace(fixture());
    const incoming = createWorkspace(fixture());
    incoming.snapshot.projects[0].scores.product.value = 5;
    incoming.assessments = [archiveAssessment(incoming.snapshot)];
    incoming.assessments[0].id = current.assessments![0].id;
    expect(() => addAssessmentHistory(current, incoming)).toThrow(/conflicting versions/);
    expect(assessmentHistory(current)).toHaveLength(1);
  });

  it('includes partial totals in numeric ordering without extrapolating missing scores', () => {
    const project = fixture().projects[0];
    expect(scoreTotal(project).complete).toBe(false);
    expect(sortableTotal(project)).toBe(18.75);
    project.scores.geo = { ...project.scores.geo, status: 'estimated', value: 5 };
    expect(sortableTotal(project)).toBe(23.75);
    expect(scoreTotal(project).maximum).toBe(50);
    for (const category of SCORE_CATEGORIES)
      project.scores[category] = {
        ...project.scores[category],
        status: 'not_applicable',
        value: null,
      };
    expect(sortableTotal(project)).toBeNull();
  });

  it('distinguishes a known zero total from entirely unmeasured totals', () => {
    const project = fixture().projects[0];
    for (const category of SCORE_CATEGORIES)
      project.scores[category] = { ...project.scores[category], status: 'unknown', value: null };
    expect(sortableTotal(project)).toBeNull();
    project.scores.product = { ...project.scores.product, status: 'estimated', value: 0 };
    expect(sortableTotal(project)).toBe(0);
    expect(scoreTotal(project).unknown).toBe(5);
  });
});

describe('one-lever cadence', () => {
  it('blocks a second active lever and prerequisites, while allowing delayed evidence', () => {
    const snapshot = fixture();
    snapshot.levers[1].dependencies = [snapshot.levers[0].id];
    let w = createWorkspace(snapshot);
    expect(() => transitionLever(w, snapshot.levers[1].id, 'active')).toThrow(/prerequisites/);
    w = transitionLever(w, snapshot.levers[0].id, 'active', {}, '2026-10-22T10:00:00Z');
    expect(() => transitionLever(w, 'example-two:product', 'active')).toThrow(/only|active lever/);
    expect(() =>
      transitionLever(w, snapshot.levers[0].id, 'verified', { result: 'Shipped.' })
    ).toThrow(/evidence/);
    w = transitionLever(
      w,
      snapshot.levers[0].id,
      'awaiting_evidence',
      { result: 'Change prepared; observation window remains open.' },
      '2026-10-22T10:01:00Z'
    );
    w = transitionLever(w, 'example-two:product', 'active', {}, '2026-10-22T10:02:00Z');
    expect(w.progress['example-two:product']?.status).toBe('active');
    expect(w.progress['example-one:product']?.status).toBe('awaiting_evidence');
    expect(w.snapshot.projects[0].scores.product.value).toBe(0);
  });
  it('saves unfinished notes without freeing the active slot or changing a score', () => {
    let w = transitionLever(createWorkspace(fixture()), 'example-one:product', 'active');
    w = transitionLever(w, 'example-one:product', 'active', {
      result: 'Prepared the bounded change.',
      evidence: 'Local draft receipt.',
    });
    w = parseWorkspace(JSON.stringify(w));
    expect(w.progress['example-one:product']?.result).toBe('Prepared the bounded change.');
    expect(w.progress['example-one:product']?.status).toBe('active');
    expect(w.history[0].id).not.toBe(w.history[1].id);
    expect(w.snapshot.projects[0].scores.product.value).toBe(0);
    expect(() => transitionLever(w, 'example-two:product', 'active')).toThrow(/active lever/);
  });
  it('preserves the old plan and score when a verified lever gets its next follow-up', () => {
    const snapshot = fixture();
    let w = transitionLever(
      createWorkspace(snapshot),
      'example-one:product',
      'active',
      {},
      '2026-10-22T10:00:00Z'
    );
    w = transitionLever(
      w,
      'example-one:product',
      'verified',
      {
        result: 'Observed a useful change.',
        evidence: 'Dated synthetic receipt.',
        outcome: 'helped',
      },
      '2026-10-22T10:01:00Z'
    );
    const previous = w;
    w = planNextLever(w, 'example-one:product', {
      title: 'A different next step',
      action: 'Fix the remaining gap.',
      proof: 'Observe the next outcome.',
    });
    expect(w.progress['example-one:product']).toBeUndefined();
    expect(w.history[1].plan.title).toBe('Improve product');
    expect(w.history[1].plan.baselineScore).toBe(0);
    expect(w.snapshot.levers[0].title).toBe('A different next step');
    expect(previous.snapshot.levers[0].title).toBe('Improve product');
    expect(w.snapshot.projects[0].scores.product.value).toBe(0);
    expect(parseWorkspace(JSON.stringify(w))).toEqual(w);
  });
  it('requires accepted helpful prerequisite proof and preserves it through follow-ups and baseline imports', () => {
    const snapshot = fixture();
    snapshot.levers[1].dependencies = [snapshot.levers[0].id];
    let w = transitionLever(createWorkspace(snapshot), 'example-one:product', 'active');
    w = transitionLever(w, 'example-one:product', 'verified', {
      result: 'The experiment failed.',
      evidence: 'Dated failing result.',
      outcome: 'worse',
    });
    expect(() => transitionLever(w, 'example-one:design', 'active')).toThrow(/prerequisites/);
    w = planNextLever(w, 'example-one:product', {
      title: 'Repair the gate',
      action: 'Correct the original objective.',
      proof: 'Observe the repaired gate.',
    });
    w = transitionLever(w, 'example-one:product', 'active');
    w = transitionLever(w, 'example-one:product', 'verified', {
      result: 'The original gate now passes.',
      evidence: 'Dated passing result.',
      outcome: 'helped',
      prerequisiteSatisfied: true,
    });
    expect(prerequisiteSatisfied(w, 'example-one:product')).toBe(true);
    w = planNextLever(w, 'example-one:product', {
      title: 'Additional improvement',
      action: 'A later change.',
      proof: 'Observe the next outcome.',
    });
    w = importSnapshot(w, createWorkspace(fixture()));
    expect(w.snapshot.levers[0].title).toBe('Additional improvement');
    expect(w.history).toHaveLength(4);
    expect(
      transitionLever(w, 'example-one:design', 'active').progress['example-one:design']?.status
    ).toBe('active');
  });
  it('rejects tampered backups with multiple active levers or evidence-free verification', () => {
    const w = transitionLever(createWorkspace(fixture()), 'example-one:product', 'active');
    w.progress['example-two:product'] = {
      ...w.progress['example-one:product']!,
      leverId: 'example-two:product',
    };
    expect(() => parseWorkspace(JSON.stringify(w))).toThrow(/one active/);
    delete w.progress['example-two:product'];
    w.progress['example-one:product']!.status = 'verified';
    expect(() => parseWorkspace(JSON.stringify(w))).toThrow(/Record what happened|Verification/);
    expect(() => transitionLever(createWorkspace(fixture()), 'example-one:seo', 'active')).toThrow(
      /exemptions/
    );
  });
  it('keeps a running cycle when importing a fresh baseline and refuses its silent removal', () => {
    const current = transitionLever(createWorkspace(fixture()), 'example-one:product', 'active');
    const incoming = createWorkspace(fixture());
    incoming.snapshot.projects[0].scores.product.value = 5;
    const merged = importSnapshot(current, incoming);
    expect(merged.progress['example-one:product']?.plan.baselineScore).toBe(0);
    expect(merged.snapshot.projects[0].scores.product.value).toBe(5);
    incoming.snapshot.projects.shift();
    incoming.snapshot.levers = incoming.snapshot.levers.filter(
      (l) => l.projectId !== 'example-one'
    );
    expect(() => importSnapshot(current, incoming)).toThrow(/removes your active/);
  });
});
