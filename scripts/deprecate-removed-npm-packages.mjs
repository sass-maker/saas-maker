#!/usr/bin/env node
/**
 * Deprecate @saas-maker npm packages removed from the monorepo (2026-06-20).
 *
 * Requires npm publish rights: `npm login` or NPM_TOKEN in the environment.
 * If your account has 2FA (required for deprecate), pass a one-time password:
 *   pnpm deprecate:removed-packages -- --otp=123456
 *   NPM_OTP=123456 pnpm deprecate:removed-packages
 *
 * Usage:
 *   pnpm deprecate:removed-packages
 *   pnpm deprecate:removed-packages -- --dry-run
 *   pnpm deprecate:removed-packages -- --otp=123456
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
const otpArg = process.argv.find((arg) => arg.startsWith('--otp='));
const otp = otpArg?.slice('--otp='.length) || process.env.NPM_OTP || '';

async function main() {
  const { execSync } = await import('node:child_process');

  try {
    execSync('npm whoami', { stdio: 'pipe' });
  } catch {
    console.error('npm auth required. Run `npm login` or set NPM_TOKEN, then retry.');
    process.exit(1);
  }

  if (!dryRun && !otp) {
    console.error(
      'npm deprecate requires 2FA on this account. Re-run with `--otp=<code>` or NPM_OTP, or use a granular token with bypass 2FA enabled.',
    );
    process.exit(1);
  }

  const otpFlag = otp ? ` --otp=${otp}` : '';

  let failed = 0;
  for (const name of PACKAGES) {
    try {
      execSync(`npm view ${name} version`, { stdio: 'pipe' });
    } catch {
      console.log(`skip ${name} (not published)`);
      continue;
    }

    const cmd = `npm deprecate ${name}@${JSON.stringify('*')} ${JSON.stringify(MESSAGE)}${otpFlag}`;
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
