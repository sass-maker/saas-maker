import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../../workers/api/src/db';

describe('feedback date filters against SQLite timestamps', () => {
  let sqlite: DatabaseSync;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`CREATE TABLE feedback (
      id TEXT PRIMARY KEY, project_id TEXT, type TEXT, status TEXT,
      title TEXT, description TEXT, created_at TEXT, upvote_count INTEGER DEFAULT 0
    )`);
    const insert = sqlite.prepare(`INSERT INTO feedback
      (id, project_id, type, status, title, description, created_at)
      VALUES (?, ?, 'feedback', 'new', 'Synthetic feedback', 'Date filter regression', ?)`);
    for (const [id, project, timestamp] of [
      ['before', 'project', '2026-10-22 14:55:33'],
      ['boundary', 'project', '2026-10-22 14:55:34'],
      ['after', 'project', '2026-10-22 14:56:48'],
      ['legacy-iso', 'project', '2026-10-22T14:55:34.500Z'],
      ['other-project', 'other', '2026-10-22 14:55:34'],
    ])
      insert.run(id, project, timestamp);
  });

  afterEach(() => sqlite.close());

  function repository() {
    const d1 = {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        return {
          bind(...parameters: SQLInputValue[]) {
            return {
              first: async () => statement.get(...parameters) ?? null,
              all: async () => ({ results: statement.all(...parameters) }),
            };
          },
        };
      },
    };
    return getDb(d1 as unknown as D1Database);
  }

  it('includes stored SQLite rows inside an ISO request window', async () => {
    const result = await repository().listFeedback('project', {
      since: '2026-10-22T14:55:34.000Z',
      until: '2026-10-22T14:57:00.000Z',
    });
    expect(result.data.map((row) => row.id).sort()).toEqual(['after', 'boundary', 'legacy-iso']);
    expect(result.total).toBe(3);
  });

  it('includes legacy ISO rows inside a SQLite-formatted request window', async () => {
    const result = await repository().listFeedback('project', {
      since: '2026-10-22 14:55:34',
      until: '2026-10-22 14:55:35',
    });
    expect(result.data.map((row) => row.id).sort()).toEqual(['boundary', 'legacy-iso']);
    expect(result.total).toBe(2);
  });

  it('compares equivalent timezone offsets and inclusive boundaries', async () => {
    const result = await repository().listFeedback('project', {
      since: '2026-10-22T20:25:34+05:30',
      until: '2026-10-22T20:25:34.500+05:30',
    });
    expect(result.data.map((row) => row.id).sort()).toEqual(['boundary', 'legacy-iso']);
    expect(result.total).toBe(2);
  });

  it('does not truncate a fractional lower bound to the preceding second', async () => {
    const result = await repository().listFeedback('project', {
      since: '2026-10-22T14:55:34.001Z',
      until: '2026-10-22T14:55:34.500Z',
    });
    expect(result.data.map((row) => row.id)).toEqual(['legacy-iso']);
    expect(result.total).toBe(1);
  });
});
