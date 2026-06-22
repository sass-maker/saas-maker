/**
 * Foundry compliance drift detector.
 *
 * Audits a project against the foundry rules — expanded vs. lib/auditor.ts:
 *  - foundry.json present
 *  - AGENTS.md present
 *  - .husky/pre-push present and references secret-scan
 *  - eslint.config.js present (local flat config)
 *  - tsconfig.json present (local base)
 *  - .prettierrc.json present
 *  - foundry-ci workflow present
 *  - widgets dir present (or n/a for non-foundry projects)
 *
 * Each check is { id, label, status, detail, fix? } so the runner can apply
 * fixes via the --fix flag.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, chmodSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { usesBiome } from './forge.js';

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

  // 4. ESLint config present — Biome is a valid alternative (treat as pass)
  const eslintPath = join(projectPath, 'eslint.config.js');
  const eslintMjsPath = join(projectPath, 'eslint.config.mjs');
  if (usesBiome(projectPath)) {
    checks.push({ id: 'eslint', label: 'eslint config', status: 'pass', detail: 'Biome (valid lint standard)' });
  } else if (!existsSync(eslintPath) && !existsSync(eslintMjsPath)) {
    checks.push({ id: 'eslint', label: 'eslint config', status: 'fail', detail: 'missing eslint.config.js' });
  } else {
    const content = readFileSync(existsSync(eslintPath) ? eslintPath : eslintMjsPath, 'utf-8');
    const inlined = content.includes('Plain flat ESLint') || content.includes('eslint-config-next');
    checks.push({
      id: 'eslint',
      label: 'eslint config',
      status: inlined ? 'pass' : 'warn',
      detail: inlined ? 'local flat config' : 'custom eslint.config present',
    });
  }

  // 5. tsconfig present
  const tsPath = join(projectPath, 'tsconfig.json');
  if (!existsSync(tsPath)) {
    checks.push({ id: 'tsconfig', label: 'tsconfig', status: 'fail', detail: 'missing tsconfig.json' });
  } else {
    const content = readFileSync(tsPath, 'utf-8');
    const local =
      content.includes('tsconfig.base.json') ||
      content.includes('"strict": true') ||
      content.includes('"moduleResolution": "bundler"');
    checks.push({
      id: 'tsconfig',
      label: 'tsconfig',
      status: local ? 'pass' : 'warn',
      detail: local ? 'local tsconfig' : 'custom or minimal tsconfig',
    });
  }

  // 6. Prettier config present — Biome replaces Prettier (treat as pass)
  const pkgPath = join(projectPath, 'package.json');
  if (usesBiome(projectPath)) {
    checks.push({ id: 'prettier', label: 'prettier-config', status: 'pass', detail: 'Biome (handles formatting)' });
  } else if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
      const hasPrettierFile =
        existsSync(join(projectPath, '.prettierrc.json')) || existsSync(join(projectPath, '.prettierrc'));
      checks.push({
        id: 'prettier',
        label: 'prettier-config',
        status: hasPrettierFile || typeof pkg['prettier'] === 'object' ? 'pass' : 'warn',
        detail: hasPrettierFile ? '.prettierrc present' : 'no local prettier config file',
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
