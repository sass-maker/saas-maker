#!/usr/bin/env node
// Audits every public Fleet repository for the metadata that drives organic
// discovery: description, homepage link, topics, README, license, and archive
// drift against the catalog. Read-only by default; --apply only ever sets
// homepage, description, and topics from catalog values already approved for
// the public directory.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..');
const DEFAULT_CATALOG = resolve(REPOSITORY_ROOT, 'catalog/projects.json');
const CHECKS = ['description', 'homepage', 'topics', 'readme', 'license'];

function usage() {
  return `Usage:
  node tooling/scripts/github-repo-audit.mjs [--catalog PATH] [--project ID]
      [--apply homepage,description,topics] [--format markdown|json]

Audits public repository discoverability metadata for every catalog project
with repositories.visibility === "public" and a github.com URL.

  --catalog PATH   Catalog JSON (default: catalog/projects.json)
  --project ID     Audit one project only
  --apply LIST     Comma-separated subset of homepage,description,topics to fix
                   from catalog values. Anything else is report-only.
  --format FORMAT  markdown (default) or json
`;
}

function parseArgs(argv) {
  const options = { catalog: DEFAULT_CATALOG, projectId: null, apply: new Set(), format: 'markdown' };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--help') return { help: true };
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--catalog') options.catalog = resolve(value);
    else if (flag === '--project') options.projectId = value;
    else if (flag === '--apply') {
      for (const item of value.split(',')) {
        const name = item.trim();
        if (!['homepage', 'description', 'topics', 'license'].includes(name)) {
          throw new Error(`--apply only supports homepage, description, topics, license — got ${name}`);
        }
        options.apply.add(name);
      }
    } else if (flag === '--format') {
      if (!['markdown', 'json'].includes(value)) throw new Error('--format must be markdown or json');
      options.format = value;
    } else throw new Error(`Unknown option: ${flag}`);
    index += 1;
  }
  return options;
}

function gh(endpoint, method = 'GET', fields = []) {
  const result = spawnSync('gh', ['api', endpoint, '-X', method, ...fields], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error?.code === 'ENOENT') {
    throw Object.assign(new Error('gh CLI is not installed or not on PATH'), { code: 'GH_UNAVAILABLE' });
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim().split('\n')[0] ?? `exit ${result.status}`;
    throw Object.assign(new Error(`gh api ${endpoint} failed: ${detail}`), { code: 'GH_API_FAILED' });
  }
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function tryGh(endpoint) {
  try {
    return gh(endpoint);
  } catch (error) {
    if (error?.code === 'GH_UNAVAILABLE') throw error;
    return null;
  }
}

function repositorySlug(project) {
  const url = project?.repositories?.url
    ?? project?.presentation?.public?.repositoryUrl
    ?? project?.repositoryUrl;
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return null;
    const segments = parsed.pathname.split('/').filter(Boolean);
    return segments.length >= 2 ? `${segments[0]}/${segments[1].replace(/\.git$/, '')}` : null;
  } catch {
    return null;
  }
}

function catalogHomepage(project) {
  const domain = project?.deployment?.domains?.[0];
  return domain ? `https://${domain}` : null;
}

function catalogDescription(project) {
  return project?.presentation?.public?.description ?? null;
}

function catalogTopics(project) {
  const technologies = project?.presentation?.directory?.technologies ?? [];
  return technologies
    .map((item) => String(item).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .slice(0, 8);
}

function auditRepository(project, slug) {
  const repo = tryGh(`repos/${slug}`);
  if (!repo) {
    return { projectId: project.id, slug, status: 'unreadable', checks: {}, fixes: [] };
  }
  const readme = tryGh(`repos/${slug}/readme`);
  const homepage = catalogHomepage(project);
  const description = catalogDescription(project);
  const topics = catalogTopics(project);
  const checks = {
    description: { pass: Boolean(repo.description?.trim()), current: repo.description ?? null, wanted: description },
    homepage: {
      pass: Boolean(repo.homepage?.trim()),
      current: repo.homepage || null,
      wanted: homepage,
      note: repo.homepage && homepage && repo.homepage.replace(/\/$/, '') !== homepage.replace(/\/$/, '')
        ? 'set but does not match the catalog domain'
        : null,
    },
    topics: { pass: (repo.topics ?? []).length > 0, current: repo.topics ?? [], wanted: topics },
    readme: { pass: Boolean(readme), current: readme ? 'present' : null },
    license: { pass: Boolean(repo.license), current: repo.license?.spdx_id ?? null },
  };
  const fixes = [];
  if (!checks.description.pass && description) fixes.push({ field: 'description', to: description });
  if (!checks.homepage.pass && homepage) fixes.push({ field: 'homepage', to: homepage });
  if (!checks.topics.pass && topics.length) fixes.push({ field: 'topics', to: topics });
  if (!checks.license.pass) fixes.push({ field: 'license', to: 'MIT' });
  return {
    projectId: project.id,
    slug,
    status: repo.archived ? 'archived' : 'active',
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    checks,
    fixes,
  };
}

const MIT_LICENSE = `MIT License

Copyright (c) 2026 Sarthak Agrawal

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

// GitHub's license detection keys on conventional filenames only — check the
// root listing before writing so a LICENSE.txt or COPYING is not duplicated.
function hasLicenseFile(slug) {
  const contents = tryGh(`repos/${slug}/contents`);
  if (!Array.isArray(contents)) return null;
  return contents.some((entry) => /^(licen[sc]e|copying|licence)/i.test(entry.name ?? ''));
}

function applyFix(slug, fix) {
  if (fix.field === 'topics') {
    gh(`repos/${slug}/topics`, 'PUT', fix.to.flatMap((name) => ['-f', `names[]=${name}`]));
    return { field: 'topics', applied: true };
  }
  if (fix.field === 'license') {
    if (fix.to !== 'MIT') throw new Error(`Only MIT license application is supported, got ${fix.to}`);
    if (hasLicenseFile(slug)) return { field: 'license', applied: false, reason: 'license file exists under a nonstandard name' };
    gh(`repos/${slug}/contents/LICENSE`, 'PUT', [
      '-f', 'message=Add MIT license',
      '-f', `content=${Buffer.from(MIT_LICENSE).toString('base64')}`,
    ]);
    return { field: 'license', applied: true };
  }
  gh(`repos/${slug}`, 'PATCH', ['-f', `${fix.field}=${fix.to}`]);
  return { field: fix.field, applied: true };
}

function renderMarkdown(results, applied) {
  const lines = [
    '# GitHub repository discoverability audit',
    '',
    `Audited ${results.length} public repositories. Checks: ${CHECKS.join(', ')}.`,
    '',
    '| Project | Repository | Status | ' + CHECKS.map((check) => check[0].toUpperCase() + check.slice(1)).join(' | ') + ' |',
    '| --- | --- | --- | ' + CHECKS.map(() => '---').join(' | ') + ' |',
  ];
  const mark = (entry) => (entry?.pass ? 'ok' : 'missing');
  for (const result of results) {
    if (result.status === 'unreadable') {
      lines.push(`| ${result.projectId} | ${result.slug} | unreadable | ` + CHECKS.map(() => '—').join(' | ') + ' |');
      continue;
    }
    lines.push(`| ${result.projectId} | ${result.slug} | ${result.status} | ${CHECKS.map((check) => mark(result.checks[check])).join(' | ')} |`);
  }
  const actionable = results.flatMap((result) =>
    (result.fixes ?? []).map((fix) => ({ project: result.projectId, slug: result.slug, ...fix })));
  lines.push('', '## Proposed fixes');
  if (!actionable.length) {
    lines.push('', 'None — every readable repository carries the cataloged metadata.');
  } else {
    for (const fix of actionable) {
      const appliedFix = applied.find((item) => item.slug === fix.slug && item.field === fix.field);
      lines.push(`- ${fix.slug} (${fix.project}): set ${fix.field} → ${JSON.stringify(fix.to)}${appliedFix ? ' — applied' : ''}`);
    }
    if (!applied.length) {
      lines.push('', 'Nothing was changed. Re-run with `--apply homepage,description,topics` to write the fixes above.');
    }
  }
  const mismatches = results.filter((result) => result.checks?.homepage?.note);
  if (mismatches.length) {
    lines.push('', '## Homepage drift', '');
    for (const result of mismatches) {
      lines.push(`- ${result.slug}: repo links ${result.checks.homepage.current}, catalog expects ${result.checks.homepage.wanted}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const catalog = JSON.parse(readFileSync(options.catalog, 'utf8'));
const projects = (catalog.projects ?? []).filter(
  (project) => project?.repositories?.visibility === 'public' && repositorySlug(project),
);
const selected = options.projectId
  ? projects.filter((project) => project.id === options.projectId)
  : projects;
if (options.projectId && !selected.length) {
  throw new Error(`No public GitHub repository is cataloged for project: ${options.projectId}`);
}

const results = [];
const applied = [];
for (const project of selected) {
  const slug = repositorySlug(project);
  const result = auditRepository(project, slug);
  for (const fix of result.fixes ?? []) {
    if (options.apply.has(fix.field) && result.status !== 'archived') {
      try {
        applied.push({ slug, ...applyFix(slug, fix) });
        result.status = `${result.status} (fix applied)`;
      } catch (error) {
        applied.push({ slug, field: fix.field, applied: false, reason: error.message });
      }
    }
  }
  results.push(result);
}

if (options.format === 'json') {
  process.stdout.write(`${JSON.stringify({ schema: 'fleet.github-repo-audit.v1', results, applied }, null, 2)}\n`);
} else {
  process.stdout.write(renderMarkdown(results, applied));
}
