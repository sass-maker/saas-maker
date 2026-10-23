import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './helpers';

describe('durable feedback retry identity', () => {
  let sqlite: DatabaseSync;
  let env: Record<string, unknown>;
  let alerts: { log_id: string; event: string; timestamp: number }[];
  let upload: ReturnType<typeof vi.fn>;
  let imageKeys: Set<string>;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, slug TEXT, api_key TEXT, owner_id TEXT);
      INSERT INTO projects VALUES ('first', 'First', 'first', 'pk_first', 'owner'),
                                  ('second', 'Second', 'second', 'pk_second', 'owner');
      CREATE TABLE feedback (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), type TEXT, status TEXT,
        title TEXT, description TEXT, image_url TEXT, submitter_email TEXT, submitter_name TEXT,
        page_url TEXT, page_title TEXT, pinpoint_json TEXT, client_version TEXT, source TEXT,
        upvote_count INTEGER DEFAULT 0, downvote_count INTEGER DEFAULT 0,
        updated_at TEXT, updated_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE capture_subscriptions (
        id TEXT PRIMARY KEY, project_id TEXT, kind TEXT, state TEXT, created_at TEXT
      );
    `);
    for (const name of [
      '0027_catalog_project_bindings.sql',
      '0028_daily_capture_receipts.sql',
      '0029_feedback_submission_fingerprint.sql',
    ])
      sqlite.exec(
        readFileSync(new URL(`../../workers/api/migrations/${name}`, import.meta.url), 'utf8')
      );
    sqlite.exec(`
      INSERT INTO catalog_project_bindings (saas_maker_project_id, catalog_project_id)
      VALUES ('first', 'first-app'), ('second', 'second-app');
      UPDATE daily_capture_coverage SET cutover_at = '2020-01-01T00:00:00Z';
    `);
    const d1 = {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        let parameters: SQLInputValue[] = [];
        return {
          bind(...values: SQLInputValue[]) {
            parameters = values;
            return this;
          },
          async first() {
            return statement.get(...parameters) ?? null;
          },
          async all() {
            return { results: statement.all(...parameters) };
          },
          async run() {
            return { meta: { changes: Number(statement.run(...parameters).changes) } };
          },
        };
      },
    };
    alerts = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        alerts.push(
          ...(body.logs ?? []).filter(
            (log: { event: string }) => log.event === 'feedback.submitted'
          )
        );
        return new Response(null, { status: 202 });
      })
    );
    imageKeys = new Set();
    upload = vi.fn(async (key: string) => {
      imageKeys.add(key);
    });
    env = {
      DB: d1,
      APP_HEALTH_INGEST_KEY: 'synthetic-ingest',
      FEEDBACK_IMAGES: {
        put: upload,
        delete: vi.fn(async (key: string) => {
          imageKeys.delete(key);
        }),
      },
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sqlite.close();
  });

  function submit(id?: unknown, changes: Record<string, unknown> = {}, project = 'first') {
    return request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project-Key': `pk_${project}` },
        body: JSON.stringify({
          type: 'feedback',
          title: 'Synthetic retry',
          description: 'One intended submission',
          source: 'fleet-qa',
          ...(id === undefined ? {} : { submission_id: id }),
          ...changes,
        }),
      },
      env
    );
  }

  function counts() {
    return {
      feedback: sqlite.prepare('SELECT count(*) AS n FROM feedback').get()?.n,
      receipts: sqlite.prepare('SELECT count(*) AS n FROM daily_capture_receipts').get()?.n,
      alertIds: new Set(alerts.map((log) => log.log_id)).size,
    };
  }

  function submitImage(id: string, contents = 'synthetic image') {
    const form = new FormData();
    form.set(
      'feedback',
      JSON.stringify({
        type: 'feedback',
        title: 'Synthetic retry',
        description: 'One intended submission',
        source: 'fleet-qa',
        submission_id: id,
      })
    );
    form.set('screenshot', new File([contents], 'test.png', { type: 'image/png' }));
    return request(
      '/v1/feedback',
      {
        method: 'POST',
        headers: { 'X-Project-Key': 'pk_first' },
        body: form,
      },
      env
    );
  }

  it('reuses a persisted submission after a lost response without a second receipt or alert identity', async () => {
    const id = crypto.randomUUID();
    const first = await submit(id);
    const original = await first.json();
    expect(first.status).toBe(201);
    const retry = await submit(id);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(original);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
    expect(alerts).toHaveLength(2);
    expect(alerts[0].timestamp).toBe(alerts[1].timestamp);
    expect(alerts[0].log_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(original).not.toHaveProperty('submission_fingerprint');
  });

  it('keeps simultaneous retries atomic', async () => {
    const id = crypto.randomUUID();
    const responses = await Promise.all([submit(id), submit(id)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('rejects a reused identity with changed content instead of discarding a new message', async () => {
    const id = crypto.randomUUID();
    expect((await submit(id)).status).toBe(201);
    expect((await submit(id, { description: 'Changed intent' })).status).toBe(409);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
    expect(alerts).toHaveLength(1);
    expect(sqlite.prepare('SELECT description FROM feedback').get()?.description).toBe(
      'One intended submission'
    );
  });

  it('does not conflate separate submissions or different projects', async () => {
    const id = crypto.randomUUID();
    const first = await (await submit(id)).json();
    const other = await (await submit(id, {}, 'second')).json();
    const separate = await (await submit(crypto.randomUUID())).json();
    expect(new Set([first.id, other.id, separate.id]).size).toBe(3);
    expect(counts()).toEqual({ feedback: 3, receipts: 3, alertIds: 3 });
  });

  it('rejects conflicting simultaneous submissions atomically', async () => {
    const id = crypto.randomUUID();
    const responses = await Promise.all([submit(id), submit(id, { description: 'Other intent' })]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
    expect(alerts).toHaveLength(1);
  });

  it('normalizes UUID casing and field whitespace before comparing a retry', async () => {
    const id = crypto.randomUUID();
    expect((await submit(id)).status).toBe(201);
    expect((await submit(id.toUpperCase(), { title: '  Synthetic retry  ' })).status).toBe(200);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('reuses an uploaded image and rejects changed bytes before uploading again', async () => {
    const id = crypto.randomUUID();
    const first = await submitImage(id);
    expect(first.status).toBe(201);
    const original = await first.json();
    const retry = await submitImage(id);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(original);
    expect((await submitImage(id, 'changed image')).status).toBe(409);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('writes no feedback or receipt when image storage fails, then permits retry', async () => {
    const id = crypto.randomUUID();
    upload.mockRejectedValueOnce(new Error('Synthetic image-store failure'));
    expect((await submitImage(id)).status).toBe(500);
    expect(counts()).toEqual({ feedback: 0, receipts: 0, alertIds: 0 });
    expect((await submitImage(id)).status).toBe(201);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('preserves legacy clients that deliberately submit without a retry identity', async () => {
    expect((await submit()).status).toBe(201);
    expect((await submit()).status).toBe(201);
    expect(counts()).toEqual({ feedback: 2, receipts: 2, alertIds: 2 });
  });

  it('keeps simultaneous identical image uploads at one object and receipt', async () => {
    const id = crypto.randomUUID();
    const responses = await Promise.all([submitImage(id), submitImage(id)]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(imageKeys.size).toBe(1);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('removes only the losing conflicting upload while retaining the winning image', async () => {
    let release!: () => void;
    const bothUploaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    let uploads = 0;
    upload.mockImplementation(async (key: string) => {
      imageKeys.add(key);
      if (++uploads === 2) release();
      await bothUploaded;
    });
    const id = crypto.randomUUID();
    const responses = await Promise.all([submitImage(id, 'first'), submitImage(id, 'second')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(imageKeys.size).toBe(1);
    expect(sqlite.prepare('SELECT image_url FROM feedback').get()?.image_url).toBe(
      `https://images.sassmaker.com/${[...imageKeys][0]}`
    );
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
  });

  it('resends the stable alert identity on client retry after an ingest failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
    const id = crypto.randomUUID();
    const first = await submit(id);
    const original = await first.json();
    expect(first.status).toBe(201);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 0 });
    expect((await submit(id)).status).toBe(200);
    expect(counts()).toEqual({ feedback: 1, receipts: 1, alertIds: 1 });
    const attempted = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).logs[0];
    expect(attempted.log_id).toBe(original.id);
    expect(alerts[0]).toEqual(
      expect.objectContaining({ log_id: attempted.log_id, timestamp: attempted.timestamp })
    );
  });

  it.each([
    '',
    'not-a-uuid',
    42,
    null,
  ])('rejects invalid retry identity %s before writing', async (id) => {
    expect((await submit(id)).status).toBe(400);
    expect(counts()).toEqual({ feedback: 0, receipts: 0, alertIds: 0 });
  });
});
