#!/usr/bin/env node
// Merge the Blume docs build into the showcase (sassmaker.com apex) output.
//
// The apex site is served by this app (CF Pages project "saas-maker-home").
// The documentation lives in ../docs-blume (Blume, base: '/docs', site:
// sassmaker.com). Rather than run a separate docs.sassmaker.com deploy, we
// fold the Blume output into this app's `dist/docs/` so `sassmaker.com/docs`
// is served from the same Pages project.
//
// Run AFTER `astro build` so the showcase's own output is already present and
// nothing it emits gets clobbered — we only add the `docs/` subtree.
//
// Usage: node scripts/merge-blume-docs.mjs

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const showcaseDir = resolve(__dirname, '..');
const blumeDir = resolve(showcaseDir, '..', 'docs-blume');
const showcaseDist = join(showcaseDir, 'dist');
const blumeDist = join(blumeDir, 'dist');
const targetDocsDir = join(showcaseDist, 'docs');

function run(cmd, cwd) {
  console.log(`[merge-blume-docs] $ ${cmd}  (in ${cwd})`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

if (!existsSync(showcaseDist)) {
  console.error(
    `[merge-blume-docs] showcase dist not found at ${showcaseDist}.\n` +
      'Run `astro build` first — this step must run AFTER the showcase build.',
  );
  process.exit(1);
}

if (!existsSync(blumeDir)) {
  console.error(`[merge-blume-docs] docs-blume app not found at ${blumeDir}.`);
  process.exit(1);
}

// docs-blume manages its own dependencies (own package-lock.json /
// pnpm-lock.yaml). Install only if node_modules is missing so repeat builds
// stay fast; CI clean checkouts will install.
if (!existsSync(join(blumeDir, 'node_modules'))) {
  run('npm install', blumeDir);
}

// Build the Blume docs. base '/docs' and site 'sassmaker.com' come from
// blume.config.ts, so assets are already emitted under /docs/_astro/.
run('npm run build', blumeDir);

if (!existsSync(join(blumeDist, 'index.html'))) {
  console.error(
    `[merge-blume-docs] expected ${join(blumeDist, 'index.html')} after build; ` +
      'Blume build did not produce the expected output.',
  );
  process.exit(1);
}

// Replace any prior merged docs subtree, then copy the fresh Blume output in.
rmSync(targetDocsDir, { recursive: true, force: true });
mkdirSync(targetDocsDir, { recursive: true });
cpSync(blumeDist, targetDocsDir, { recursive: true });

console.log(
  `[merge-blume-docs] merged Blume docs into ${targetDocsDir} ` +
    `(served at sassmaker.com/docs).`,
);
