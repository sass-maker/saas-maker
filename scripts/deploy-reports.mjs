#!/usr/bin/env node
/**
 * Deploys generated reports to GitHub Pages.
 *
 * Inputs:
 *   - /tmp/psi-deploy/*.html         (the per-site reports the CLI produced)
 *   - ../web/dist/                   (the Astro-built bundle)
 *
 * Output structure on the gh-pages branch:
 *   /                  index.html (custom landing — Latest + history)
 *   /r/index.html      Astro static-report shell (used by per-run HTMLs)
 *   /_astro/...        React bundle + CSS
 *   /runs/<timestamp>/
 *       index.html     batch index
 *       *.html         per-site reports
 *
 * Each per-run HTML is small (~12 KB) and loads the shared bundle from /_astro/.
 */

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const WEB_DIST = resolve(REPO_ROOT, 'web/dist');
const INPUT_DIR = '/tmp/psi-deploy';
const GH_WT = '/tmp/psi-gh-pages';
const REPO = 'https://github.com/sarthakagrawal927/psi-swarm.git';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}
function runCapture(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf-8', ...opts }).trim();
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function readReportMeta(html, slug) {
  // Extract URL + select stats from the embedded JSON for the landing page cards.
  const m = html.match(/window\.__PSI_DATA__ = ({[\s\S]*?});<\/script>/);
  if (!m) return { slug, url: slug };
  try {
    const data = JSON.parse(m[1]);
    const desktopP75Lcp = data.perPreset?.desktop?.stats?.lcp?.p75;
    const mobileP75Lcp = data.perPreset?.['mobile-mid']?.stats?.lcp?.p75;
    const cruxMobileLcp = data.crux?.mobile?.metrics?.lcp?.p75;
    const reasoningSnippet = data.reasoning?.text?.slice(0, 220);
    return {
      slug,
      url: data.url,
      desktopP75Lcp,
      mobileP75Lcp,
      cruxMobileLcp,
      reasoningSnippet,
      generatedAt: data.generatedAt,
    };
  } catch {
    return { slug, url: slug };
  }
}

function fmtMs(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
}

function tier(ms) {
  if (typeof ms !== 'number') return 'dim';
  if (ms <= 2500) return 'good';
  if (ms <= 4000) return 'warn';
  return 'poor';
}

const PAGE_CSS = `
  :root { --bg:#0b0f17; --panel:#131826; --border:#1f2738; --text:#e6e9f2; --dim:#8089a4; --cyan:#38bdf8; --good:#22c55e; --warn:#facc15; --poor:#ef4444; }
  *,*::before,*::after { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; font-feature-settings:"tnum" on; }
  main { max-width:1100px; margin:0 auto; padding:40px 24px 80px; }
  h1 { font-size:32px; margin:0; letter-spacing:-0.02em; }
  h1 .cyan { color:var(--cyan); }
  .sub { color:var(--dim); font-size:15px; margin-top:6px; max-width:720px; line-height:1.5; }
  .meta { color:var(--dim); font-size:13px; margin-top:16px; }
  .meta a { color:var(--cyan); text-decoration:none; }
  h2 { font-size:18px; letter-spacing:-0.01em; margin:40px 0 16px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:18px; }
  .card { display:block; background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:22px; color:inherit; text-decoration:none; transition:transform 0.12s ease, border-color 0.12s ease; }
  .card:hover { transform:translateY(-2px); border-color:var(--cyan); }
  .card-title { font-size:17px; font-weight:600; letter-spacing:-0.01em; }
  .card-url { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--dim); margin-top:4px; word-break:break-all; }
  .card-metrics { display:flex; gap:24px; margin-top:16px; }
  .metric { display:flex; flex-direction:column; gap:2px; }
  .metric .label { font-size:11px; color:var(--dim); text-transform:uppercase; letter-spacing:0.04em; }
  .metric .value { font-family:ui-monospace,Menlo,monospace; font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; }
  .good { color:var(--good); } .warn { color:var(--warn); } .poor { color:var(--poor); } .dim { color:var(--dim); }
  .card-reasoning { font-size:13px; color:var(--text); opacity:0.85; line-height:1.55; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
  .card-cta { font-size:13px; color:var(--cyan); margin-top:14px; font-weight:500; }
  .runs-list { display:flex; flex-direction:column; gap:6px; margin-top:16px; }
  .run-item { display:flex; align-items:center; gap:14px; padding:10px 14px; background:var(--panel); border:1px solid var(--border); border-radius:8px; color:inherit; text-decoration:none; font-size:14px; }
  .run-item:hover { border-color:var(--cyan); }
  .run-item .ts { font-family:ui-monospace,Menlo,monospace; color:var(--dim); }
  .run-item .count { font-size:12px; color:var(--dim); }
  footer { color:var(--dim); font-size:13px; margin-top:48px; text-align:center; line-height:1.6; }
  footer a { color:var(--cyan); }
`;

function renderCard(m, hrefPrefix = '') {
  const dLcp = fmtMs(m.desktopP75Lcp);
  const mLcp = fmtMs(m.mobileP75Lcp);
  const cLcp = fmtMs(m.cruxMobileLcp);
  return `
    <a class="card" href="${hrefPrefix}${m.slug}.html">
      <div class="card-title">${m.slug}</div>
      <div class="card-url">${m.url ?? ''}</div>
      <div class="card-metrics">
        <div class="metric"><span class="label">desktop LCP p75</span><span class="value ${tier(m.desktopP75Lcp)}">${dLcp}</span></div>
        <div class="metric"><span class="label">mobile-mid LCP p75</span><span class="value ${tier(m.mobileP75Lcp)}">${mLcp}</span></div>
        ${typeof m.cruxMobileLcp === 'number' ? `<div class="metric"><span class="label">CrUX mobile LCP</span><span class="value ${tier(m.cruxMobileLcp)}">${cLcp}</span></div>` : ''}
      </div>
      ${m.reasoningSnippet ? `<div class="card-reasoning">${m.reasoningSnippet}…</div>` : ''}
      <div class="card-cta">view full report →</div>
    </a>
  `;
}

function renderBatchIndex(stamp, metas, repoRootHref) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>psi-swarm · run ${stamp}</title><style>${PAGE_CSS}</style></head><body><main>
  <header>
    <h1><span class="cyan">psi</span>-swarm · run ${stamp}</h1>
    <div class="meta"><a href="${repoRootHref}">← all runs</a> · <a href="https://github.com/sarthakagrawal927/psi-swarm">repo</a></div>
  </header>
  <div class="grid">${metas.map((m) => renderCard(m)).join('')}</div>
  <footer>Generated by <a href="https://github.com/sarthakagrawal927/psi-swarm">psi-swarm</a></footer>
</main></body></html>`;
}

function renderRootIndex(latestStamp, latestMetas, allRuns, repoRootHref) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>psi-swarm · fleet reports</title><style>${PAGE_CSS}</style></head><body><main>
  <header>
    <h1><span class="cyan">psi</span>-swarm · fleet reports</h1>
    <div class="sub">Distributional Lighthouse audits across realistic device/network presets, with LLM reasoning grounded in actual audit findings. Each card opens a full per-site report with CrUX comparison, lab-vs-field gap, opportunities, and the reasoning narrative.</div>
    <div class="meta">Latest run: <span class="mono">${latestStamp}</span> · <a href="https://github.com/sarthakagrawal927/psi-swarm">github.com/sarthakagrawal927/psi-swarm</a></div>
  </header>

  <h2>Latest run</h2>
  <div class="grid">${latestMetas.map((m) => renderCard(m, `runs/${latestStamp}/`)).join('')}</div>

  <h2>All runs</h2>
  <div class="runs-list">
    ${allRuns.map((r) => `<a class="run-item" href="runs/${r.stamp}/"><span class="ts">${r.stamp}</span><span class="count">${r.siteCount} site${r.siteCount === 1 ? '' : 's'}</span></a>`).join('')}
  </div>

  <footer>
    Lab data is emulated network + CPU · for honest p99 use a RUM tool<br>
    <a href="https://github.com/sarthakagrawal927/psi-swarm">github.com/sarthakagrawal927/psi-swarm</a>
  </footer>
</main></body></html>`;
}

// === Main ===

console.log('▶ deploy-reports starting');

if (!existsSync(WEB_DIST)) {
  console.error(`✗ web/dist not found at ${WEB_DIST}. Run \`ASTRO_BASE=/psi-swarm/ npm run build:web\` first.`);
  process.exit(1);
}
if (!existsSync(INPUT_DIR)) {
  console.error(`✗ Input dir ${INPUT_DIR} not found. Run psi-swarm with --output html first.`);
  process.exit(1);
}

const reportFiles = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.html'));
if (reportFiles.length === 0) {
  console.error('✗ No HTML reports found in', INPUT_DIR);
  process.exit(1);
}
console.log(`  ${reportFiles.length} reports in ${INPUT_DIR}`);

// Clone or refresh the gh-pages worktree.
if (existsSync(GH_WT)) {
  rmSync(GH_WT, { recursive: true, force: true });
}
try {
  run(`git clone --branch gh-pages --single-branch ${REPO} ${GH_WT}`);
} catch {
  console.log('  gh-pages branch not found — creating empty');
  mkdirSync(GH_WT, { recursive: true });
  run('git init -b gh-pages', { cwd: GH_WT });
  run(`git remote add origin ${REPO}`, { cwd: GH_WT });
}

// Sync the Astro build artifacts to the gh-pages root.
console.log('  syncing web/dist → gh-pages');
run(`cp -R ${WEB_DIST}/_astro ${GH_WT}/`);
mkdirSync(`${GH_WT}/r`, { recursive: true });
copyFileSync(`${WEB_DIST}/r/index.html`, `${GH_WT}/r/index.html`);

// Create the new timestamped run directory.
const stamp = nowStamp();
const runDir = join(GH_WT, 'runs', stamp);
mkdirSync(runDir, { recursive: true });

const metas = [];
for (const f of reportFiles) {
  const html = readFileSync(join(INPUT_DIR, f), 'utf-8');
  const slug = f.replace(/\.html$/, '');
  metas.push(readReportMeta(html, slug));
  copyFileSync(join(INPUT_DIR, f), join(runDir, f));
}
metas.sort((a, b) => a.slug.localeCompare(b.slug));

// Per-batch index inside runs/<stamp>/
writeFileSync(join(runDir, 'index.html'), renderBatchIndex(stamp, metas, '../../'));

// Build the All Runs list from existing runs/* dirs.
const runsRoot = join(GH_WT, 'runs');
const allRuns = readdirSync(runsRoot)
  .filter((d) => {
    const p = join(runsRoot, d);
    return statSync(p).isDirectory();
  })
  .map((d) => {
    const sites = readdirSync(join(runsRoot, d)).filter((f) => f.endsWith('.html') && f !== 'index.html').length;
    return { stamp: d, siteCount: sites };
  })
  .sort((a, b) => (a.stamp < b.stamp ? 1 : -1));

writeFileSync(join(GH_WT, 'index.html'), renderRootIndex(stamp, metas, allRuns, './'));

// Commit + push.
console.log('  committing + pushing gh-pages');
try {
  run('git add -A', { cwd: GH_WT });
  // Set local user only on this commit to avoid touching global config.
  run(`git -c user.email=sarthakagrawal927@gmail.com -c user.name="Sarthak Agrawal" commit -m "Deploy reports ${stamp}"`, { cwd: GH_WT });
  run('git push -u origin gh-pages --force', { cwd: GH_WT });
} catch (err) {
  console.error('Push failed:', err.message);
  process.exit(1);
}

console.log(`\n✓ Deployed ${metas.length} reports`);
console.log(`  Run: https://sarthakagrawal927.github.io/psi-swarm/runs/${stamp}/`);
console.log(`  Root: https://sarthakagrawal927.github.io/psi-swarm/`);
