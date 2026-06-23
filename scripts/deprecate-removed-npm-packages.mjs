#!/usr/bin/env node
/**
 * Deprecate retired @saas-maker npm packages (2026-06-20 cleanup).
 *
 * Discovers all packages in the @saas-maker scope via `npm access list packages`,
 * then deprecates everything except the small set still maintained in-repo.
 *
 * Requires npm publish rights: `npm login` or NPM_TOKEN in the environment.
 * If your account has 2FA (required for deprecate), pass a one-time password:
 *   pnpm deprecate:removed-packages -- --otp=123456
 *   NPM_OTP=123456 pnpm deprecate:removed-packages
 *
 * Usage:
 *   pnpm deprecate:removed-packages -- --list
 *   pnpm deprecate:removed-packages -- --dry-run
 *   pnpm deprecate:removed-packages -- --otp=123456
 */
const MESSAGE =
  'Retired from saas-maker monorepo 2026-06-20. Use local eslint/tsconfig/prettier from fnd init templates, @saas-maker/sdk for API clients, or repo-local helpers. See saas-maker docs/getting-started/standard.md.';

/** Still published and maintained in the saas-maker monorepo. */
const ACTIVE_PACKAGES = new Set([
  '@saas-maker/sdk',
  '@saas-maker/cli',
  '@saas-maker/feedback',
  '@saas-maker/testimonials',
  '@saas-maker/changelog-widget',
  '@saas-maker/waitlist',
]);

const dryRun = process.argv.includes('--dry-run');
const listOnly = process.argv.includes('--list');
const otpArg = process.argv.find((arg) => arg.startsWith('--otp='));
const otp = otpArg?.slice('--otp='.length) || process.env.NPM_OTP || '';

function listScopePackages(npm) {
  const raw = npm('npm access list packages @saas-maker --json');
  return Object.keys(JSON.parse(raw))
    .filter((name) => name.startsWith('@saas-maker/'))
    .sort();
}

async function main() {
  const { execSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  let npmUserConfig;
  let npmUserConfigDir;
  if (process.env.NPM_TOKEN) {
    npmUserConfigDir = mkdtempSync(join(tmpdir(), 'npm-deprecate-'));
    npmUserConfig = join(npmUserConfigDir, '.npmrc');
    writeFileSync(
      npmUserConfig,
      `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`,
      'utf8'
    );
  }

  const npmEnv = { ...process.env };
  if (npmUserConfig) npmEnv.NPM_CONFIG_USERCONFIG = npmUserConfig;

  const npm = (cmd) =>
    execSync(cmd, {
      encoding: 'utf8',
      env: npmEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  const npmInherit = (cmd) =>
    execSync(cmd, {
      env: npmEnv,
      stdio: 'inherit',
    });

  try {
    npm('npm whoami');
  } catch {
    console.error('npm auth required. Run `npm login`, set NPM_TOKEN, or pass `--otp`.');
    process.exit(1);
  }

  let scopePackages;
  try {
    scopePackages = listScopePackages(npm);
  } catch (err) {
    console.error('Failed to list @saas-maker packages. Are you logged in as the scope owner?');
    console.error(err instanceof Error ? err.message : err);
    if (npmUserConfigDir) rmSync(npmUserConfigDir, { recursive: true, force: true });
    process.exit(1);
  }

  const active = scopePackages.filter((name) => ACTIVE_PACKAGES.has(name));
  const retired = scopePackages.filter((name) => !ACTIVE_PACKAGES.has(name));

  console.log(`@saas-maker scope: ${scopePackages.length} packages total`);
  console.log(`  keep (${active.length}): ${active.join(', ') || '(none)'}`);
  console.log(`  deprecate (${retired.length}):`);
  for (const name of retired) console.log(`    - ${name}`);

  if (listOnly) return;

  if (!dryRun && !otp && !process.env.NPM_TOKEN) {
    console.error(
      '\nnpm deprecate requires 2FA on this account. Re-run with `--otp=<code>` or NPM_OTP, or set NPM_TOKEN (automation/granular write token with bypass 2FA).'
    );
    process.exit(1);
  }

  const otpFlag = otp ? ` --otp=${otp}` : '';
  let failed = 0;

  for (const name of retired) {
    const cmd = `npm deprecate ${name}@${JSON.stringify('*')} ${JSON.stringify(MESSAGE)}${otpFlag}`;
    if (dryRun) {
      console.log(`[dry-run] ${cmd}`);
      continue;
    }

    try {
      npmInherit(cmd);
      console.log(`deprecated ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`failed ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  if (npmUserConfigDir) rmSync(npmUserConfigDir, { recursive: true, force: true });

  process.exit(failed > 0 ? 1 : 0);
}

main();
