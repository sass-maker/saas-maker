#!/usr/bin/env node
// Documentation validation for the SaaS Maker knowledge system.
//
// Checks:
//   1. Required root + docs/ files exist.
//   2. No markdown file is empty or a near-empty placeholder.
//   3. Relative markdown links resolve to an existing file (or a directory
//      containing an index.md / index.mdx / README.md).
//   4. The Blume config points content.root at an existing directory.
//
// Does NOT check external http(s) links (use a linkchecker for those).
//
// Run: node scripts/check-docs.mjs   (or `pnpm check:docs`)
import { access, readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs');

const requiredFiles = [
  'AGENTS.md',
  'STATUS.md',
  'PROJECT_STATUS.md',
  'README.md',
  'WORKFLOW.md',
  'AUDIT.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/index.mdx',
  'docs/current/README.md',
  'docs/product/README.md',
  'docs/product/fleet-registry.md',
  'docs/architecture/README.md',
  'docs/architecture/symphony.md',
  'docs/architecture/droid.md',
  'docs/architecture/decisions/README.md',
  'docs/development/README.md',
  'docs/development/testing-backlog.md',
  'docs/operations/README.md',
  'docs/operations/jobs/README.md',
  'docs/operations/runbooks/README.md',
  'docs/knowledge/README.md',
  'docs/knowledge/learnings/README.md',
  'docs/knowledge/failed-approaches/README.md',
  'scripts/check-docs.mjs',
];

const minBytes = 50; // a real doc has at least a heading + a line
// Pointer files that are intentionally tiny (they just @-include another file).
const emptyAllowed = new Set(['CLAUDE.md']);
const linkRe = /(?:^|[^!])\[([^\]]*)\]\(([^)]+)\)/g;
const imageRe = /!\[[^\]]*\]\(([^)]+)\)/g;

let failed = false;
const errors = [];
const warn = (msg) => console.warn(`WARN: ${msg}`);
const err = (msg) => {
  errors.push(msg);
  failed = true;
};

// --- 1. Required files ---------------------------------------------------
for (const rel of requiredFiles) {
  try {
    await access(path.join(repoRoot, rel));
  } catch {
    err(`Missing required file: ${rel}`);
  }
}

// --- 2. Walk docs/ + root markdown for empties and broken links ----------
/** @returns {Promise<string[]>} relative-to-repo markdown paths */
async function walkMarkdown(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMarkdown(full, out);
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      out.push(path.relative(repoRoot, full));
    }
  }
  return out;
}

const rootMarkdown = ['AGENTS.md', 'STATUS.md', 'PROJECT_STATUS.md', 'README.md', 'WORKFLOW.md', 'AUDIT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CLAUDE.md'];
const docsMarkdown = await walkMarkdown(docsRoot);
const allMarkdown = [...new Set([...rootMarkdown, ...docsMarkdown])];

// Skip generated/presentation dirs that are not source of truth.
const skipPaths = new Set([
  'apps/docs/src/content/docs', // legacy Astro mirror — has its own copy
  'apps/docs-blume/dist',
  'apps/docs/dist',
]);

// Deliberate thin pointer files that are allowed to be tiny.
const pointerAllowlist = new Set(['CLAUDE.md']);

// Tolerated markdown extensions when a link target has no extension.
const mdExtensions = ['.md', '.mdx', '.markdown'];
const dirIndexFiles = ['index.mdx', 'index.md', 'README.md', 'readme.md'];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

// Resolve a link target from a given source file.
// Returns { ok: boolean, resolved: string }.
async function resolveTarget(fromRel, target) {
  const fromFull = path.join(repoRoot, fromRel);
  const fileDir = path.dirname(fromFull);
  const [rawPath, anchor] = target.split('#');
  const [pathOnly] = rawPath.split('?');
  if (!pathOnly) return { ok: !!anchor, resolved: '' };
  let base = fileDir;
  let relPath = pathOnly;
  // Leading-slash links inside docs/ are Blume site routes resolved against
  // the docs/ content root (e.g. /getting-started/quickstart -> docs/getting-started/quickstart.md).
  // Leading-slash links from root-level markdown are repo-root relative.
  if (pathOnly.startsWith('/')) {
    if (fromRel.startsWith('docs/') || fromRel === 'docs/README.md') {
      base = docsRoot;
      relPath = pathOnly.slice(1);
    } else {
      base = repoRoot;
      relPath = pathOnly.slice(1);
    }
  }
  const resolved = path.resolve(base, relPath);
  // Direct file hit.
  try {
    const s = await stat(resolved);
    if (s.isFile()) return { ok: true, resolved };
    // An existing directory is a valid link target — Blume/Starlight generate
    // index pages for content directories, and human-readable directory links
    // (e.g. to `scripts/`) are valid navigation even without an index file.
    if (s.isDirectory()) return { ok: true, resolved };
  } catch {
    // fall through to extension tolerance
  }
  // Extension tolerance for extension-less targets.
  if (!path.extname(resolved)) {
    for (const ext of mdExtensions) {
      if (await exists(resolved + ext)) return { ok: true, resolved: resolved + ext };
    }
    for (const idx of dirIndexFiles) {
      if (await exists(path.join(resolved, idx))) return { ok: true, resolved: path.join(resolved, idx) };
    }
  }
  // Blume strips a leading 4-digit year prefix (`2026-`) from date-prefixed
  // filenames when it builds the page slug, so a link such as
  // `06-04-magic-form-block-design.md` resolves to the on-disk file
  // `2026-06-04-magic-form-block-design.md`. Accept that mapping so this check
  // stays consistent with `blume validate`.
  const targetName = path.basename(resolved);
  if (/^\d{2}-\d{2}-/.test(targetName)) {
    const dir = path.dirname(resolved);
    for (const year of ['2026', '2025', '2024', '2027']) {
      const yearMatched = path.join(dir, `${year}-${targetName}`);
      if (await exists(yearMatched)) return { ok: true, resolved: yearMatched };
    }
  }
  return { ok: false, resolved };
}

for (const rel of allMarkdown) {
  if (skipPaths.has(path.dirname(rel))) continue;
  const full = path.join(repoRoot, rel);
  let content;
  try {
    content = await readFile(full, 'utf8');
  } catch {
    err(`Unreadable markdown: ${rel}`);
    continue;
  }
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes < minBytes && !pointerAllowlist.has(rel)) {
    err(`Empty or placeholder doc (${bytes} bytes): ${rel}`);
    continue;
  }

  const fileDir = path.dirname(full);
  // Check image links first (so they are not double-reported as text links).
  const imageTargets = new Set();
  for (const m of content.matchAll(imageRe)) {
    imageTargets.add(m[1]);
  }
  for (const m of content.matchAll(linkRe)) {
    const target = m[2].trim();
    if (imageTargets.has(target)) continue; // images handled below
    if (target.startsWith('http://') || target.startsWith('https://')) continue;
    if (target.startsWith('mailto:')) continue;
    if (target.startsWith('#')) continue;
    const { ok, resolved } = await resolveTarget(rel, target);
    if (!ok) {
      err(`Broken link in ${rel}: "${target}" -> ${path.relative(repoRoot, resolved) || '.'}`);
    }
  }
  // Check image links resolve.
  for (const target of imageTargets) {
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('/')) continue;
    const resolved = path.resolve(fileDir, target);
    try {
      await stat(resolved);
    } catch {
      err(`Broken image in ${rel}: "${target}" -> ${path.relative(repoRoot, resolved)}`);
    }
  }
}

// --- 3. Blume config sanity ---------------------------------------------
const blumeConfig = path.join(repoRoot, 'apps/docs-blume/blume.config.ts');
try {
  const cfg = await readFile(blumeConfig, 'utf8');
  const rootMatch = cfg.match(/content:\s*\{\s*root:\s*['"]([^'"]+)['"]/);
  if (!rootMatch) {
    err('Blume config: could not find content.root');
  } else {
    const root = path.resolve(path.dirname(blumeConfig), rootMatch[1]);
    try {
      const s = await stat(root);
      if (!s.isDirectory()) err(`Blume content.root is not a directory: ${root}`);
    } catch {
      err(`Blume content.root does not exist: ${root}`);
    }
  }
} catch {
  warn('Blume config not found (apps/docs-blume/blume.config.ts); skipping Blume sanity check.');
}

// --- Report --------------------------------------------------------------
if (errors.length) {
  console.error(`\nDocumentation validation FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation validation OK (${allMarkdown.length} markdown files checked).`);
}
