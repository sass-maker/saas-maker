#!/usr/bin/env node
import { runOverlay } from '../../../packages/tooling/astro-landing/overlay.js';

await runOverlay({
  astroDist: 'landing-astro/dist',
  assets: '.open-next/assets',
  strict: process.argv.includes('--strict'),
});