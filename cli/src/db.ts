import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_DIR = join(homedir(), '.psi-swarm');
const DEFAULT_DB = join(DEFAULT_DIR, 'history.db');

export interface RunRow {
  id: number;
  url: string;
  preset: string;
  started_at: number;
  finished_at: number | null;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
  tbt: number | null;
  fcp: number | null;
  ttfb: number | null;
  si: number | null;
  performance_score: number | null;
  error: string | null;
  tag: string | null;
}

export interface NewRun {
  url: string;
  preset: string;
  started_at: number;
  finished_at: number;
  metrics?: {
    lcp?: number;
    cls?: number;
    inp?: number;
    tbt?: number;
    fcp?: number;
    ttfb?: number;
    si?: number;
    performance_score?: number;
  };
  error?: string;
  tag?: string;
}

export class HistoryDB {
  private db: Database.Database;

  constructor(path: string = DEFAULT_DB) {
    mkdirSync(DEFAULT_DIR, { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        preset TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        lcp REAL,
        cls REAL,
        inp REAL,
        tbt REAL,
        fcp REAL,
        ttfb REAL,
        si REAL,
        performance_score REAL,
        error TEXT,
        tag TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_runs_url_preset ON runs(url, preset);
      CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
      CREATE INDEX IF NOT EXISTS idx_runs_tag ON runs(tag);
    `);
  }

  insert(r: NewRun): number {
    const stmt = this.db.prepare(`
      INSERT INTO runs (
        url, preset, started_at, finished_at,
        lcp, cls, inp, tbt, fcp, ttfb, si, performance_score,
        error, tag
      ) VALUES (
        @url, @preset, @started_at, @finished_at,
        @lcp, @cls, @inp, @tbt, @fcp, @ttfb, @si, @performance_score,
        @error, @tag
      )
    `);
    const m = r.metrics ?? {};
    const result = stmt.run({
      url: r.url,
      preset: r.preset,
      started_at: r.started_at,
      finished_at: r.finished_at,
      lcp: m.lcp ?? null,
      cls: m.cls ?? null,
      inp: m.inp ?? null,
      tbt: m.tbt ?? null,
      fcp: m.fcp ?? null,
      ttfb: m.ttfb ?? null,
      si: m.si ?? null,
      performance_score: m.performance_score ?? null,
      error: r.error ?? null,
      tag: r.tag ?? null,
    });
    return Number(result.lastInsertRowid);
  }

  recentRuns(url: string, preset?: string, limit = 500): RunRow[] {
    if (preset) {
      return this.db
        .prepare(
          `SELECT * FROM runs WHERE url = ? AND preset = ? ORDER BY started_at DESC LIMIT ?`,
        )
        .all(url, preset, limit) as RunRow[];
    }
    return this.db
      .prepare(`SELECT * FROM runs WHERE url = ? ORDER BY started_at DESC LIMIT ?`)
      .all(url, limit) as RunRow[];
  }

  runsByTag(url: string, tag: string): RunRow[] {
    return this.db
      .prepare(
        `SELECT * FROM runs WHERE url = ? AND tag = ? ORDER BY started_at DESC`,
      )
      .all(url, tag) as RunRow[];
  }

  urls(): { url: string; count: number; last: number }[] {
    return this.db
      .prepare(
        `SELECT url, COUNT(*) as count, MAX(started_at) as last
         FROM runs GROUP BY url ORDER BY last DESC`,
      )
      .all() as { url: string; count: number; last: number }[];
  }

  close() {
    this.db.close();
  }
}
