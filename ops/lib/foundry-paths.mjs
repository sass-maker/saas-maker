import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const opsRoot = resolve(import.meta.dirname, '..');

export function resolveFoundryProjectsPath() {
  const monorepoPath = resolve(opsRoot, '..', 'foundry.projects.json');
  if (existsSync(monorepoPath)) return monorepoPath;

  return resolve(opsRoot, '..', 'saas-maker', 'foundry.projects.json');
}
