#!/usr/bin/env node
// Daily cron: extends each IG long-lived token's TTL by another 60 days.
//
// Reads config/social-accounts.json + .env, calls graph.instagram.com/refresh_access_token
// per account, and prints the new tokens to stdout for the operator to paste back into .env.
//
// Long-lived IG tokens last 60 days and can be refreshed any time before
// expiry. Run this daily on the production node (e.g., launchd on the M5).

import { writeFile } from 'node:fs/promises';
import { loadSocialAccountsConfig } from '../src/config/social-accounts.js';
import { InstagramPublisher } from '../src/publishers/instagram.js';

const ENV_FILE = process.env.IG_REFRESH_OUTPUT ?? null;

const config = await loadSocialAccountsConfig();
const ig = config.instagram ?? {};
const accountSlugs = Object.keys(ig);
if (!accountSlugs.length) {
  console.error('No instagram accounts in social-accounts config.');
  process.exit(1);
}

const refreshed = [];
const failures = [];

for (const slug of accountSlugs) {
  const account = ig[slug];
  try {
    const publisher = new InstagramPublisher({
      userId: account.userId,
      longLivedToken: account.longLivedToken,
    });
    const result = await publisher.refreshLongLivedToken();
    const days = Math.round(result.expiresInSeconds / 86400);
    refreshed.push({ slug, token: result.longLivedToken, days });
    console.log(`✓ ${slug}: refreshed (TTL ${days}d)`);
  } catch (error) {
    failures.push({ slug, error: error.message });
    console.error(`× ${slug}: ${error.message}`);
  }
}

const slugUpper = (slug) => slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const envLines = refreshed.map((r) => `IG_${slugUpper(r.slug)}_LONG_LIVED_TOKEN=${r.token}`);

if (ENV_FILE) {
  await writeFile(ENV_FILE, envLines.join('\n') + '\n');
  console.log(`\nWrote ${envLines.length} tokens to ${ENV_FILE}`);
} else {
  console.log('\nUpdated tokens (paste into .env):');
  for (const line of envLines) console.log(line);
}

if (failures.length) {
  console.error(`\n${failures.length} account(s) failed to refresh. If a token is already expired (~60 days no calls) you must re-run instagram-oauth-bootstrap.js.`);
  process.exit(2);
}
