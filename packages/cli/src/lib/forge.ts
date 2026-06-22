import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './ui.js';

export interface RemoteStandards {
  eslint_rules?: Record<string, unknown>;
  tsconfig_options?: Record<string, unknown>;
  prettier_options?: Record<string, unknown>;
}

export interface ApplyStandardOptions {
  force?: boolean;
}

/** Returns true if the project at `cwd` uses Biome (biome.json or biome.jsonc present). */
export function usesBiome(cwd: string = process.cwd()): boolean {
  return existsSync(join(cwd, 'biome.json')) || existsSync(join(cwd, 'biome.jsonc'));
}

export function detectProjectType(cwd: string = process.cwd()): 'next' | 'vite' | 'node' {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return 'node';

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.next) return 'next';
  // Astro uses Vite under the hood — treat as 'vite' so it gets the correct
  // ESLint/Prettier config (with tailwind plugin) rather than the plain node one.
  if (deps.astro || deps.vite) return 'vite';
  return 'node';
}

const PRETTIER_BASE = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
};

/** Returns prettier config for the given project type. Node projects do not get
 *  prettier-plugin-tailwindcss because they have no Tailwind setup. */
function getPrettierDefault(type: 'next' | 'vite' | 'node'): Record<string, unknown> {
  if (type === 'node') return { ...PRETTIER_BASE };
  return { ...PRETTIER_BASE, plugins: ['prettier-plugin-tailwindcss'] };
}

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
  opts: ApplyStandardOptions = {},
): void {
  // Guard: no package.json → skip entirely (Go/Rust/non-JS root)
  if (!existsSync(join(cwd, 'package.json'))) {
    log.info('No package.json found — skipping JS tooling scaffold');
    return;
  }

  // Guard: Biome projects skip ESLint and Prettier (Biome handles both)
  if (usesBiome(cwd)) {
    log.info('Biome detected — skipping ESLint and Prettier scaffold');
    // Still write tsconfig — Biome does not typecheck
    const tsPath = join(cwd, 'tsconfig.json');
    if (!existsSync(tsPath) || opts.force) {
      writeFileSync(tsPath, JSON.stringify(buildLocalTsConfig(type, remote), null, 2) + '\n');
      log.success('✓ Applied local tsconfig.json');
    } else {
      log.info('  kept existing tsconfig.json');
    }
    return;
  }

  // ESLint — skip if exists unless --force
  const eslintPath = join(cwd, 'eslint.config.js');
  if (!existsSync(eslintPath) || opts.force) {
    const templatesDir = join(import.meta.dirname, '..', 'templates', type);
    const eslintTemplate = readFileSync(join(templatesDir, 'eslint.config.js'), 'utf-8');
    const eslintRules = remote?.eslint_rules;
    const eslintConfig =
      eslintRules && Object.keys(eslintRules).length > 0
        ? `${eslintTemplate.replace('export default', 'const base =').trim()}\n\nexport default [\n  ...(Array.isArray(base) ? base : [base]),\n  { rules: ${JSON.stringify(eslintRules, null, 2)} },\n];\n`
        : eslintTemplate;
    writeFileSync(eslintPath, eslintConfig);
    log.success('✓ Applied local ESLint config');
  } else {
    log.info('  kept existing eslint.config.js');
  }

  // tsconfig — skip if exists unless --force
  const tsPath = join(cwd, 'tsconfig.json');
  if (!existsSync(tsPath) || opts.force) {
    writeFileSync(tsPath, JSON.stringify(buildLocalTsConfig(type, remote), null, 2) + '\n');
    log.success('✓ Applied local tsconfig.json');
  } else {
    log.info('  kept existing tsconfig.json');
  }

  // Prettier — skip if exists unless --force
  const prettierPath = join(cwd, '.prettierrc.json');
  if (!existsSync(prettierPath) || opts.force) {
    const prettierOptions =
      remote?.prettier_options && Object.keys(remote.prettier_options).length > 0
        ? remote.prettier_options
        : getPrettierDefault(type);
    writeFileSync(prettierPath, JSON.stringify(prettierOptions, null, 2) + '\n');

    const pkgPath = join(cwd, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    delete pkg.prettier;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

    log.success('✓ Wrote .prettierrc.json');
  } else {
    log.info('  kept existing .prettierrc.json');
  }
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

export function scaffoldCI(cwd: string = process.cwd(), opts: ApplyStandardOptions = {}): void {
  const ciDir = join(cwd, '.github', 'workflows');
  if (!existsSync(ciDir)) mkdirSync(ciDir, { recursive: true });

  const ciPath = join(ciDir, 'ci.yml');
  if (existsSync(ciPath) && !opts.force) {
    log.info('  kept existing .github/workflows/ci.yml');
    return;
  }

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
  writeFileSync(ciPath, ciConfig);
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

export function scaffoldHusky(cwd: string = process.cwd(), opts: ApplyStandardOptions = {}): void {
  const huskyDir = join(cwd, '.husky');
  if (!existsSync(huskyDir)) mkdirSync(huskyDir, { recursive: true });
  const prePush = join(huskyDir, 'pre-push');
  if (existsSync(prePush) && !opts.force) {
    log.info('  kept existing .husky/pre-push');
    return;
  }
  writeFileSync(prePush, PRE_PUSH_TEMPLATE);
  try { chmodSync(prePush, 0o755); } catch { /* fs may be read-only on some runners */ }
  log.success('✓ Wrote .husky/pre-push (lint + secret scan)');
}
