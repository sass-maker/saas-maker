#!/usr/bin/env npx tsx
/**
 * Export all CockroachDB data as D1-compatible (SQLite) INSERT statements.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/export-cockroachdb.ts > data.sql
 *
 * The output is a single transaction of INSERT statements with proper type
 * conversions for SQLite/D1 compatibility:
 *   - BOOLEAN       -> 0 | 1
 *   - TIMESTAMPTZ   -> ISO 8601 text
 *   - JSONB         -> JSON text
 *   - TEXT[]         -> JSON array text  e.g. '["a","b"]'
 *   - VECTOR         -> JSON array text  e.g. '[0.1,0.2]'
 *   - NULL           -> NULL
 *   - text with '    -> escaped ''
 */

import postgres from 'postgres';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

/**
 * Tables in dependency order. Each entry maps to the real CockroachDB table
 * name. We query information_schema to discover columns dynamically.
 */
const TABLES_IN_ORDER: string[] = [
  'users',
  'projects',
  'sessions',
  'feedback',
  'feedback_votes',
  'knowledge_indexes',
  'documents',
  'document_chunks',
  'waitlist_entries',
  'analytics_events',
  'testimonials',
  'cli_auth_codes',
  'cli_tokens',
  'changelog_entries',
  'forms',
  'form_questions',
  'form_responses',
  'form_answers',
  'ai_requests',
  'roadmap_items',
  'roadmap_votes',
  'directory_listings',
];

// Columns known to be BOOLEAN in the schema. We list them explicitly so we
// can do the 0/1 conversion without relying on pg column metadata (which
// may come back as strings in some drivers).
const BOOLEAN_COLUMNS = new Set([
  'published',
  'is_bot',
  'rate_limit_enabled',
  'badge_verified',
  'required',
  'public',
]);

// Columns that are JSONB and should be serialised as JSON text.
const JSONB_COLUMNS = new Set([
  'properties',
  'metadata',
  'theme',
  'settings',
  'options',
]);

// Columns that are TEXT[] and should be serialised as JSON arrays.
const TEXT_ARRAY_COLUMNS = new Set([
  'tags',
]);

// Columns that are VECTOR and should be serialised as JSON arrays.
const VECTOR_COLUMNS = new Set([
  'embedding',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Convert a single JS value coming from the postgres driver into a SQLite-safe
 * SQL literal.
 */
function toSqlLiteral(value: unknown, columnName: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  // Boolean columns -> 0/1
  if (BOOLEAN_COLUMNS.has(columnName)) {
    if (value === true || value === 't' || value === 'true' || value === 1) return '1';
    if (value === false || value === 'f' || value === 'false' || value === 0) return '0';
    // Fallback: treat truthy/falsy
    return value ? '1' : '0';
  }

  // JSONB columns -> JSON text
  if (JSONB_COLUMNS.has(columnName)) {
    const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
    return `'${escapeSqlString(jsonStr)}'`;
  }

  // TEXT[] columns -> JSON array text
  if (TEXT_ARRAY_COLUMNS.has(columnName)) {
    // postgres driver may return a JS array or a Postgres literal like {a,b}
    let arr: string[];
    if (Array.isArray(value)) {
      arr = value as string[];
    } else if (typeof value === 'string' && value.startsWith('{')) {
      // Parse Postgres array literal: {tag1,tag2}
      arr = value.slice(1, -1).split(',').filter(Boolean);
    } else {
      arr = [];
    }
    const jsonStr = JSON.stringify(arr);
    return `'${escapeSqlString(jsonStr)}'`;
  }

  // VECTOR columns -> JSON array text
  if (VECTOR_COLUMNS.has(columnName)) {
    // CockroachDB VECTOR comes as a string like "[0.1,0.2,...]" or JS array
    let arr: number[];
    if (Array.isArray(value)) {
      arr = value as number[];
    } else if (typeof value === 'string') {
      // Strip brackets if present, parse as JSON
      const cleaned = value.trim();
      try {
        arr = JSON.parse(cleaned.startsWith('[') ? cleaned : `[${cleaned}]`);
      } catch {
        arr = [];
      }
    } else {
      arr = [];
    }
    const jsonStr = JSON.stringify(arr);
    return `'${escapeSqlString(jsonStr)}'`;
  }

  // Date/timestamp objects -> ISO 8601
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // Numbers
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  // Generic booleans that didn't match the column set (safety net)
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  // Everything else -> escaped text
  const str = String(value);

  // Detect ISO timestamps that came as strings from the driver
  // (TIMESTAMPTZ columns the driver didn't auto-convert)
  // We leave them as-is since they're already text.

  return `'${escapeSqlString(str)}'`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const output: string[] = [];

  output.push('-- CockroachDB -> D1 (SQLite) data export');
  output.push(`-- Generated at ${new Date().toISOString()}`);
  output.push('');
  output.push('BEGIN;');
  output.push('');

  for (const table of TABLES_IN_ORDER) {
    // Fetch all rows. Using unsafe() so we can use a dynamic table name.
    let rows: Record<string, unknown>[];
    try {
      rows = await sql.unsafe(`SELECT * FROM "${table}"`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      output.push(`-- WARNING: Could not read table "${table}": ${message}`);
      output.push('');
      continue;
    }

    if (rows.length === 0) {
      output.push(`-- Table "${table}": 0 rows (skipped)`);
      output.push('');
      continue;
    }

    output.push(`-- Table "${table}": ${rows.length} rows`);

    // Use the keys from the first row to determine column order.
    const columns = Object.keys(rows[0]);
    const colList = columns.map((c) => `"${c}"`).join(', ');

    for (const row of rows) {
      const values = columns.map((col) => toSqlLiteral(row[col], col)).join(', ');
      output.push(`INSERT INTO "${table}" (${colList}) VALUES (${values});`);
    }

    output.push('');
  }

  output.push('COMMIT;');

  // Write everything to stdout in one shot for pipe-friendliness
  process.stdout.write(output.join('\n') + '\n');

  await sql.end();
}

main().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
