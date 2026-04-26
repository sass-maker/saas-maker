/**
 * Foundry compliance drift detector.
 *
 * Audits a project against the foundry rules — expanded vs. lib/auditor.ts:
 *  - foundry.json present
 *  - AGENTS.md present
 *  - .husky/pre-push present and references secret-scan
 *  - eslint.config.js extends @saas-maker/eslint-config
 *  - tsconfig.json extends @saas-maker/tsconfig
 *  - prettier linked
 *  - foundry-ci workflow present
 *  - widgets dir present (or n/a for non-foundry projects)
 *
 * Each check is { id, label, status, detail, fix? } so the runner can apply
 * fixes via the --fix flag.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type DriftStatus = 'pass' | 'warn' | 'fail';

export interface DriftCheck {
  id: string;
  label: string;
  status: DriftStatus;
  detail: string;
  fix?: () => void;
}

export interface DriftReport {
  project: string;
  path: string;
  checks: DriftCheck[];
  passCount: number;
  totalCount: number;
}

export interface DriftOptions {
  /** Skip the AGENTS.md check (some packages don't need one). */
  skipAgents?: boolean;
}

const HUSKY_PRE_PUSH_FALLBACK = `#!/bin/sh
set -e
if grep -q '"lint"' package.json 2>/dev/null; then
  pnpm run lint --if-present || { echo "lint failed" >&2; exit 1; }
fi
SECRETS=$(git ls-files -z 2>/dev/null \\
  | xargs -0 grep -lE 'sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}' 2>/dev/null \\
  | grep -vE '(\\.example$|/tests?/|/__tests__/)' || true)
if [ -n "$SECRETS" ]; then
  echo "Secret leak detected: $SECRETS" >&2
  exit 1
fi
`;

export function checkProjectDrift(
  projectPath: string,
  projectName: string,
  opts: DriftOptions = {},
): DriftReport {
  const checks: DriftCheck[] = [];

  // 1. foundry.json
  const foundryPath = join(projectPath, 'foundry.json');
  checks.push(
    existsSync(foundryPath)
      ? { id: 'foundry-json', label: 'foundry.json', status: 'pass', detail: 'present' }
      : {
          id: 'foundry-json',
          label: 'foundry.json',
          status: 'fail',
          detail: 'missing',
          fix: () => writeFileSync(foundryPath, JSON.stringify({ slug: projectName, linked: false }, null, 2) + '\n'),
        },
  );

  // 2. AGENTS.md
  if (!opts.skipAgents) {
    const agentsPath = join(projectPath, 'AGENTS.md');
    checks.push(
      existsSync(agentsPath)
        ? { id: 'agents-md', label: 'AGENTS.md', status: 'pass', detail: 'present' }
        : {
            id: 'agents-md',
            label: 'AGENTS.md',
            status: 'warn',
            detail: 'missing',
            fix: () => writeFileSync(agentsPath, `# agents.md — ${projectName}\n\n## Purpose\n_TODO_\n`),
          },
    );
  }

  // 3. husky pre-push with secret scan
  const huskyPath = join(projectPath, '.husky/pre-push');
  if (!existsSync(huskyPath)) {
    checks.push({
      id: 'husky-pre-push',
      label: 'husky pre-push',
      status: 'fail',
      detail: 'missing',
      fix: () => {
        mkdirSync(dirname(huskyPath), { recursive: true });
        writeFileSync(huskyPath, HUSKY_PRE_PUSH_FALLBACK);
        try {
          chmodSync(huskyPath, 0o755);
        } catch {
          // Permissions may fail on Windows / some FS — ignore.
        }
      },
    });
  } else {
    const content = readFileSync(huskyPath, 'utf-8');
    checks.push({
      id: 'husky-pre-push',
      label: 'husky pre-push',
      status: content.includes('SECRETS') || content.includes('secret') ? 'pass' : 'warn',
      detail: content.includes('SECRETS') ? 'secret-scan present' : 'no secret scan detected',
    });
  }

  // 4. ESLint extends Foundry
  const eslintPath = join(projectPath, 'eslint.config.js');
  if (!existsSync(eslintPath)) {
    checks.push({ id: 'eslint', label: 'eslint config', status: 'fail', detail: 'missing eslint.config.js' });
  } else {
    const content = readFileSync(eslintPath, 'utf-8');
    checks.push({
      id: 'eslint',
      label: 'eslint config',
      status: content.includes('@saas-maker/eslint-config') ? 'pass' : 'fail',
      detail: content.includes('@saas-maker/eslint-config')
        ? 'extends Foundry'
        : 'does not extend @saas-maker/eslint-config',
    });
  }

  // 5. tsconfig extends Foundry
  const tsPath = join(projectPath, 'tsconfig.json');
  if (!existsSync(tsPath)) {
    checks.push({ id: 'tsconfig', label: 'tsconfig', status: 'fail', detail: 'missing tsconfig.json' });
  } else {
    const content = readFileSync(tsPath, 'utf-8');
    checks.push({
      id: 'tsconfig',
      label: 'tsconfig',
      status: content.includes('@saas-maker/tsconfig') ? 'pass' : 'warn',
      detail: content.includes('@saas-maker/tsconfig') ? 'extends Foundry' : 'custom or missing extends',
    });
  }

  // 6. Prettier linked
  const pkgPath = join(projectPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      checks.push({
        id: 'prettier',
        label: 'prettier-config',
        status: pkg['prettier'] === '@saas-maker/prettier-config' ? 'pass' : 'warn',
        detail:
          pkg['prettier'] === '@saas-maker/prettier-config'
            ? 'linked to Foundry'
            : 'not using @saas-maker/prettier-config',
      });
    } catch {
      checks.push({ id: 'prettier', label: 'prettier-config', status: 'warn', detail: 'package.json unreadable' });
    }
  }

  // 7. foundry-ci usage
  const ciDir = join(projectPath, '.github/workflows');
  if (!existsSync(ciDir)) {
    checks.push({ id: 'foundry-ci', label: 'foundry-ci workflow', status: 'warn', detail: 'no .github/workflows' });
  } else {
    let usesFoundryCI = false;
    try {
      for (const entry of readdirSync(ciDir)) {
        const p = join(ciDir, entry);
        if (entry.endsWith('.yml') || entry.endsWith('.yaml')) {
          if (readFileSync(p, 'utf-8').includes('foundry-ci')) {
            usesFoundryCI = true;
            break;
          }
        }
      }
    } catch {
      // ignore
    }
    checks.push({
      id: 'foundry-ci',
      label: 'foundry-ci workflow',
      status: usesFoundryCI ? 'pass' : 'warn',
      detail: usesFoundryCI ? 'wired up' : 'no workflow references foundry-ci',
    });
  }

  // 8. widgets dir (only flag for foundry-linked projects)
  if (existsSync(foundryPath)) {
    const widgetsDir = join(projectPath, 'src/components/widgets');
    const altWidgetsDir = join(projectPath, 'src/widgets');
    const has = existsSync(widgetsDir) || existsSync(altWidgetsDir);
    checks.push({
      id: 'widgets',
      label: 'widgets',
      status: has ? 'pass' : 'warn',
      detail: has ? 'embeds Foundry widgets' : 'no widgets/ directory found',
    });
  }

  const passCount = checks.filter((c) => c.status === 'pass').length;
  return { project: projectName, path: projectPath, checks, passCount, totalCount: checks.length };
}

export function applyDriftFixes(report: DriftReport): { applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const c of report.checks) {
    if (c.status === 'pass') continue;
    if (c.fix) {
      try {
        c.fix();
        applied.push(c.id);
      } catch (err) {
        skipped.push(`${c.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      skipped.push(c.id);
    }
  }
  return { applied, skipped };
}
