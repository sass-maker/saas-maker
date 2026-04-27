/**
 * Static JSON snippets for quick spreading into existing wrangler configs.
 * Use these when you need partial defaults without invoking defineWrangler().
 */

import { FOUNDRY_COMPATIBILITY_DATE } from './constants.js';

export const observability = { enabled: true } as const;

export const nodeCompat = ['nodejs_compat'] as const;

export const spaAssets = {
  directory: './dist',
  binding: 'ASSETS',
  not_found_handling: 'single-page-application' as const,
};

export const ai = { binding: 'AI' } as const;

export const baseDefaults = {
  compatibility_date: FOUNDRY_COMPATIBILITY_DATE,
  observability: { enabled: true },
};
