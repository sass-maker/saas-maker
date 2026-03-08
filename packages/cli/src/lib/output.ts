import { table } from './ui.js';

export type OutputFormat = 'table' | 'json';

export interface OutputOptions {
  output?: OutputFormat;
  select?: string;
  raw?: boolean;
  defaultColumns?: string[];
  emptyMessage?: string;
}

function parseSelect(select?: string): string[] {
  if (!select) return [];
  return select
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getByPath(value: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function serializeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function pickSelection(value: unknown, fields: string[]): unknown {
  if (fields.length === 0) return value;

  if (Array.isArray(value)) {
    return value.map((item) => pickSelection(item, fields));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field] = getByPath(value, field);
  }
  return out;
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
  }
  if (value && typeof value === 'object') {
    const maybeData = (value as Record<string, unknown>).data;
    if (Array.isArray(maybeData)) {
      return maybeData.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object');
    }
  }
  return [];
}

export function printOutput(value: unknown, options: OutputOptions = {}): void {
  const format = options.output ?? 'table';
  const fields = parseSelect(options.select);

  if (format === 'json') {
    const selected = pickSelection(value, fields);
    if (options.raw) {
      console.log(JSON.stringify(selected));
      return;
    }
    console.log(JSON.stringify(selected, null, 2));
    return;
  }

  const rows = normalizeRows(value);
  if (rows.length > 0) {
    const columns = fields.length > 0
      ? fields
      : options.defaultColumns?.filter((key) => rows.some((row) => getByPath(row, key) !== undefined))
        ?? Object.keys(rows[0]).slice(0, 8);
    const rendered = [
      columns.map((c) => c.toUpperCase()),
      ...rows.map((row) => columns.map((c) => serializeCell(getByPath(row, c)))),
    ];
    table(rendered);
    return;
  }

  if (value && typeof value === 'object') {
    const objectValue = pickSelection(value, fields);
    const entries = Object.entries(objectValue as Record<string, unknown>);
    if (entries.length > 0) {
      table([
        ['KEY', 'VALUE'],
        ...entries.map(([k, v]) => [k, serializeCell(v)]),
      ]);
      return;
    }
  }

  console.log(options.emptyMessage ?? 'No data');
}
