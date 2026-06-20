#!/usr/bin/env node
import { runInlineCss } from './inline-css.js';
import { runOverlay } from './overlay.js';

const [, , subcommand, ...rest] = process.argv;

function parseArgs(argv) {
  const opts = { strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--astro-dist' && argv[i + 1]) {
      opts.astroDist = argv[++i];
    } else if (arg === '--assets' && argv[i + 1]) {
      opts.assets = argv[++i];
    }
  }
  return opts;
}

const opts = parseArgs(rest);

try {
  if (subcommand === 'inline-css') {
    await runInlineCss(opts);
  } else if (subcommand === 'overlay') {
    await runOverlay(opts);
  } else {
    console.error('Usage: astro-landing <inline-css|overlay> [--astro-dist path] [--assets path] [--strict]');
    process.exit(1);
  }
} catch (err) {
  console.error('[astro-landing] fatal:', err);
  process.exit(1);
}
