import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AuditResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export function auditProject(cwd: string = process.cwd()): AuditResult[] {
  const results: AuditResult[] = [];
  const pkgPath = join(cwd, 'package.json');
  
  if (!existsSync(pkgPath)) {
    return [{ check: 'Project', status: 'fail', detail: 'No package.json found' }];
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  // 1. Check foundry.json
  if (existsSync(join(cwd, 'foundry.json'))) {
    results.push({ check: 'Foundry Config', status: 'pass', detail: 'foundry.json present' });
  } else if (existsSync(join(cwd, '.saasmaker.json'))) {
    results.push({ check: 'Foundry Config', status: 'warn', detail: 'Using legacy .saasmaker.json' });
  } else {
    results.push({ check: 'Foundry Config', status: 'fail', detail: 'Missing foundry.json' });
  }

  // 2. Check ESLint
  const eslintPath = join(cwd, 'eslint.config.js');
  if (existsSync(eslintPath)) {
    const content = readFileSync(eslintPath, 'utf-8');
    if (content.includes('@saas-maker/eslint-config')) {
      results.push({ check: 'ESLint Standard', status: 'pass', detail: 'Extends Foundry Config' });
    } else {
      results.push({ check: 'ESLint Standard', status: 'fail', detail: 'Not using Foundry standard' });
    }
  } else {
    results.push({ check: 'ESLint Standard', status: 'fail', detail: 'Missing eslint.config.js' });
  }

  // 3. Check TSConfig
  const tsPath = join(cwd, 'tsconfig.json');
  if (existsSync(tsPath)) {
    const content = readFileSync(tsPath, 'utf-8');
    if (content.includes('@saas-maker/tsconfig')) {
      results.push({ check: 'TS Standard', status: 'pass', detail: 'Extends Foundry TSConfig' });
    } else {
      results.push({ check: 'TS Standard', status: 'fail', detail: 'Not using Foundry TSConfig' });
    }
  }

  // 4. Check Prettier
  if (pkg.prettier === '@saas-maker/prettier-config') {
    results.push({ check: 'Prettier Standard', status: 'pass', detail: 'Linked to Foundry' });
  } else {
    results.push({ check: 'Prettier Standard', status: 'warn', detail: 'Custom prettier or missing link' });
  }

  // 5. Check Governance
  if (existsSync(join(cwd, 'renovate.json'))) {
    results.push({ check: 'Hygiene', status: 'pass', detail: 'Renovate configured' });
  } else {
    results.push({ check: 'Hygiene', status: 'warn', detail: 'Missing renovate.json' });
  }

  return results;
}
