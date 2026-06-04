#!/usr/bin/env node
// inline-critical-css.mjs — runs Beasties over Next.js prerendered HTML
// to inline above-fold CSS and lazy-load the rest.
//
// Beasties scans each HTML's stylesheets, picks only the rules actually
// used by elements in that HTML, inlines them into <head>, and rewrites
// the original <link rel="stylesheet"> to load asynchronously
// (rel="preload" + onload swap).
//
// This variant targets `next build` with `output: 'export'` — Next writes
// the final static HTML directly to `out/` and assets to `out/_next/`.
// No OpenNext / standalone copy involved.
//
// Safe by construction: Beasties only removes <link rel="stylesheet">
// if it has successfully extracted the critical subset and added the
// async-load fallback. Worst case: the file is left as-is.

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import Beasties from "beasties";

// Static export writes prerendered HTML directly to `out/<route>.html`.
const PRERENDERED_ROOTS = [resolve("out")].filter((p) => existsSync(p));
const STATIC_ROOT = resolve("out");

async function walkHtml(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const st = await stat(full);
    if (st.isDirectory()) {
      out.push(...(await walkHtml(full)));
    } else if (entry.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const htmls = [];
  for (const root of PRERENDERED_ROOTS) {
    htmls.push(...(await walkHtml(root)));
  }
  if (htmls.length === 0) {
    console.log("[inline-critical-css] no .html files under out/ — skipping");
    return;
  }

  const beasties = new Beasties({
    // Where Beasties resolves stylesheet hrefs against. Static export
    // serves from `/`, so an href like `/_next/static/chunks/foo.css`
    // resolves to `out/_next/static/chunks/foo.css`.
    path: STATIC_ROOT,
    publicPath: "/",
    // `swap` rewrites <link rel="stylesheet"> to preload + onload swap
    // so the leftover (non-critical) CSS loads without blocking paint.
    preload: "swap",
    // Don't inline web fonts via <style> — they're cross-origin and
    // would re-introduce blocking time. Browser's own font discovery
    // still handles them.
    inlineFonts: false,
    // Match selectors against the HTML body to decide what's critical.
    pruneSource: false, // keep the original .css file intact on disk
    logLevel: "warn",
  });

  // Beasties emits BOTH a `<link rel="preload" as="style" onload=...>`
  // AND keeps the original `<link rel="stylesheet">` for each CSS file
  // it processed — the stylesheet is still render-blocking. Post-process
  // to remove the redundant blocking stylesheet line; the preload+onload
  // swap already covers the no-JS case via the matching <noscript> entry.
  function deRenderBlockCss(html) {
    return html.replace(
      /<link rel="stylesheet" href="([^"]+\.css)"[^>]*\/?>(?!<\/noscript>)/g,
      (match, href) => {
        // Only drop if the same href appears as a preload+onload swap
        // earlier in the document — never drop a lone stylesheet.
        const preloadPattern = new RegExp(
          `<link rel="preload" href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*onload=`,
        );
        return preloadPattern.test(html) ? "" : match;
      },
    );
  }

  let total = 0;
  let saved = 0;
  for (const file of htmls) {
    const before = await readFile(file, "utf8");
    let after;
    try {
      after = await beasties.process(before);
    } catch (err) {
      console.warn(`[inline-critical-css] skipping ${file}: ${err.message}`);
      continue;
    }
    after = deRenderBlockCss(after);
    if (after === before) continue;
    await writeFile(file, after);
    const delta = before.length - after.length;
    total += 1;
    saved += delta;
    const rel = file.replace(`${process.cwd()}/`, "");
    console.log(
      `[inline-critical-css] ${rel}: ${(before.length / 1024).toFixed(1)}KB → ${(after.length / 1024).toFixed(1)}KB`,
    );
  }

  console.log(
    `[inline-critical-css] done — processed ${total} file(s), net size change ${(saved / 1024).toFixed(1)}KB`,
  );
}

main().catch((err) => {
  console.error("[inline-critical-css] fatal:", err);
  process.exit(1);
});
