#!/usr/bin/env node
// Source evidence, not a rendered-area or design-quality score. No dependencies.
import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WEB = /\.(?:tsx|jsx|astro|html|vue|svelte)$/;
const SERVER = /\.[cm]?[jt]s$/;
const SKIP = /(?:^|\/)(?:node_modules|vendor|dist|build|\.build|\.next|\.astro|archives?|docs?|tests?|__tests__|fixtures?|examples?|tooling|scripts|storybook|preserved)(?:\/|$)|\.(?:test|spec|stories)\./i;
const ROOT_NAMES = 'Button|Input|Textarea|Checkbox|RadioGroup|Switch|Select|Combobox|Slider|Calendar|DatePicker|Dialog|AlertDialog|Sheet|Drawer|Popover|Tooltip|DropdownMenu|ContextMenu|Tabs|Accordion|Card|Table|DataTable|Badge|Avatar|Skeleton|EmptyState|ErrorState|Alert|Progress|Separator|NavigationMenu|Sidebar|StatCard|MetricCard'.split('|');
const ROOTS = new RegExp(`^(?:${ROOT_NAMES.join('|')})$`);
const BLOCKS = new Set(['AppShell', 'PageHeader', 'StudioFooter', 'GalleryPage', 'WorkbenchPage', 'ConsolePage', 'SMAppShell', 'SMPage', 'SMPageHeader', 'SMFooter', 'SMGallery']);
const LOCAL_CONTROL = new RegExp(`^(?:${ROOT_NAMES.join('|')}|Modal|Dropdown|Menu)$`);
const CHILD_PART = /^(?:Card|Dialog|AlertDialog|Sheet|Drawer|Popover|Select|DropdownMenu|ContextMenu|Tabs|Accordion|Table|NavigationMenu)(?:Header|Footer|Title|Description|Content|Trigger|Close|Item|List|Value|Group|Label|Separator|Row|Cell|Head|Body|Caption)$/;
const HTML_CONTROLS = new Set(['button', 'input', 'textarea', 'select', 'table', 'dialog', 'details', 'progress', 'meter']);
const SWIFT_CONTROLS = new Set(['Button', 'TextField', 'SecureField', 'TextEditor', 'Toggle', 'Slider', 'Picker', 'DatePicker', 'ProgressView', 'Table', 'Menu']);
const SWIFT_SHARED = new Set(['SMCard', 'SMSectionHeader', 'SMStatusPill', 'SMSkeletonRow', 'SMSkeletonCard', 'SMEmptyState', 'SMErrorState', 'SMLoadable', 'SMSparkline', 'SMAreaChart', 'SMStatCard', 'SMUptimeStrip', 'SMAppShell', 'SMPageHeader', 'SMPage', 'SMFooter', 'SMGallery']);

// Preserve newlines and offsets; ignore comments and ordinary JS/Swift strings.
// HTML/JSX start tags are consumed as a unit, so quoted attributes are retained.
export function sourceTags(source, { html = false } = {}) {
  const tags = []; let i = 0, depth = 0, lastCode = ''; const expressions = [];
  while (i < source.length) {
    if (source.startsWith('<!--', i)) { const end = source.indexOf('-->', i + 4); i = end < 0 ? source.length : end + 3; continue; }
    if (!html && depth === 0 && source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (!html && depth === 0 && source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue; }
    if (!html && depth > 0 && source[i] === '{') { expressions.push({ depth, braces: 1 }); depth = 0; lastCode = '{'; i++; continue; }
    if (!html && expressions.length && depth === 0 && source[i] === '{') { expressions.at(-1).braces++; i++; continue; }
    if (!html && expressions.length && depth === 0 && source[i] === '}') { const frame = expressions.at(-1); if (--frame.braces === 0) { depth = frame.depth; expressions.pop(); } i++; continue; }
    if (!html && depth === 0 && /["'`]/.test(source[i])) { const quote = source[i++]; while (i < source.length) { if (source[i] === '\\') { i += 2; continue; } if (source[i++] === quote) break; } lastCode = 'value'; continue; }
    if (source.startsWith('</', i)) { const end = source.indexOf('>', i); i = end < 0 ? source.length : end + 1; depth = Math.max(0, depth - 1); if (depth === 0) lastCode = 'value'; continue; }
    if (source.startsWith('<>', i)) { depth++; i += 2; continue; }
    if (source[i] !== '<' || !/[A-Za-z]/.test(source[i + 1] ?? '')) {
      if (!html && depth === 0 && /[A-Za-z_$]/.test(source[i])) { const start = i++; while (/[\w$]/.test(source[i] ?? '')) i++; lastCode = source.slice(start, i); continue; }
      if (!html && depth === 0 && !/\s/.test(source[i])) lastCode = source[i];
      i++; continue;
    }
    if (!html && depth === 0) {
      if (/[\w$.)\]]$/.test(lastCode) && !/^(?:return|yield|default|await|else|case|throw|void)$/.test(lastCode)) { i++; continue; }
      if (/^<[A-Za-z_$]\w*\s*(?:extends\b|=)/.test(source.slice(i))) { i++; continue; }
      if (!/^<[\w.:-]+(?:\s|\/?>)/.test(source.slice(i))) { i++; continue; }
    }
    const start = i; let quote = null, braces = 0; i++;
    while (i < source.length) { const c = source[i++]; if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '{') braces++; else if (c === '}') braces = Math.max(0, braces - 1); else if (c === '>' && braces === 0) break; }
    const text = source.slice(start, i); const name = text.match(/^<([\w.:-]+)/)?.[1];
    if (name) tags.push({ name, line: source.slice(0, start).split('\n').length });
    if (!html && !text.endsWith('/>')) depth++; else if (!html && depth === 0) lastCode = 'value';
  }
  return tags;
}

function codeOnly(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, text => text.replace(/[^\n]/g, ' '));
}

// Only complete, untagged HTML document literals are supported in server code.
// Blank code/interpolations at their original offsets; never interpret JS types
// or example strings as markup. Fragments and constructed documents stay a gap.
function serverDocuments(source) {
  const code = source.split(''), markup = source.replace(/[^\n]/g, ' ').split(''); let documents = 0;
  const blank = (start, end) => { for (let k = start; k < end; k++) if (code[k] !== '\n') code[k] = ' '; };
  function quoted(start) {
    const quote = source[start]; let i = start + 1;
    while (i < source.length) { if (source[i] === '\\') i += 2; else if (source[i++] === quote) break; }
    blank(start, i); return i;
  }
  function walk(start, interpolation = false) {
    let i = start, depth = 1;
    while (i < source.length) {
      if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); const next = end < 0 ? source.length : end; blank(i, next); i = next; }
      else if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); const next = end < 0 ? source.length : end + 2; blank(i, next); i = next; }
      else if (source[i] === '"' || source[i] === "'") i = quoted(i);
      else if (source[i] === '`') i = template(i);
      else if (interpolation && source[i] === '{') { depth++; i++; }
      else if (interpolation && source[i] === '}') { if (--depth === 0) return i + 1; i++; }
      else i++;
    }
    return i;
  }
  function template(start) {
    const before = source.slice(0, start).trimEnd().at(-1) ?? '';
    const document = !/[\w$.)\]]/.test(before) && /^\s*(?:<!doctype\s+html\b|<html\b)/i.test(source.slice(start + 1));
    let i = start + 1; const ranges = []; let chunk = i;
    while (i < source.length) {
      if (source[i] === '\\') { i += 2; continue; }
      if (source.startsWith('${', i)) { ranges.push([chunk, i]); i = walk(i + 2, true); chunk = i; continue; }
      if (source[i] === '`') { ranges.push([chunk, i]); break; }
      i++;
    }
    // Require a closing literal and document end, not a partial example.
    if (document && source[i] === '`' && ranges.some(([a, b]) => /<\/html\s*>/i.test(source.slice(a, b)))) {
      documents++; for (const [a, b] of ranges) for (let k = a; k < b; k++) markup[k] = source[k];
    }
    const end = Math.min(i + 1, source.length); blank(start, end); return end;
  }
  walk(0);
  return { code: code.join(''), markup: markup.join(''), documents };
}

export function inspectSource(source, filename) {
  const shared = [], bespoke = [], blocks = [];
  if (filename.endsWith('.swift')) {
    const code = codeOnly(source), imported = /\bimport\s+SaaSMakerUI\b/.test(code);
    for (const match of code.matchAll(/\b([A-Z]\w*)\s*(?:\(|\{)/g)) {
      const name = match[1], line = code.slice(0, match.index).split('\n').length;
      if (imported && BLOCKS.has(name)) blocks.push({ name, line });
      else if (imported && SWIFT_SHARED.has(name)) shared.push({ name, line });
      else if (SWIFT_CONTROLS.has(name)) bespoke.push({ name, line });
    }
    // A shared style actually applied to a native Button earns control credit.
    // The count is bounded by native buttons in this file; association is a proxy.
    const styled = imported ? [...code.matchAll(/\.buttonStyle\s*\(\s*SMButtonStyle\s*\(/g)].length : 0;
    for (let n = 0; n < styled; n++) { const index = bespoke.findIndex(x => x.name === 'Button'); if (index < 0) break; shared.push({ ...bespoke.splice(index, 1)[0], name: 'Button + SMButtonStyle' }); }
    return { shared, bespoke, blocks, tokens: imported && /\bSM(?:Palette|Theme|Typography|Font|Color|Motion)\b/.test(code), supported: true };
  }
  const imports = new Map(), namespaces = new Set();
  const clean = source.replace(/\/\*[\s\S]*?\*\/|<!--[^]*?-->/g, '');
  for (const match of clean.matchAll(/(?:^|\n)\s*import\s+((?:(?!\bimport\b|\bfrom\s*['"])[^;])+?)\s+from\s*['"]([^'"]+)['"]/g)) {
    if (!/^@saas-maker\/(?:ui|templates)(?:\/|$)/.test(match[2])) continue;
    const clause = match[1].replace(/\/\/[^\n]*/g, ' '); const namespace = clause.match(/\*\s+as\s+(\w+)/)?.[1]; if (namespace) namespaces.add(namespace);
    const named = clause.match(/\{([^}]+)\}/)?.[1] ?? '';
    for (const part of named.split(',')) { const [name, alias = name] = part.trim().split(/\s+as\s+/); if (name && !name.startsWith('type ')) imports.set(alias, name); }
    const defaultName = clause.match(/^\s*(\w+)\s*(?:,|$)/)?.[1]; if (defaultName) imports.set(defaultName, defaultName);
  }
  const server = SERVER.test(filename) ? serverDocuments(source) : null;
  const html = !!server || /\.(?:html|astro|vue|svelte)$/.test(filename);
  const blank = text => text.replace(/[^\n]/g, ' ');
  const markup = server ? server.markup.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank) : html ? source.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, blank).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, blank) : source;
  for (const tag of sourceTags(markup, { html })) {
    const [namespace, member] = tag.name.split('.'); const original = imports.get(tag.name) ?? (namespaces.has(namespace) ? member : null);
    if (original && BLOCKS.has(original)) blocks.push(tag);
    else if (original && ROOTS.test(original)) shared.push(tag);
    else if (HTML_CONTROLS.has(tag.name) || (!original && !CHILD_PART.test(tag.name) && !/^Sidebar(?:Menu.*|Group.*|Header|Footer|Content|Input)$/.test(tag.name) && LOCAL_CONTROL.test(tag.name))) bespoke.push(tag);
    else if (tag.name === 'studio-footer' && /(?:@saas-maker\/ui|sassmaker\.com\/.*footer)/.test(source)) blocks.push(tag);
  }
  if (server && !blocks.some(block => block.name === 'studio-footer')) for (const [alias, original] of imports) {
    if (original !== 'renderStudioFooterHtml') continue;
    for (const match of server.code.matchAll(new RegExp(`\\b${alias}\\s*\\(`, 'g'))) blocks.push({ name: original, line: source.slice(0, match.index).split('\n').length });
  }
  return { shared, bespoke, blocks, documents: server?.documents ?? 0, tokens: /@saas-maker\/(?:ui\/(?:theme|styles|source-[\w-]+)\.css|tokens)/.test(clean), supported: true };
}

function git(root, args) { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000, maxBuffer: 8 * 1024 * 1024 }); }
export function scanRepository(root, { prefix = '', excludePrefixes = [] } = {}) {
  const top = git(root, ['rev-parse', '--show-toplevel']).trim();
  if (realpathSync(top) !== realpathSync(root)) throw Object.assign(Error('Root must be a repository root'), { code: 'INVALID_SOURCE_ROOT' });
  prefix = prefix.replace(/^\.\//, '').replace(/\/+$/, ''); excludePrefixes = excludePrefixes.map(p => p.replace(/^\.\//, '').replace(/\/+$/, ''));
  let sourceRef = 'origin/main';
  try { git(root, ['rev-parse', '--verify', sourceRef]); } catch { sourceRef = 'HEAD'; }
  const revision = git(root, ['rev-parse', sourceRef]).trim();
  const tracked = git(root, ['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean);
  if (prefix && !tracked.some(f => f.startsWith(`${prefix}/`))) throw Object.assign(Error('Prefix not found'), { code: 'INVALID_SOURCE_PREFIX' });
  const files = tracked.filter(f => !/[\n\r]/.test(f) && (!prefix || f.startsWith(`${prefix}/`)) && !excludePrefixes.some(p => f === p || f.startsWith(`${p}/`)) && !SKIP.test(f) && (WEB.test(f) || SERVER.test(f) || f.endsWith('.swift')));
  const dirty = false;
  const surfaces = new Map(); let omitted = 0, documents = 0;
  const contents = new Map();
  const sizes = gitBatchSizes(root, revision, files);
  const readable = files.filter(file => { const size = sizes.get(file); if (size == null || size > 1024 * 1024) { omitted++; return false; } return true; });
  for (let start = 0; start < readable.length; start += 24) {
    const chunk = readable.slice(start, start + 24);
    const result = execFileSync('git', ['-C', root, 'cat-file', '--batch'], { input: chunk.map(f => `${revision}:${f}`).join('\n') + '\n', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000, maxBuffer: 32 * 1024 * 1024 });
    let offset = 0;
    for (const file of chunk) { const end = result.indexOf(10, offset); const header = result.subarray(offset, end).toString(); offset = end + 1; const match = header.match(/^[a-f0-9]+ blob (\d+)$/); if (!match) { omitted++; continue; } const size = Number(match[1]); if (size <= 1024 * 1024) contents.set(file, result.subarray(offset, offset + size).toString('utf8')); else omitted++; offset += size + 1; }
  }
  for (const [file, text] of contents) {
    if (Buffer.byteLength(text) > 1024 * 1024) { omitted++; continue; }
    const found = inspectSource(text, file); documents += found.documents ?? 0; if (!found.documents && !found.shared.length && !found.bespoke.length && !found.blocks.length && !found.tokens) continue;
    const kind = file.endsWith('.swift') ? 'native' : /(?:^|\/)(?:landing(?:-page)?(?:-astro)?|website|showcase|site)(?:\/|$)/.test(file) ? 'landing' : 'web';
    const surface = surfaces.get(kind) ?? { kind, shared: 0, bespoke: 0, files: [], tokenFiles: 0, sharedBlocks: 0 };
    surface.sharedBlocks += found.blocks.length;
    surface.shared += found.shared.length; surface.bespoke += found.bespoke.length; if (found.tokens) surface.tokenFiles++;
    surface.files.push({ path: file, sha256: createHash('sha256').update(text).digest('hex'), shared: found.shared, bespoke: found.bespoke, blocks: found.blocks, tokens: found.tokens, documents: found.documents ?? 0 }); surfaces.set(kind, surface);
  }
  const rows = [...surfaces.values()].map(s => ({ ...s, eligible: s.shared + s.bespoke, percent: s.shared + s.bespoke ? Math.round(1000 * s.shared / (s.shared + s.bespoke)) / 10 : null }));
  const shared = rows.reduce((n, r) => n + r.shared, 0), eligible = rows.reduce((n, r) => n + r.eligible, 0);
  return { revision, sourceRef, dirty, scannedFiles: files.length, omittedFiles: omitted, shared, eligible, percent: eligible ? Math.round(1000 * shared / eligible) / 10 : null, surfaces: rows, status: eligible ? 'source-estimate' : documents ? 'no-eligible-controls' : 'not-measured', gap: eligible ? 'Committed source call sites only. Indirect wrappers, constructed HTML fragments, unrecognised custom controls and runtime frequency/area are not measured; native style association is file-level. Tokens, footers and shared shells are reported separately without control credit.' : documents ? 'Complete inline HTML documents were inspected; no eligible standard controls were identified. Links and informational content are outside this denominator, so no percentage is assigned. Shared footer blocks are reported separately. Constructed fragments and runtime visibility remain unverified.' : 'No supported reusable control call sites identified. CLI-only, template-only, dynamic-rendered and missing UI sources require scoped review; this is not zero adoption.' };
}

export function collectCoverage(manifest) {
  if (!manifest || Object.keys(manifest).some(k => !['schemaVersion', 'projects'].includes(k)) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.projects)) throw Error('Invalid UI coverage manifest');
  const seen = new Set();
  return { schemaVersion: 'ui-library-source-coverage.v1', observedAt: new Date().toISOString(), method: 'shared-control-call-sites.v2', records: Object.fromEntries(manifest.projects.map(p => {
    if (!p || Object.keys(p).some(k => !['id', 'root', 'prefix', 'excludePrefixes'].includes(k)) || !/^[a-z0-9-]+$/.test(p.id) || seen.has(p.id) || !isAbsolute(p.root) || (p.prefix !== undefined && (typeof p.prefix !== 'string' || isAbsolute(p.prefix) || p.prefix.split('/').includes('..'))) || (p.excludePrefixes !== undefined && (!Array.isArray(p.excludePrefixes) || p.excludePrefixes.some(x => typeof x !== 'string' || isAbsolute(x) || x.split('/').includes('..'))))) throw Error('Invalid UI coverage project');
    seen.add(p.id); let record; try { record = scanRepository(p.root, p); } catch (error) { const missing = error.code === 'ENOENT' || Number.isInteger(error.status); record = { status: missing ? 'unavailable' : 'scan-failed', revision: null, dirty: null, shared: 0, eligible: 0, percent: null, surfaces: [], gap: missing ? 'Source checkout or Git revision unavailable; no percentage inferred.' : `Source scan failed (${String(error.code).replace(/[^A-Z0-9_]/g, '').slice(0, 60)}); no percentage inferred.` }; }
    return [p.id, record];
  })) };
}
function gitBatchSizes(root, revision, files) {
  if (!files.length) return new Map();
  const result = execFileSync('git', ['-C', root, 'cat-file', '--batch-check'], { input: files.map(f => `${revision}:${f}`).join('\n') + '\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20_000, maxBuffer: 8 * 1024 * 1024 });
  return new Map(result.trimEnd().split('\n').map((line, i) => [files[i], /^[a-f0-9]+ blob \d+$/.test(line) ? Number(line.split(' ')[2]) : null]));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw Error('Usage: node ui-library-coverage.mjs <private-manifest.json> > <private-output.json>');
  console.log(JSON.stringify(collectCoverage(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
}
