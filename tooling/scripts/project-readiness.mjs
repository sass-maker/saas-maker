#!/usr/bin/env node
// project-readiness.mjs — read-only gap detector for the Fleet new-project
// checklist (docs/new-project-checklist.md). Resolves a project from the
// SaaS Maker catalog, then reports which checklist items are observably
// done, which are missing, and which tool or skill fixes each gap.
//
// Read-only and credential-free: it inspects local checkouts, local config
// registries, and (with --live) unauthenticated HTTP status of public URLs.
// It never writes to the catalog, the repo, or any provider.
//
// Usage:
//   node tooling/scripts/project-readiness.mjs --project <catalog-id> [--live]
//   node tooling/scripts/project-readiness.mjs --repo <fleet-dir-name> [--live]
//   add --format json for machine output

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOLING_ROOT = resolve(import.meta.dirname, '..');
const REPO_ROOT = resolve(TOOLING_ROOT, '..');
const FLEET_ROOT = resolve(REPO_ROOT, '..');
const SITE_HEALTH = resolve(FLEET_ROOT, 'site-health');
const CATALOG_PATH = resolve(REPO_ROOT, 'catalog/projects.json');
const CLARITY_REGISTRY = resolve(TOOLING_ROOT, 'config/clarity-projects.json');
const IDENTITY_PATH = resolve(TOOLING_ROOT, 'config/entity-identity-canonical.json');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.astro', '.next', '.wrangler', 'build',
  'coverage', '.turbo', 'out', '.expo', 'vendor',
]);
const TEXT_EXT = /\.(astro|tsx?|jsx?|mjs|cjs|svelte|vue|html?|md|mdx|json|ya?ml|toml|css)$/i;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 4000;

function usage() {
  return `Usage:
  node tooling/scripts/project-readiness.mjs --project <catalog-id> [--live] [--format markdown|json]
  node tooling/scripts/project-readiness.mjs --repo <fleet-dir> [--live] [--format markdown|json]

Read-only gap detector for docs/new-project-checklist.md. Without --live it
checks local source and registries only; --live adds unauthenticated HTTP
probes of the first cataloged domain.
`;
}

function parseArgs(argv) {
  const options = { projectId: null, repoName: null, live: false, format: 'markdown' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--help') return { help: true };
    if (flag === '--live') { options.live = true; continue; }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--project') options.projectId = value;
    else if (flag === '--repo') options.repoName = value;
    else if (flag === '--format') {
      if (!['markdown', 'json'].includes(value)) throw new Error('--format must be markdown or json');
      options.format = value;
    } else throw new Error(`Unknown option: ${flag}`);
    i += 1;
  }
  return options;
}

function loadJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

// --------------------------------------------------------------------------
// repo source index: collect text files once, expose grep helpers
// --------------------------------------------------------------------------

function collectSources(root) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < MAX_FILES) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile() && TEXT_EXT.test(entry.name)) {
        try {
          if (statSync(full).size <= MAX_FILE_BYTES) files.push(full);
        } catch { /* unreadable file — ignore */ }
      }
    }
  }
  return files;
}

function grepSources(files, pattern, limit = 12) {
  const hits = [];
  for (const file of files) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    if (pattern.test(text)) {
      hits.push(file);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

function rel(file, root) {
  return file.startsWith(root) ? file.slice(root.length + 1) : file;
}

// --------------------------------------------------------------------------
// check helpers
// --------------------------------------------------------------------------

const pass = (evidence) => ({ status: 'pass', evidence });
const fail = (evidence, fix) => ({ status: 'fail', evidence, fix });
const skip = (evidence) => ({ status: 'skip', evidence });
const unknown = (evidence) => ({ status: 'unknown', evidence });

function curlStatus(url) {
  const result = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-m', '12', '-L', url], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function curlBody(url, maxBytes = 200 * 1024) {
  const result = spawnSync('curl', ['-sS', '-m', '15', '-L', '--max-filesize', String(maxBytes), url], { encoding: 'utf8', maxBuffer: maxBytes * 2 });
  return result.status === 0 ? result.stdout : null;
}

// --------------------------------------------------------------------------
// checks
// --------------------------------------------------------------------------

function checkScaffold(repoDir, repoName) {
  const checks = [];
  const has = (p) => existsSync(join(repoDir, p));
  checks.push(['scaffold.agents', has('AGENTS.md')
    ? pass('AGENTS.md present')
    : fail('no AGENTS.md', 'fleet-init scaffold or hand-write the standard fleet agent file')]);
  checks.push(['scaffold.status', has('PROJECT_STATUS.md')
    ? pass('PROJECT_STATUS.md present')
    : fail('no PROJECT_STATUS.md', 'add the 6-section status file (see fleet-init)')]);
  checks.push(['scaffold.gitignore', has('.gitignore')
    ? pass('.gitignore present')
    : fail('no .gitignore', 'fleet-init standard ignores')]);
  const wfDir = join(repoDir, '.github', 'workflows');
  const hasCi = existsSync(wfDir) && readdirSync(wfDir).some((f) => /\.ya?ml$/.test(f));
  checks.push(['scaffold.ci', hasCi
    ? pass('.github/workflows present')
    : fail('no CI workflow', 'fleet-init ci.yml or equivalent lint+typecheck+test')]);
  checks.push(['scaffold.readme', has('README.md') || has('readme.md')
    ? pass('README present')
    : fail('no README', 'readme skill — local setup, architecture, deployment')]);
  checks.push(['scaffold.openspec', has('openspec/config.yaml') || has('openspec/specs')
    ? pass('openspec/ spec home present')
    : fail('no openspec/ spec home', 'openspec init --tools claude,codex,devin (spec-driven + openspec-* skills)')]);
  return checks;
}

function checkCatalog(project, projectId) {
  const checks = [];
  if (!project) {
    checks.push(['catalog.entry', fail(`no catalog/projects.json entry for ${projectId ?? '(unresolved repo)'}`, 'add the project record in saas-maker catalog, then pnpm catalog:sync')]);
    return checks;
  }
  checks.push(['catalog.entry', pass(`catalog entry: ${project.name ?? project.id}`)]);
  const shareable = project.sharing?.shareable === true || project.presentation?.public === true;
  if (!shareable) {
    checks.push(['catalog.directory', skip('project is not marked shareable/public — directory listing n/a')]);
  } else {
    const dir = project.presentation?.directory;
    checks.push(['catalog.directory', dir && (dir.technologies || dir.description || dir.tagline)
      ? pass('presentation.directory populated')
      : fail('shareable but presentation.directory is empty', 'fill presentation.directory in catalog/projects.json, then pnpm catalog:sync-public')]);
  }
  return checks;
}

function checkIdentity(catalog, projectId) {
  const checks = [];
  const geo = (catalog?.geoIdentities ?? []).find((g) => g.id === projectId);
  const canonical = loadJson(IDENTITY_PATH);
  const decided = (canonical?.decisions ?? []).some((d) => d.id === projectId);
  if (geo || decided) {
    checks.push(['identity.record', pass(`identity record (${geo ? 'geoIdentities' : 'canonical decisions'})`)]);
  } else {
    checks.push(['identity.record', fail('no geoIdentities or canonical-name record', 'add identity record — see tooling/docs/agent-indexing-standard.md → Name agreement')]);
  }
  return checks;
}

function checkDossier(projectId) {
  const file = resolve(SITE_HEALTH, 'docs/project-dossiers', `${projectId}.yaml`);
  return [['dossier.exists', existsSync(file)
    ? pass(rel(file, FLEET_ROOT))
    : fail('no project dossier', 'pnpm --dir site-health docs:projects (after catalog:sync)')]];
}

function checkSurfaces(repoDir, sources) {
  const checks = [];
  const relHits = (hits) => hits.map((h) => rel(h, repoDir)).join(', ');
  const landingDirs = ['landing-astro', 'landing', 'website', 'apps/web/landing-astro']
    .filter((d) => existsSync(join(repoDir, d)));
  const hasAppSurface = ['src', 'app', 'apps/web'].some((d) => existsSync(join(repoDir, d)));
  if (landingDirs.length) {
    checks.push(['landing.surface', pass(`landing source: ${landingDirs.join(', ')}`)]);
  } else if (hasAppSurface) {
    checks.push(['landing.surface', pass('no separate landing dir — app homepage likely serves as landing (allowed)')]);
  } else {
    checks.push(['landing.surface', unknown('no landing-astro/, website/, or app source found')]);
  }

  const strip = grepSources(sources, /project-strip\.js/);
  const aiFooter = grepSources(sources, /ai-chat-footer\.js/);
  checks.push(['footer.contract', strip.length && aiFooter.length
    ? pass(`project strip + Ask AI wired (${relHits([...strip, ...aiFooter].slice(0, 3))})`)
    : fail(`footer contract incomplete (strip: ${strip.length}, ask-ai: ${aiFooter.length})`, 'Site Health docs/footer-compliance-latest.md — authored footer + shared extension')]);

  const favicon = grepSources(sources, /favicon|apple-touch-icon/, 4);
  const hasFaviconFile = ['public/favicon.svg', 'public/favicon.ico', 'src/assets/favicon.svg', 'app/favicon.ico', 'public/favicon.png']
    .some((p) => existsSync(join(repoDir, p)));
  checks.push(['assets.favicon', hasFaviconFile || favicon.length
    ? pass(hasFaviconFile ? 'favicon files present' : `favicon references: ${relHits(favicon)}`)
    : fail('no favicon found', 'favicon skill — full set + link tags')]);

  const og = grepSources(sources, /og:image|twitter:image/, 4);
  checks.push(['assets.ogImage', og.length
    ? pass(`og:image in ${relHits(og)}`)
    : fail('no og:image in source', 'feature-image skill — 1200×630 card')]);
  return checks;
}

function checkTrust(repoDir, sources) {
  const checks = [];
  const privacy = grepSources(sources, /privacy policy/i, 6)
    .concat(sources.filter((f) => /privac/i.test(f)))
    .filter((f, i, all) => all.indexOf(f) === i)
    .slice(0, 4);
  checks.push(['legal.privacy', privacy.length
    ? pass(`privacy surface: ${privacy.map((f) => rel(f, repoDir)).join(', ')}`)
    : fail('no privacy page/policy found', 'add /privacy and link it from the footer — security-audit verifies claims hold')]);
  const turnstile = grepSources(sources, /turnstile|cf-turnstile/);
  const markupFiles = sources.filter((f) => /\.(astro|tsx?|jsx?|svelte|vue|html?)$/i.test(f));
  const formFiles = grepSources(markupFiles, /<form[\s>]|<input[^>]+type=["']?email/i, 6);
  const submitForms = grepSources(formFiles, /waitlist|newsletter|subscrib|sign.?up|type=["']?email/i, 4);
  checks.push(['security.forms', turnstile.length
    ? pass('bot verification present')
    : submitForms.length
      ? fail(`submission-form signals without Turnstile: ${submitForms.map((f) => rel(f, repoDir)).join(', ')}`, 'turnstile-spin skill')
      : skip(formFiles.length ? 'only non-submission forms detected' : 'no forms detected')]);
  return checks;
}

function checkAgent(repoDir, sources) {
  const checks = [];
  const relHits = (hits) => hits.map((h) => rel(h, repoDir)).join(', ');
  const llms = grepSources(sources, /llms\.txt|llms-full/, 6);
  const llmsFile = ['public/llms.txt', 'public/llms-full.txt', 'src/pages/llms.txt.ts', 'src/pages/llms.txt.astro', 'app/llms.txt/route.ts']
    .some((p) => existsSync(join(repoDir, p)));
  checks.push(['agent.llms', llmsFile || llms.length
    ? pass(llmsFile ? 'llms.txt source present' : `references: ${relHits(llms)}`)
    : fail('no llms.txt source', 'templates/agent-surfaces/llms.txt.tmpl + agent-indexing-standard contract')]);

  const apiAi = grepSources(sources, /api\/ai\b|api-ai|apiAi/, 6);
  checks.push(['agent.apiAi', apiAi.length
    ? pass(`api surface: ${relHits(apiAi)}`)
    : fail('no /api/ai discovery catalog', 'templates/agent-surfaces/api-ai.example.json + lib/agent-surfaces')]);

  const sitemap = grepSources(sources, /sitemap/i, 6);
  const sitemapFile = ['public/sitemap.xml', 'public/robots.txt', 'app/sitemap.ts', 'src/pages/sitemap.xml.ts']
    .some((p) => existsSync(join(repoDir, p)));
  const sitemapDep = existsSync(join(repoDir, 'package.json'))
    && /@astrojs\/sitemap|next-sitemap|sitemap/.test(readFileSync(join(repoDir, 'package.json'), 'utf8'));
  checks.push(['agent.sitemap', sitemapFile || sitemapDep || sitemap.length
    ? pass('sitemap configured or emitted')
    : fail('no sitemap found', 'sitemap.xml + robots Sitemap: line — agent-indexing-standard')]);

  const jsonld = grepSources(sources, /application\/ld\+json|fleet-jsonld/, 4);
  checks.push(['agent.jsonld', jsonld.length
    ? pass(`JSON-LD in ${relHits(jsonld)}`)
    : fail('no JSON-LD structured data', 'agent-indexing-standard → JSON-LD @graph block')]);
  return checks;
}

function checkClarity(projectId, repoName, repoDir) {
  const registry = loadJson(CLARITY_REGISTRY);
  const entry = (registry?.projects ?? []).find((p) => p.id === projectId || p.repo === repoName);
  if (!entry) {
    return [['clarity.registry', fail('no entry in tooling/config/clarity-projects.json', 'clarity-fleet-rollout skill — create project, wire snippet, record receipt')]];
  }
  const wired = entry.wiredFiles ?? [];
  const missing = wired.filter((f) => !existsSync(resolve(FLEET_ROOT, f)));
  if (!wired.length) {
    return [['clarity.registry', skip(`registry entry exists, intentionally unwired: ${entry.reason ?? 'no reason recorded'}`)]];
  }
  return [['clarity.registry', missing.length
    ? fail(`wired files missing: ${missing.join(', ')}`, 'clarity-fleet-rollout — re-wire or fix registry')
    : pass(`wired: ${wired.join(', ')}`)]];
}

function checkGithub(repoDir) {
  const url = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, encoding: 'utf8' });
  const remote = url.status === 0 ? url.stdout.trim() : null;
  if (!remote) return [['github.metadata', skip('no git origin remote')]];
  const match = remote.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  if (!match) return [['github.metadata', skip(`non-GitHub remote: ${remote}`)]];
  const view = spawnSync('gh', ['repo', 'view', match[1], '--json', 'homepageUrl,description,repositoryTopics'], { encoding: 'utf8' });
  if (view.status !== 0) return [['github.metadata', unknown('gh repo view failed — not authed or repo private')]];
  const meta = JSON.parse(view.stdout);
  const gaps = [];
  if (!meta.homepageUrl) gaps.push('homepage');
  if (!meta.description) gaps.push('description');
  if (!(meta.repositoryTopics ?? []).length) gaps.push('topics');
  return [['github.metadata', gaps.length
    ? fail(`missing: ${gaps.join(', ')}`, 'node tooling/scripts/github-repo-audit.mjs --project <id> --apply homepage,description,topics')
    : pass('homepage, description, topics set')]];
}

function checkLive(project) {
  const domain = (project?.deployment?.domains ?? [])[0];
  if (!domain) return [['live.url', skip('no cataloged domain — nothing to probe')]];
  const base = `https://${domain}`;
  const checks = [];
  const home = curlStatus(base);
  checks.push(['live.url', home === '200'
    ? pass(`${base} → 200`)
    : fail(`${base} → ${home ?? 'unreachable'}`, 'deploy first; then re-run with --live')]);
  if (home !== '200') return checks;

  const llms = curlStatus(`${base}/llms.txt`);
  const llmsBody = llms === '200' ? (curlBody(`${base}/llms.txt`, 64 * 1024) ?? '') : '';
  const llmsOk = llms === '200' && llmsBody.trimStart().startsWith('#') && !llmsBody.trimStart().startsWith('<');
  checks.push(['live.llms', llmsOk
    ? pass('/llms.txt 200, markdown')
    : fail(`/llms.txt → ${llms}${llms === '200' ? ' but HTML/non-markdown' : ''}`, 'agent-indexing-standard S-tier')]);

  const apiAi = curlStatus(`${base}/api/ai`);
  checks.push(['live.apiAi', apiAi === '200'
    ? pass('/api/ai 200')
    : fail(`/api/ai → ${apiAi ?? 'unreachable'}`, 'agent-indexing-standard contract')]);

  const sitemap = curlStatus(`${base}/sitemap.xml`);
  checks.push(['live.sitemap', sitemap === '200'
    ? pass('/sitemap.xml 200')
    : fail(`/sitemap.xml → ${sitemap ?? 'unreachable'}`, 'emit sitemap.xml; submit via search-indexing')]);

  const html = curlBody(base) ?? '';
  const hasStrip = /project-strip\.js/.test(html);
  const hasAi = /ai-chat-footer\.js/.test(html);
  checks.push(['live.footer', hasStrip && hasAi
    ? pass('footer extension live')
    : fail(`footer scripts missing live (strip: ${hasStrip}, ask-ai: ${hasAi})`, 'footer contract — see footer-compliance-latest.md')]);
  return checks;
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (!options.projectId && !options.repoName) {
    console.error(usage());
    process.exit(1);
  }

  const catalog = loadJson(CATALOG_PATH);
  const project = options.projectId
    ? (catalog?.projects ?? []).find((p) => p.id === options.projectId) ?? null
    : (catalog?.projects ?? []).find((p) => p.repositories?.localPath === options.repoName || p.id === options.repoName) ?? null;
  const projectId = options.projectId ?? project?.id ?? options.repoName;

  const repoName = options.repoName ?? project?.repositories?.localPath ?? projectId;
  const repoDir = resolve(FLEET_ROOT, repoName);
  const repoExists = existsSync(repoDir);

  const results = [];
  const section = (name, checks) => results.push({ section: name, checks });

  section('scaffold', repoExists
    ? checkScaffold(repoDir, repoName)
    : [['repo.exists', fail(`no checkout at ${rel(repoDir, FLEET_ROOT)}`, 'fleet-init or clone the repo into the Fleet workspace')]]);
  section('register', [
    ...checkCatalog(project, projectId),
    ...checkIdentity(catalog, projectId),
    ...checkDossier(projectId),
  ]);

  if (repoExists) {
    const sources = collectSources(repoDir);
    section('surface', checkSurfaces(repoDir, sources));
    section('trust', checkTrust(repoDir, sources));
    section('seo-geo', checkAgent(repoDir, sources));
    section('analytics', checkClarity(projectId, repoName, repoDir));
    section('links', checkGithub(repoDir));
  }
  if (options.live) section('live', checkLive(project));

  const flat = results.flatMap((s) => s.checks.map(([id, r]) => ({ id, section: s.section, ...r })));
  const counts = { pass: 0, fail: 0, skip: 0, unknown: 0 };
  for (const c of flat) counts[c.status] += 1;

  if (options.format === 'json') {
    console.log(JSON.stringify({ project: projectId, repo: repoName, live: options.live, counts, results: flat }, null, 2));
    return;
  }

  console.log(`# Readiness: ${projectId}\n`);
  console.log(`pass ${counts.pass} · fail ${counts.fail} · skip ${counts.skip} · unknown ${counts.unknown}\n`);
  for (const s of results) {
    console.log(`## ${s.section}`);
    for (const [id, r] of s.checks) {
      const icon = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP', unknown: '????' }[r.status];
      console.log(`- [${icon}] ${id} — ${r.evidence}`);
    }
    console.log();
  }
  const fails = flat.filter((c) => c.status === 'fail');
  if (fails.length) {
    console.log('## next actions');
    fails.forEach((c, i) => console.log(`${i + 1}. ${c.id}: ${c.fix}`));
  } else {
    console.log('## next actions\nAll observable gates pass. Remaining items are owner gates and launch execution — see docs/new-project-checklist.md.');
  }
}

main();
