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

export function scaffoldCI(cwd: string = process.cwd()): void {
  const ciDir = join(cwd, '.github', 'workflows');
  if (!existsSync(ciDir)) mkdirSync(ciDir, { recursive: true });

  const ciConfig = `name: CI
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  foundry-ci:
    uses: sarthakagrawal927/saas-maker/.github/workflows/foundry-ci.yml@main
`;
  writeFileSync(join(ciDir, 'ci.yml'), ciConfig);
  log.success('✓ Linked to Global Foundry CI');
}
