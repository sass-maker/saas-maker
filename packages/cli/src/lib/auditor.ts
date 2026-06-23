import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { usesBiome } from './forge.js';

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
    results.push({ check: 'Foundry Config', status: 'warn', detail: 'Legacy .saasmaker.json — run `fnd init` to migrate' });
  } else {
    results.push({ check: 'Foundry Config', status: 'fail', detail: 'Missing foundry.json' });
  }

  // 2. Check Biome (fleet lint/format standard)
  if (usesBiome(cwd)) {
    results.push({ check: 'Biome Standard', status: 'pass', detail: 'biome.json present (fleet lint standard)' });
  } else {
    results.push({ check: 'Biome Standard', status: 'fail', detail: 'Missing biome.json — run `fnd init` to scaffold' });
  }

  // 3. Check TSConfig
  const tsPath = join(cwd, 'tsconfig.json');
  if (existsSync(tsPath)) {
    const content = readFileSync(tsPath, 'utf-8');
    if (content.includes('tsconfig.base.json') || content.includes('"strict": true')) {
      results.push({ check: 'TS Standard', status: 'pass', detail: 'Local tsconfig' });
    } else {
      results.push({ check: 'TS Standard', status: 'warn', detail: 'Custom tsconfig' });
    }
  }

  // 4. Prettier — Biome handles formatting (fleet standard)
  if (usesBiome(cwd)) {
    results.push({ check: 'Format Standard', status: 'pass', detail: 'Biome (handles formatting)' });
  } else if (existsSync(join(cwd, '.prettierrc.json')) || existsSync(join(cwd, '.prettierrc'))) {
    results.push({ check: 'Format Standard', status: 'warn', detail: 'Legacy .prettierrc — migrate to Biome' });
  } else {
    results.push({ check: 'Format Standard', status: 'warn', detail: 'No formatter config — run `fnd init`' });
  }

  // 5. Code Health (Fallow Deep Audit)
  try {
    const hasFallow = execSync('command -v fallow', { encoding: 'utf-8', stdio: 'pipe' }).trim();
    if (hasFallow) {
      try {
        // Attempt a quick fallow check. If fallow returns non-zero, there are issues.
        // We use --quiet to suppress output and just rely on exit code.
        execSync('fallow check --quiet', { cwd, encoding: 'utf-8', stdio: 'pipe' });
        results.push({ check: 'Code Health', status: 'pass', detail: 'Zero dead code detected' });
      } catch (fallowErr) {
        results.push({ check: 'Code Health', status: 'warn', detail: 'Fallow detected unused code/duplication' });
      }
    }
  } catch {
    results.push({ check: 'Code Health', status: 'warn', detail: 'Fallow engine not installed locally/globally' });
  }

  // 6. Check Governance (Renovate)
  if (existsSync(join(cwd, 'renovate.json'))) {
    results.push({ check: 'Hygiene', status: 'pass', detail: 'Renovate configured' });
  } else {
    results.push({ check: 'Hygiene', status: 'warn', detail: 'Missing renovate.json' });
  }

  return results;
}
