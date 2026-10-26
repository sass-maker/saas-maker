import { existsSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

// The private catalog belongs to Site Health. Resolve the primary workspace
// even when a shared generator runs in an isolated SaaS Maker worktree.
export function primaryFleetRoot(repoRoot) {
  const result = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 5_000,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  return result.status === 0 ? dirname(dirname(result.stdout.trim())) : dirname(resolve(repoRoot));
}

export function catalogPaths(repoRoot, { fleetRoot = primaryFleetRoot(repoRoot) } = {}) {
  const siteHealthRoot = join(fleetRoot, 'site-health');
  const ownerSource = join(siteHealthRoot, 'catalog/projects.json');
  const legacySource = join(repoRoot, 'catalog/projects.json');
  if (
    existsSync(ownerSource) &&
    existsSync(legacySource) &&
    realpathSync(ownerSource) !== realpathSync(legacySource)
  ) {
    throw new Error(
      'Two editable portfolio catalogs found. Keep the canonical source in Site Health and use a compatibility symlink.'
    );
  }
  // Retain old standalone tooling checkouts during the ownership transition.
  // A compatibility symlink still resolves to the single Site Health file.
  const source = existsSync(ownerSource) || !existsSync(legacySource) ? ownerSource : legacySource;
  const catalogRoot = dirname(source);
  return {
    fleetRoot,
    siteHealthRoot,
    source,
    operations: join(catalogRoot, 'generated/operations.json'),
    repositoryTable: join(catalogRoot, 'generated/repository-classifications.md'),
    compatibility: join(siteHealthRoot, 'apps/backend/config/projects.json'),
  };
}
