#!/usr/bin/env node
/**
 * Deprecate @saas-maker npm packages removed from the monorepo (2026-06-20).
 *
 * Requires npm publish rights: `npm login` or NPM_TOKEN in the environment.
 *
 * Usage:
 *   pnpm deprecate:removed-packages
 *   pnpm deprecate:removed-packages -- --dry-run
 */
const MESSAGE =
  'Removed from saas-maker monorepo 2026-06-20. Use local eslint/tsconfig/prettier from fnd init templates or repo-local configs. See saas-maker docs/getting-started/standard.md.';

/** Packages that were published to npm and are no longer maintained in-repo. */
const PACKAGES = [
  '@saas-maker/eslint-config',
  '@saas-maker/prettier-config',
  '@saas-maker/tsconfig',
  '@saas-maker/ops',
  '@saas-maker/db',
  '@saas-maker/shared-types',
  '@saas-maker/eslint-plugin-fallow',
  '@saas-maker/email',
  '@saas-maker/foundry-shield',
  '@saas-maker/test-config',
  '@saas-maker/dev-config',
];

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { execSync } = await import('node:child_process');

  try {
    execSync('npm whoami', { stdio: 'pipe' });
  } catch {
    console.error('npm auth required. Run `npm login` or set NPM_TOKEN, then retry.');
    process.exit(1);
  }

  let failed = 0;
  for (const name of PACKAGES) {
    try {
      execSync(`npm view ${name} version`, { stdio: 'pipe' });
    } catch {
      console.log(`skip ${name} (not published)`);
      continue;
    }

    const cmd = `npm deprecate ${name}@${JSON.stringify('*')} ${JSON.stringify(MESSAGE)}`;
    if (dryRun) {
      console.log(`[dry-run] ${cmd}`);
      continue;
    }

    try {
      execSync(cmd, { stdio: 'inherit' });
      console.log(`deprecated ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`failed ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
