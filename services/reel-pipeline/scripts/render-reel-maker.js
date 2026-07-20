#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

import { ReelMakerAdapter } from '../src/adapters/reel-maker.js';
import { normalizeVideoBrief } from '../src/video-brief.js';
import { decorateRenderResult } from '../../content-factory/src/manifest.js';

const args = parseArgs(process.argv.slice(2));
if (!args.brief) {
  console.error('usage: node scripts/render-reel-maker.js --brief <brief.json> [--variant-id <id>] [--template <id>] [--hook <text>] [--cta <text>] [--skip-remotion]');
  process.exit(2);
}

try {
  const brief = normalizeVideoBrief(JSON.parse(await readFile(args.brief, 'utf8')));
  const adapter = new ReelMakerAdapter({
    engineDir: args.engineDir,
    skipRemotionRender: args.skipRemotion || process.env.REEL_MAKER_SKIP_REMOTION === '1',
  });
  const render = await decorateRenderResult({ brief, render: await adapter.createVideo(brief, {
    variantId: args.variantId,
    template: args.template,
    hook: args.hook,
    cta: args.cta,
  }), variantId: args.variantId });
  process.stdout.write(`${JSON.stringify(render)}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === '--brief') parsed.brief = values[++i];
    else if (value === '--variant-id') parsed.variantId = values[++i];
    else if (value === '--template') parsed.template = values[++i];
    else if (value === '--hook') parsed.hook = values[++i];
    else if (value === '--cta') parsed.cta = values[++i];
    else if (value === '--engine-dir') parsed.engineDir = values[++i];
    else if (value === '--skip-remotion') parsed.skipRemotion = true;
  }
  return parsed;
}
