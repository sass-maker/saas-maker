#!/usr/bin/env node
/**
 * GEO Observatory — ledger recorder + report generator.
 *
 * Usage:
 *   node fleet-ops/scripts/geo-observatory-record.mjs <observations.json>
 *   node fleet-ops/scripts/geo-observatory-record.mjs --report-only
 *
 * observations.json: array of entries:
 *   { "date": "YYYY-MM-DD", "product": "<registry id>", "qid": "<config qid>",
 *     "class": "A"|"B"|"C", "top": ["url", ...], "notes": "..." }
 *
 * Validates against fleet-ops/config/geo-observatory.json, appends to the
 * JSONL ledger (all-or-nothing), regenerates the latest-report doc.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLEET_ROOT = resolve(__dirname, '../..');
const CONFIG_PATH = join(FLEET_ROOT, 'fleet-ops/config/geo-observatory.json');
const LEDGER_PATH = join(FLEET_ROOT, 'fleet-ops/data/geo-observatory/ledger.jsonl');
const REPORT_PATH = join(FLEET_ROOT, 'fleet-ops/docs/geo-observatory-latest.md');

const CLASSES = new Set(['A', 'B', 'C']);

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function loadLedger() {
  if (!existsSync(LEDGER_PATH)) return [];
  return readFileSync(LEDGER_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function validate(entries, cfg) {
  const products = new Map(cfg.products.map((p) => [p.id, p]));
  const errors = [];
  entries.forEach((e, i) => {
    const where = `entry ${i} (${e.product ?? '?'} / ${e.qid ?? '?'})`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errors.push(`${where}: bad date`);
    const p = products.get(e.product);
    if (!p) errors.push(`${where}: unknown product`);
    else if (!p.queries.some((q) => q.qid === e.qid)) errors.push(`${where}: unknown qid for product`);
    if (!CLASSES.has(e.class)) errors.push(`${where}: class must be A|B|C`);
    if (!Array.isArray(e.top)) errors.push(`${where}: top must be an array of URLs`);
  });
  return errors;
}

function generateReport(ledger, cfg) {
  const dates = [...new Set(ledger.map((e) => e.date))].sort();
  const recent = dates.slice(-5);
  const byKey = new Map(); // product|qid -> {date -> entry}
  for (const e of ledger) {
    const k = `${e.product}|${e.qid}`;
    if (!byKey.has(k)) byKey.set(k, new Map());
    byKey.get(k).set(e.date, e); // later entries for same date win
  }

  const lines = [];
  lines.push('# GEO Observatory — latest report');
  lines.push('');
  lines.push(`Generated from \`fleet-ops/data/geo-observatory/ledger.jsonl\` ` +
    `(${ledger.length} observations, ${dates.length} run(s): ${dates.join(', ')}).`);
  lines.push('Rubric: A = own domain top-3 · B = via hub/aggregator only · C = absent.');
  lines.push('Do not edit — regenerate via `geo-observatory-record.mjs`.');
  lines.push('');

  // Movers: class change between last two dates
  if (dates.length >= 2) {
    const [prev, last] = dates.slice(-2);
    const movers = [];
    for (const [k, m] of byKey) {
      const a = m.get(prev)?.class;
      const b = m.get(last)?.class;
      if (a && b && a !== b) {
        const dir = b < a ? '📈' : '📉';
        movers.push(`- ${dir} **${k.replace('|', ' / ')}**: ${a} → ${b}`);
      }
    }
    lines.push('## Movers (vs previous run)');
    lines.push('');
    lines.push(movers.length ? movers.join('\n') : '_No class changes._');
    lines.push('');
  }

  lines.push('## Trend');
  lines.push('');
  lines.push(`| product | query (kind) | ${recent.join(' | ')} |`);
  lines.push(`|---|---|${recent.map(() => '---').join('|')}|`);
  for (const p of cfg.products) {
    for (const q of p.queries) {
      const m = byKey.get(`${p.id}|${q.qid}`);
      const cells = recent.map((d) => m?.get(d)?.class ?? '·');
      lines.push(`| ${p.id} | ${q.q.slice(0, 48)} (${q.kind}) | ${cells.join(' | ')} |`);
    }
  }
  lines.push('');

  // Latest notes with evidence
  const last = dates[dates.length - 1];
  if (last) {
    lines.push(`## Latest run notes (${last})`);
    lines.push('');
    for (const e of ledger.filter((x) => x.date === last)) {
      const top = (e.top || []).slice(0, 2).join(', ') || 'no results captured';
      lines.push(`- **${e.product} / ${e.qid}** → ${e.class}. Top: ${top}${e.notes ? ` — ${e.notes}` : ''}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const cfg = loadConfig();
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: geo-observatory-record.mjs <observations.json> | --report-only');
    process.exit(2);
  }

  if (arg !== '--report-only') {
    const entries = JSON.parse(readFileSync(arg, 'utf8'));
    if (!Array.isArray(entries) || entries.length === 0) {
      console.error('observations file must be a non-empty JSON array');
      process.exit(2);
    }
    const errors = validate(entries, cfg);
    if (errors.length) {
      console.error(`Rejected — ${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'}:`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    appendFileSync(LEDGER_PATH, `${entries.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
    console.log(`Appended ${entries.length} observation(s) to ledger.`);
  }

  const ledger = loadLedger();
  writeFileSync(REPORT_PATH, generateReport(ledger, cfg), 'utf8');
  console.log(`Report regenerated → ${REPORT_PATH}`);
}

main();
