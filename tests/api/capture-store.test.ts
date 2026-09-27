import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  joinCapture,
  listCapture,
  unsubscribeCapture,
} from '../../workers/api/src/lib/capture-store';

const migration = readFileSync(
  new URL('../../workers/api/migrations/0026_capture_subscriptions.sql', import.meta.url),
  'utf8'
);

function d1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let args: Array<string | number> = [];
      return {
        bind(...next: Array<string | number>) {
          args = next;
          return this;
        },
        async run() {
          const result = db.prepare(sql).run(...args);
          return { meta: { changes: Number(result.changes) } };
        },
        async first() {
          return db.prepare(sql).get(...args) ?? null;
        },
        async all() {
          return { results: db.prepare(sql).all(...args) };
        },
      };
    },
  } as unknown as D1Database;
}

const databases: DatabaseSync[] = [];
afterEach(() => {
  for (const db of databases) db.close();
  databases.length = 0;
});

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  databases.push(sqlite);
  sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE projects (id TEXT PRIMARY KEY);');
  sqlite.exec("INSERT INTO projects(id) VALUES ('product-1'), ('product-2')");
  sqlite.exec(migration);
  return { sqlite, db: d1(sqlite) };
}

describe('capture subscription migration and writes', () => {
  it('records one consented join, suppresses duplicates, and counts an explicit rejoin once', async () => {
    const { sqlite, db } = setup();
    const input = {
      id: crypto.randomUUID(),
      projectId: 'product-1',
      kind: 'waitlist' as const,
      email: 'Person@Example.Test',
      source: 'footer',
      consentVersion: 'v1',
      consentText: 'Immutable waitlist consent copy',
      consentedAt: '2026-09-28T01:00:00.000Z',
    };
    expect((await joinCapture(db, input)).joined).toBe(true);
    expect((await joinCapture(db, { ...input, id: crypto.randomUUID() })).joined).toBe(false);
    const first = sqlite
      .prepare('SELECT id, email_normalized, consent_text, consented_at FROM capture_subscriptions')
      .get() as {
      id: string;
      email_normalized: string;
      consent_text: string;
      consented_at: string;
    };
    expect(first.email_normalized).toBe('person@example.test');
    expect(first.consented_at).toBe(input.consentedAt);
    expect(first.consent_text).toBe(input.consentText);
    sqlite
      .prepare("UPDATE capture_subscriptions SET created_at = '2020-01-01 00:00:00' WHERE id = ?")
      .run(first.id);
    expect(await unsubscribeCapture(db, first.id)).toBe(true);
    expect(await unsubscribeCapture(db, first.id)).toBe(false);
    const rejoined = await joinCapture(db, {
      ...input,
      id: crypto.randomUUID(),
      consentedAt: '2026-09-29T01:00:00.000Z',
    });
    expect(rejoined.joined).toBe(true);
    expect(rejoined.id).not.toBe(first.id);
    expect(sqlite.prepare('SELECT created_at FROM capture_subscriptions').get()).not.toMatchObject({
      created_at: '2020-01-01 00:00:00',
    });
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM capture_subscriptions').get()
    ).toMatchObject({
      count: 1,
    });
  });

  it('keeps project lists separate and leaves legacy waitlist data untouched', async () => {
    const { sqlite, db } = setup();
    sqlite.exec('CREATE TABLE waitlist_entries (email TEXT NOT NULL)');
    sqlite.exec("INSERT INTO waitlist_entries(email) VALUES ('legacy@example.test')");
    await joinCapture(db, {
      id: crypto.randomUUID(),
      projectId: 'product-1',
      kind: 'newsletter',
      email: 'new@example.test',
      source: 'footer',
      consentVersion: 'v1',
      consentText: 'Immutable newsletter consent copy',
      consentedAt: '2026-09-28T01:00:00.000Z',
    });
    expect((await listCapture(db, 'product-2')).data).toEqual([]);
    expect((await listCapture(db, 'product-1', 'newsletter')).data).toHaveLength(1);
    expect(sqlite.prepare('SELECT email FROM waitlist_entries').get()).toMatchObject({
      email: 'legacy@example.test',
    });
  });
});
