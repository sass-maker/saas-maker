import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { getDailyCaptureCounts } from '../../workers/api/src/lib/daily-capture-counts';
import capturePolicy from '../../tooling/config/capture-projects.json';
import nativeApplicability from '../../tooling/config/app-health-native-applicability.json';

const migration = readFileSync(
  new URL('../../workers/api/migrations/0028_daily_capture_receipts.sql', import.meta.url),
  'utf8'
);
const bindingMigration = readFileSync(
  new URL('../../workers/api/migrations/0027_catalog_project_bindings.sql', import.meta.url),
  'utf8'
);
const databases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of databases) db.close();
  databases.length = 0;
});

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    INSERT INTO projects(id) VALUES ('project-1'), ('project-2'), ('unbound-project');
    CREATE TABLE feedback (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), created_at TEXT NOT NULL);
    CREATE TABLE capture_subscriptions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      kind TEXT NOT NULL CHECK (kind IN ('newsletter', 'waitlist')),
      email TEXT NOT NULL,
      email_normalized TEXT NOT NULL,
      consent_version TEXT NOT NULL,
      consent_text TEXT NOT NULL,
      consented_at TEXT NOT NULL,
      source TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'unsubscribed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, kind, email_normalized)
    );
  `);
  sqlite.exec(bindingMigration);
  sqlite.exec(migration);
  sqlite
    .prepare('UPDATE daily_capture_coverage SET cutover_at = ? WHERE id = 1')
    .run('2019-12-30T00:00:00Z');
  sqlite
    .prepare(
      'INSERT INTO catalog_project_bindings (saas_maker_project_id, catalog_project_id) VALUES (?, ?)'
    )
    .run('project-1', 'alpha-app');
  sqlite
    .prepare(
      'INSERT INTO catalog_project_bindings (saas_maker_project_id, catalog_project_id) VALUES (?, ?)'
    )
    .run('project-2', 'beta-app');

  let queryCount = 0;
  const d1 = {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...next: unknown[]) {
          args = next;
          return this;
        },
        async all() {
          queryCount += 1;
          return { results: sqlite.prepare(sql).all(...(args as (string | number)[])) };
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, d1, queryCount: () => queryCount };
}

function insertSubscription(
  sqlite: DatabaseSync,
  input: { id: string; project: string; kind: 'newsletter' | 'waitlist'; email: string; at: string }
) {
  sqlite
    .prepare(
      `INSERT INTO capture_subscriptions
       (id, project_id, kind, email, email_normalized, consent_version, consent_text, consented_at, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'v1', 'consent', ?, 'test', ?, ?)
       ON CONFLICT(project_id, kind, email_normalized) DO UPDATE SET
         id = excluded.id, created_at = excluded.created_at, updated_at = excluded.updated_at,
         state = 'active'
       WHERE capture_subscriptions.state = 'unsubscribed'`
    )
    .run(
      input.id,
      input.project,
      input.kind,
      input.email,
      input.email.toLowerCase(),
      input.at,
      input.at,
      input.at
    );
}

describe('daily PII-free capture receipts', () => {
  it('records feedback and join receipts atomically across India midnight, dedupes active joins, and counts rejoin', async () => {
    const { sqlite, d1, queryCount } = setup();
    sqlite
      .prepare('INSERT INTO feedback (id, project_id, created_at) VALUES (?, ?, ?)')
      .run('feedback-before', 'project-1', '2019-12-31T18:29:59Z');
    sqlite
      .prepare('INSERT INTO feedback (id, project_id, created_at) VALUES (?, ?, ?)')
      .run('feedback-midnight', 'project-1', '2019-12-31T18:30:00Z');

    insertSubscription(sqlite, {
      id: 'join-1',
      project: 'project-1',
      kind: 'newsletter',
      email: 'person@example.test',
      at: '2019-12-31T18:45:00Z',
    });
    insertSubscription(sqlite, {
      id: 'duplicate-active',
      project: 'project-1',
      kind: 'newsletter',
      email: 'person@example.test',
      at: '2019-12-31T19:00:00Z',
    });
    sqlite
      .prepare("UPDATE capture_subscriptions SET state = 'unsubscribed' WHERE id = 'join-1'")
      .run();
    insertSubscription(sqlite, {
      id: 'join-2',
      project: 'project-1',
      kind: 'newsletter',
      email: 'person@example.test',
      at: '2020-01-01T18:30:00Z',
    });
    insertSubscription(sqlite, {
      id: 'waitlist-1',
      project: 'project-2',
      kind: 'waitlist',
      email: 'other@example.test',
      at: '2019-12-31T20:00:00Z',
    });

    const result = await getDailyCaptureCounts(d1, '2020-01-01', ['alpha-app', 'beta-app']);
    expect(result).toEqual({
      coverageStart: '2019-12-31',
      applicabilityByCatalogId: {},
      nativeSessionsApplicabilityByCatalogId: {},
      browserVisitorsApplicabilityByCatalogId: {},
      serverRequestsApplicabilityByCatalogId: {},
      rows: [
        { catalogId: 'alpha-app', feedback: 1, newsletter: 1, waitlist: 0 },
        { catalogId: 'beta-app', feedback: 0, newsletter: 0, waitlist: 1 },
      ],
    });
    expect(queryCount()).toBe(1);
    expect(
      sqlite
        .prepare('SELECT COUNT(*) AS count FROM daily_capture_receipts WHERE india_day = ?')
        .get('2020-01-01')
    ).toMatchObject({ count: 3 });
    const receiptSchema = sqlite
      .prepare("SELECT name FROM pragma_table_info('daily_capture_receipts')")
      .all() as Array<{ name: string }>;
    expect(receiptSchema.map((column) => column.name)).toEqual([
      'id',
      'project_id',
      'event_type',
      'occurred_at',
      'india_day',
    ]);
    expect(migration).not.toMatch(/email|consent_text|submitter/i);
  });

  it('returns null counts before full-day coverage, omits unbound IDs, and returns zeros for bound quiet projects', async () => {
    const { d1 } = setup();
    const beforeCoverage = await getDailyCaptureCounts(d1, '2019-12-30', [
      'alpha-app',
      'unknown-app',
    ]);
    expect(beforeCoverage).toEqual({
      coverageStart: '2019-12-31',
      applicabilityByCatalogId: {},
      nativeSessionsApplicabilityByCatalogId: {},
      browserVisitorsApplicabilityByCatalogId: {},
      serverRequestsApplicabilityByCatalogId: {},
      rows: [{ catalogId: 'alpha-app', feedback: null, newsletter: null, waitlist: null }],
    });

    const coveredQuietDay = await getDailyCaptureCounts(d1, '2019-12-31', ['beta-app']);
    expect(coveredQuietDay.rows).toEqual([
      { catalogId: 'beta-app', feedback: 0, newsletter: 0, waitlist: 0 },
    ]);
  });

  it('rejects partial/future India days and invalid or oversized catalog ID lists', async () => {
    const { d1 } = setup();
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await expect(getDailyCaptureCounts(d1, today, ['alpha-app'])).rejects.toThrow(
      'completed India day'
    );
    await expect(getDailyCaptureCounts(d1, '2020-02-30', ['alpha-app'])).rejects.toThrow(
      'valid calendar day'
    );
    await expect(getDailyCaptureCounts(d1, '2020-01-01', ['../alpha'])).rejects.toThrow(
      'valid catalog IDs'
    );
    await expect(
      getDailyCaptureCounts(
        d1,
        '2020-01-01',
        Array.from({ length: 56 }, () => 'alpha-app')
      )
    ).rejects.toThrow('1 to 55 IDs');
  });

  it('returns canonical capture applicability for all 55 products, including internal newsletter exceptions', async () => {
    const { d1 } = setup();
    const projects = capturePolicy.projects;
    const catalogIds = projects.map(({ id }) => id);
    const result = await getDailyCaptureCounts(d1, '2020-01-01', catalogIds);

    expect(Object.keys(result.applicabilityByCatalogId)).toHaveLength(55);
    expect(Object.keys(result.nativeSessionsApplicabilityByCatalogId)).toHaveLength(55);
    expect(Object.keys(result.browserVisitorsApplicabilityByCatalogId)).toHaveLength(55);
    expect(Object.keys(result.serverRequestsApplicabilityByCatalogId)).toHaveLength(55);
    expect(
      Object.values(result.serverRequestsApplicabilityByCatalogId).filter(
        (value) => value === 'applicable'
      )
    ).toHaveLength(29);
    expect(
      Object.values(result.serverRequestsApplicabilityByCatalogId).filter(
        (value) => value === 'not_applicable'
      )
    ).toHaveLength(26);
    expect(
      Object.values(result.serverRequestsApplicabilityByCatalogId).filter(
        (value) => value === 'unknown'
      )
    ).toHaveLength(0);
    expect(result.serverRequestsApplicabilityByCatalogId.gitstat).toBe('applicable');
    expect(result.serverRequestsApplicabilityByCatalogId['swe-interview-prep']).toBe('applicable');
    expect(result.serverRequestsApplicabilityByCatalogId['every-song-is-a-website']).toBe(
      'not_applicable'
    );
    expect(result.serverRequestsApplicabilityByCatalogId['reddit-insights']).toBe('applicable');
    expect(result.serverRequestsApplicabilityByCatalogId.codevetter).toBe('not_applicable');
    expect(
      Object.values(result.nativeSessionsApplicabilityByCatalogId).filter(
        (value) => value === 'applicable'
      )
    ).toHaveLength(0);
    expect(
      Object.values(result.nativeSessionsApplicabilityByCatalogId).filter(
        (value) => value === 'not_applicable'
      )
    ).toHaveLength(55);
    expect(nativeApplicability.products).toHaveLength(55);
    const nativeProducts = [
      'codevetter',
      'pace',
      'calorie',
      'setline',
      'kith',
      'motion',
      'field-track',
      'anchor',
      'storagedaddy',
      'browserdaddy',
      'performancedaddy',
      'contextdaddy',
      'war-chest',
    ];
    expect(nativeProducts).toHaveLength(13);
    for (const id of nativeProducts) {
      expect(result.nativeSessionsApplicabilityByCatalogId[id]).toBe('not_applicable');
    }
    expect(result.nativeSessionsApplicabilityByCatalogId['slow-serp']).toBe('not_applicable');
    expect(result.nativeSessionsApplicabilityByCatalogId['agent-testing']).toBe('not_applicable');
    const browserNotApplicable = Object.entries(result.browserVisitorsApplicabilityByCatalogId)
      .filter(([, applicability]) => applicability === 'not_applicable')
      .map(([id]) => id)
      .sort();
    expect(browserNotApplicable).toEqual(['slow-serp']);
    expect(result.browserVisitorsApplicabilityByCatalogId['chatgpt-connections']).toBe(
      'applicable'
    );
    expect(result.browserVisitorsApplicabilityByCatalogId['fleet-social']).toBe('applicable');
    expect(result.browserVisitorsApplicabilityByCatalogId['unified-portfolio']).toBe('applicable');
    expect(
      Object.fromEntries(
        ['pace', 'free-ai', 'knowledge-base', 'ios-landings', 'ph-catalog'].map((id) => [
          id,
          result.applicabilityByCatalogId[id],
        ])
      )
    ).toEqual({
      pace: 'newsletter',
      'free-ai': 'newsletter',
      'knowledge-base': 'newsletter',
      'ios-landings': 'newsletter',
      'ph-catalog': 'newsletter',
    });
    const internalNewsletterIds = projects
      .filter(
        ({ applicability, evidence }) =>
          applicability === 'newsletter' &&
          evidence.some(({ field, value }) => field === 'purpose.audience' && value === 'internal')
      )
      .map(({ id }) => id)
      .sort();
    expect(internalNewsletterIds).toEqual([
      'free-ai',
      'ios-landings',
      'knowledge-base',
      'pace',
      'ph-catalog',
    ]);

    const notApplicable = Object.entries(result.applicabilityByCatalogId)
      .filter(([, applicability]) => applicability === 'not-applicable')
      .map(([id]) => id)
      .sort();
    expect(notApplicable).toEqual([
      'agent-testing',
      'chatgpt-connections',
      'field-track',
      'fleet-social',
      'site-health',
      'slow-serp',
      'unified-portfolio',
      'war-chest',
    ]);
    expect(Object.values(result.applicabilityByCatalogId)).not.toContain('waitlist');
    expect(Object.values(result.applicabilityByCatalogId)).not.toContain('undetermined');
  });
});
