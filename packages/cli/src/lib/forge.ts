import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './ui.js';

export function detectProjectType(cwd: string = process.cwd()): 'next' | 'vite' | 'node' {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return 'node';
  
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  if (deps.next) return 'next';
  if (deps.vite) return 'vite';
  return 'node';
}

export function applyStandard(type: 'next' | 'vite' | 'node', cwd: string = process.cwd()): void {
  // 1. ESLint
  const eslintConfig = `import config from "@saas-maker/eslint-config/${type === 'node' ? '' : type}";\nexport default config;`;
  writeFileSync(join(cwd, 'eslint.config.js'), eslintConfig);
  log.success('✓ Applied Foundry ESLint config');

  // 2. TSConfig
  const tsConfig = { extends: `@saas-maker/tsconfig/${type}.json` };
  writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
  log.success('✓ Applied Foundry TSConfig');

  // 3. Prettier
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkg.prettier = "@saas-maker/prettier-config";
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    log.success('✓ Linked Foundry Prettier config');
  }
}

export function scaffoldRenovate(cwd: string = process.cwd()): void {
  const file = join(cwd, 'renovate.json');
  if (existsSync(file)) return;

  const config = {
    extends: ["github>sarthakagrawal927/foundry-renovate-config"]
  };
  writeFileSync(file, JSON.stringify(config, null, 2));
  log.success('✓ Created renovate.json');
}

export function scaffoldWeeklyCi(cwd: string = process.cwd()): void {
  const workflowDir = join(cwd, '.github', 'workflows');
  const file = join(workflowDir, 'weekly.yml');
  if (existsSync(file)) return;

  mkdirSync(workflowDir, { recursive: true });

  const workflow = `name: Weekly Quality Check
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9am UTC
  workflow_dispatch:     # Manual trigger anytime

jobs:
  foundry-weekly:
    uses: sarthakagrawal927/saas-maker/.github/workflows/foundry-weekly.yml@main
`;
  writeFileSync(file, workflow);
  log.success('✓ Created .github/workflows/weekly.yml');
}
