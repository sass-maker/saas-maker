#!/usr/bin/env node
/**
 * GitHub Action script to update shared historical Domain Rating data
 * for the global example sites.
 *
 * Fetches from Ahrefs free public endpoint (no key required).
 * Appends weekly-ish snapshots to data/global-dr.json
 *
 * Run locally: node scripts/update-global-dr.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SITES_PATH = join(ROOT, 'data/global-sites.json');
const DATA_PATH = join(ROOT, 'data/global-dr.json');

const API_BASE = 'https://api.ahrefs.com/v3/public/domain-rating-free';
const DELAY_MS = 650; // be nice to the free public endpoint

async function fetchDR(domain) {
  const url = `${API_BASE}?target=${encodeURIComponent(domain)}&output=json`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'drank-global-update/1.0 (+github-actions)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      console.warn(`  [warn] ${domain} -> HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const raw = json?.domain_rating?.domain_rating;
    if (typeof raw === 'number') {
      return raw; // keep full decimal precision from Ahrefs
    }
    console.warn(`  [warn] ${domain} -> unexpected payload`);
    return null;
  } catch (err) {
    console.warn(`  [warn] ${domain} -> ${err.message}`);
    return null;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Updating global DR history...');

  const sites = JSON.parse(readFileSync(SITES_PATH, 'utf8'));
  console.log(`  Sites: ${sites.length}`);

  let existing = { lastUpdated: null, domains: {} };
  try {
    existing = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    console.log(`  Existing data loaded, lastUpdated: ${existing.lastUpdated}`);
  } catch {
    console.log('  No existing data, starting fresh.');
  }

  const now = Date.now();
  // Seed from existing data so domains removed from global-sites.json
  // keep their accumulated history instead of being silently dropped
  const updatedDomains = { ...(existing.domains || {}) };

  for (let i = 0; i < sites.length; i++) {
    const domain = sites[i];
    process.stdout.write(`  Fetching ${domain}... `);

    const dr = await fetchDR(domain);
    const currentHistory = existing.domains?.[domain]?.history || [];

    if (dr !== null) {
      // Only append if we don't already have a point for "today" (same day, rough)
      const today = new Date(now).toISOString().slice(0, 10);
      const lastPoint = currentHistory[currentHistory.length - 1];
      const lastDay = lastPoint ? new Date(lastPoint.ts).toISOString().slice(0, 10) : null;

      const newHistory = [...currentHistory];

      if (lastDay !== today) {
        newHistory.push({ ts: now, dr });
        console.log(`DR=${dr} (new point)`);
      } else {
        // Update the latest point for today if DR changed (rare for daily, but safe)
        if (lastPoint.dr !== dr) {
          newHistory[newHistory.length - 1] = { ts: now, dr };
          console.log(`DR=${dr} (updated today's point)`);
        } else {
          console.log(`DR=${dr} (no change today)`);
        }
      }

      // Optional: keep only last ~2 years of data to prevent unbounded growth
      // const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000;
      // newHistory = newHistory.filter(p => (now - p.ts) < TWO_YEARS);

      updatedDomains[domain] = { history: newHistory };
    } else {
      // Keep previous history if fetch failed
      updatedDomains[domain] = { history: currentHistory };
      console.log('failed (kept previous)');
    }

    if (i < sites.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  const newData = {
    lastUpdated: new Date(now).toISOString(),
    domains: updatedDomains,
    // Preserve any community nominations / user submissions that have been merged into the shared data
    communityNominations: existing.communityNominations || [],
  };

  writeFileSync(DATA_PATH, `${JSON.stringify(newData, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${DATA_PATH}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
