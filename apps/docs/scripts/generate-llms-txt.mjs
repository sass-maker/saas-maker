import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, '../src/content/docs');
const outputPath = join(__dirname, '../public/llms.txt');
// /api/ai advertises llms-full.txt; docs' llms.txt is already the full
// concatenation, so both surfaces share the same generated content.
const fullOutputPath = join(__dirname, '../public/llms-full.txt');

// Section ordering — directories are processed in this order.
// Files within each directory are sorted alphabetically.
// Any new directory or file is automatically included.
const SECTION_ORDER = ['getting-started', 'api', 'services', 'sdk', 'widgets'];

const HEADER =
  '# SaaS Maker API Documentation\n\n> Drop-in backend services for SaaS apps. Base URL: https://api.sassmaker.com\n\n';

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n?/, '').trimStart();
}

function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

// Collect all markdown files grouped by directory
const allFiles = collectMarkdownFiles(docsRoot);
const byDir = new Map();

for (const file of allFiles) {
  const rel = relative(docsRoot, file);
  const dir = dirname(rel);
  if (!byDir.has(dir)) byDir.set(dir, []);
  byDir.get(dir).push(rel);
}

// Order: known sections first, then any new directories alphabetically
const knownDirs = SECTION_ORDER.filter((d) => byDir.has(d));
const unknownDirs = [...byDir.keys()].filter((d) => !SECTION_ORDER.includes(d)).sort();
const orderedDirs = [...knownDirs, ...unknownDirs];

const orderedFiles = orderedDirs.flatMap((dir) => byDir.get(dir));

const sections = orderedFiles.map((relativePath) => {
  const fullPath = join(docsRoot, relativePath);
  const raw = readFileSync(fullPath, 'utf-8');
  return stripFrontmatter(raw);
});

const output = HEADER + sections.join('\n---\n\n');

writeFileSync(outputPath, output, 'utf-8');
writeFileSync(fullOutputPath, output, 'utf-8');
console.log(
  `Generated ${outputPath} + llms-full.txt (${orderedFiles.length} files from ${orderedDirs.length} sections)`
);
