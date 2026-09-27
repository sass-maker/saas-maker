import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { getCatalogProjectId, tryGetCatalogProjectId } from '../../workers/api/src/lib/catalog-project-binding';

const migration = readFileSync(
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
  sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE projects (id TEXT PRIMARY KEY);');
  sqlite.exec("INSERT INTO projects(id) VALUES ('saas-project-1')");
  sqlite.exec(migration);
  const d1 = {
    prepare(sql: string) {
      let args: string[] = [];
      return {
        bind(...next: string[]) {
          args = next;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) ?? null;
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, d1 };
}

describe('server-side Fleet catalog project bindings', () => {
  it('returns the catalog ID only for an explicitly bound SaaS Maker project', async () => {
    const { sqlite, d1 } = setup();
    sqlite
      .prepare('INSERT INTO catalog_project_bindings (saas_maker_project_id, catalog_project_id) VALUES (?, ?)')
      .run('saas-project-1', 'fleet-project-1');

    expect(await getCatalogProjectId(d1, 'saas-project-1')).toBe('fleet-project-1');
    expect(await getCatalogProjectId(d1, 'unbound-project')).toBeNull();
  });

  it('treats binding lookup failures as absent optional attribution', async () => {
    const brokenD1 = {
      prepare: () => ({ bind: () => ({ first: async () => { throw new Error('database unavailable'); } }) }),
    } as unknown as D1Database;
    await expect(tryGetCatalogProjectId(brokenD1, 'saas-project-1')).resolves.toBeNull();
  });
});
