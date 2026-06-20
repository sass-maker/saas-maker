import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './ui.js';

export interface RemoteStandards {
  eslint_rules?: Record<string, unknown>;
  tsconfig_options?: Record<string, unknown>;
  prettier_options?: Record<string, unknown>;
}

export function detectProjectType(cwd: string = process.cwd()): 'next' | 'vite' | 'node' {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return 'node';

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.next) return 'next';
  if (deps.vite) return 'vite';
  return 'node';
}

const PRETTIER_DEFAULT = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  plugins: ['prettier-plugin-tailwindcss'],
};

export const TSCONFIG_BASE = {
  compilerOptions: {
    ignoreDeprecations: '6.0',
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    noImplicitOverride: true,
    noPropertyAccessFromIndexSignature: true,
    forceConsistentCasingInFileNames: true,
    esModuleInterop: true,
    isolatedModules: true,
  },
};

export function buildLocalTsConfig(
  type: 'next' | 'vite' | 'node',
  remote?: RemoteStandards,
): Record<string, unknown> {
  return {
    ...TSCONFIG_BASE,
    compilerOptions: {
      ...TSCONFIG_BASE.compilerOptions,
      ...(type === 'next'
        ? { jsx: 'preserve', plugins: [{ name: 'next' }], paths: { '@/*': ['./src/*'] } }
        : type === 'vite'
          ? { jsx: 'react-jsx', paths: { '@/*': ['./src/*'] } }
          : { lib: ['ES2022'], module: 'NodeNext', moduleResolution: 'NodeNext' }),
      ...(remote?.tsconfig_options ?? {}),
    },
    include:
      type === 'next'
        ? ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts']
        : type === 'vite'
          ? ['src']
          : ['src/**/*'],
    exclude: ['node_modules'],
  };
}

export function applyStandard(
  type: 'next' | 'vite' | 'node',
  cwd: string = process.cwd(),
  remote?: RemoteStandards,
): void {
  const templatesDir = join(import.meta.dirname, '..', 'templates', type);
  const eslintTemplate = readFileSync(join(templatesDir, 'eslint.config.js'), 'utf-8');
  const eslintRules = remote?.eslint_rules;
  const eslintConfig =
    eslintRules && Object.keys(eslintRules).length > 0
      ? `${eslintTemplate.replace('export default', 'const base =').trim()}\n\nexport default [\n  ...(Array.isArray(base) ? base : [base]),\n  { rules: ${JSON.stringify(eslintRules, null, 2)} },\n];\n`
      : eslintTemplate;
  writeFileSync(join(cwd, 'eslint.config.js'), eslintConfig);
  log.success('✓ Applied local ESLint config');

  writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify(buildLocalTsConfig(type, remote), null, 2) + '\n');
  log.success('✓ Applied local tsconfig.json');

  const prettierOptions =
    remote?.prettier_options && Object.keys(remote.prettier_options).length > 0
      ? remote.prettier_options
      : PRETTIER_DEFAULT;
  writeFileSync(join(cwd, '.prettierrc.json'), JSON.stringify(prettierOptions, null, 2) + '\n');

  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    delete pkg.prettier;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
  log.success('✓ Wrote .prettierrc.json');
}

export function scaffoldRenovate(cwd: string = process.cwd()): void {
  const file = join(cwd, 'renovate.json');
  if (existsSync(file)) return;

  const config = {
    extends: ['github>sarthakagrawal927/foundry-renovate-config'],
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
    uses: sarthak-fleet/saas-maker/.github/workflows/foundry-ci.yml@v1
`;
  writeFileSync(join(ciDir, 'ci.yml'), ciConfig);
  log.success('✓ Linked to Global Foundry CI (v1)');
}

const PRE_PUSH_TEMPLATE = `#!/bin/sh
set -e

# Lint (fast — Biome or ESLint, whatever is configured)
if grep -q '"lint"' package.json 2>/dev/null; then
  pnpm run lint --if-present || { echo "lint failed — fix before pushing" >&2; exit 1; }
fi

# Secret scan — abort if tokens/keys found in tracked files
SECRETS=$(git ls-files -z 2>/dev/null \\
  | xargs -0 grep -lE \\
    'sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|AIzaSy[A-Za-z0-9_-]{33}|xoxb-[A-Za-z0-9-]+|-----BEGIN (RSA |EC )?PRIVATE KEY-----' 2>/dev/null \\
  | grep -vE '(\\.example$|\\.sample$|/tests?/|/__tests__/|/fixtures?/|/mocks?/|/vendor/)' \\
  || true)
if [ -n "$SECRETS" ]; then
  echo "Possible secret(s) in tracked files — push aborted:" >&2
  printf '  %s\\n' $SECRETS >&2
  exit 1
fi
`;

export function scaffoldHusky(cwd: string = process.cwd()): void {
  const huskyDir = join(cwd, '.husky');
  if (!existsSync(huskyDir)) mkdirSync(huskyDir, { recursive: true });
  const prePush = join(huskyDir, 'pre-push');
  writeFileSync(prePush, PRE_PUSH_TEMPLATE);
  try { chmodSync(prePush, 0o755); } catch { /* fs may be read-only on some runners */ }
  log.success('✓ Wrote .husky/pre-push (lint + secret scan)');
}
