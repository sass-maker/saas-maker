# Shared Tooling Plan — 22 Personal JS/TS Projects

## Context

23 personal JS/TS projects (22 active + saas-maker itself) on `~/Desktop`. Audit revealed:

- **Version drift**: React has 11 distinct pinned versions across projects, TypeScript has 15, ESLint 10
- **Package manager inconsistency**: was npm/yarn/bun/pnpm mix → now standardised to pnpm
- **Zero shared config**: each project copies eslint.config.js, tsconfig.json, .prettierrc independently
- **No automated dep hygiene**: no Renovate, no dep scanner, manual upgrades only
- **Husky hooks vary per project**: some lint, some don't, secret scanning not universal
- **No code quality gate**: fallow/knip run ad-hoc, not on every push

Goal: one change to fix/update across all 22 projects.

---

## Architecture

```
global (one-time install)
  └── fallow CLI             ← cargo install fallow-cli

saas-maker/packages/
  ├── eslint-config/         ← @saas-maker/eslint-config
  ├── tsconfig/              ← @saas-maker/tsconfig
  ├── prettier-config/       ← @saas-maker/prettier-config
  └── dev-config/            ← @saas-maker/dev-config (husky hooks via postinstall)

sarthakagrawal927/renovate-config  ← shared Renovate preset repo

~/Desktop/fallow.config.json       ← root fallow config covering all projects
```

Each project's per-project footprint after migration:
```
devDependencies:
  @saas-maker/dev-config: "workspace:*"   ← installs hooks via postinstall

eslint.config.js              ← 2 lines: import + export default
tsconfig.json                 ← 1 line: extends @saas-maker/tsconfig/next.json
.prettierrc                   ← 1 line: "@saas-maker/prettier-config"
renovate.json                 ← 2 lines: extends sarthakagrawal927/renovate-config
```

---

## Component 1: `@saas-maker/eslint-config`

**Location**: `saas-maker/packages/eslint-config/`

**Purpose**: Single source of truth for ESLint rules across all projects.

### Package structure
```
packages/eslint-config/
  package.json
  index.js          ← base config (React + TS + hooks)
  next.js           ← extends index, adds next-specific rules
  vite.js           ← extends index, adds vite-specific rules
  astro.js          ← extends index, adds astro rules
```

### `package.json`
```json
{
  "name": "@saas-maker/eslint-config",
  "version": "1.0.0",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./next": "./next.js",
    "./vite": "./vite.js",
    "./astro": "./astro.js"
  },
  "peerDependencies": {
    "eslint": ">=9.0.0"
  },
  "dependencies": {
    "@eslint/js": "latest",
    "eslint-plugin-react-hooks": "latest",
    "eslint-plugin-react-refresh": "latest",
    "typescript-eslint": "latest",
    "globals": "latest"
  }
}
```

### `index.js` (base)
```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".next", "build", ".wrangler"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "warn",   // common sync pattern
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
```

### `next.js`
```js
import base from "./index.js";
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat();
export default [...base, ...compat.extends("next/core-web-vitals")];
```

### Per-project usage (2 lines)
```js
// eslint.config.js
import config from "@saas-maker/eslint-config/next";  // or /vite or /astro
export default config;
```

### Projects using next config
`agentMode` `anime_list` `email-manager` `linkchat` `looptv` `mentionpilot` `open-historia` `personalsite` `reader` `resume-tailor` `saas-maker` `significanthobbies` `starboard` `truehire`

### Projects using vite config
`backpropagate` `chess` `CodeVetter` `ludo-pass-play` `swe-interview-prep` `today-little-log`

### Projects using astro config
`free-ai`

### Special cases
- `reel-maker`: uses `@remotion/eslint-config-flat` — keep as-is, do not migrate
- `assistant`: no eslint currently — add base config

---

## Component 2: `@saas-maker/tsconfig`

**Location**: `saas-maker/packages/tsconfig/`

**Purpose**: Base TypeScript configs extended per framework. Fixes the 15-version tsconfig drift.

### Package structure
```
packages/tsconfig/
  package.json
  base.json          ← strict base, ignoreDeprecations: "6.0"
  next.json          ← extends base, adds Next.js paths
  vite.json          ← extends base, adds Vite paths
  node.json          ← extends base, for CF Workers / Node scripts
```

### `base.json`
```json
{
  "$schema": "https://json-schema.org/draft-07/schema",
  "compilerOptions": {
    "ignoreDeprecations": "6.0",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  }
}
```

### `next.json`
```json
{
  "extends": "@saas-maker/tsconfig/base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `vite.json`
```json
{
  "extends": "@saas-maker/tsconfig/base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Per-project usage (1 line)
```json
// tsconfig.json
{ "extends": "@saas-maker/tsconfig/next.json" }
```

---

## Component 3: `@saas-maker/prettier-config`

**Location**: `saas-maker/packages/prettier-config/`

**Purpose**: Shared Prettier rules. Currently every project has its own or uses defaults.

### `index.json`
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### `package.json`
```json
{
  "name": "@saas-maker/prettier-config",
  "version": "1.0.0",
  "main": "index.json",
  "peerDependencies": {
    "prettier": ">=3.0.0",
    "prettier-plugin-tailwindcss": ">=0.6.0"
  }
}
```

### Per-project usage (add to package.json)
```json
{ "prettier": "@saas-maker/prettier-config" }
```

---

## Component 4: `@saas-maker/dev-config`

**Location**: `saas-maker/packages/dev-config/`

**Purpose**: Installs husky hooks via `postinstall`. Installing this package = hooks are configured automatically. One package update = all project hooks update on next `pnpm install`.

### Package structure
```
packages/dev-config/
  package.json
  postinstall.js     ← sets up husky + copies hook scripts
  hooks/
    pre-push         ← lint + secret scan
    pre-commit       ← fallow audit on changed files (optional)
```

### `postinstall.js`
```js
#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';

const root = process.env.INIT_CWD ?? process.cwd();
const huskyDir = join(root, '.husky');

// Install husky
execSync('pnpm exec husky install', { cwd: root, stdio: 'inherit' });
mkdirSync(huskyDir, { recursive: true });

const prePush = `#!/bin/sh
set -e

# Lint
if [ -f package.json ] && grep -q '"lint"' package.json; then
  pnpm run lint || { echo "lint failed — fix before pushing" >&2; exit 1; }
fi

# Secret scan
SECRETS=$(git ls-files -z 2>/dev/null \\
  | xargs -0 grep -lE \\
    'sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|AIzaSy[A-Za-z0-9_-]{33}|xoxb-[A-Za-z0-9-]+|-----BEGIN (RSA |EC )?PRIVATE KEY-----' 2>/dev/null \\
  | grep -vE '(\\.example$|\\.sample$|/tests?/|/__tests__/|/fixtures?/|/mocks?/|/vendor/)' \\
  || true)

if [ -n "$SECRETS" ]; then
  echo "Possible secret(s) in tracked files:" >&2
  printf '  %s\\n' $SECRETS >&2
  exit 1
fi
`;

writeFileSync(join(huskyDir, 'pre-push'), prePush);
chmodSync(join(huskyDir, 'pre-push'), '755');
console.log('✓ husky hooks configured');
```

### Per-project usage
```bash
pnpm add -D @saas-maker/dev-config
# postinstall runs automatically — hooks are set up
```

---

## Component 5: Fallow (global)

**Installation**: one-time, not per-project.
```bash
cargo install fallow-cli
# or
npm install -g fallow
```

### Root config: `~/Desktop/fallow.config.json`
```json
{
  "projects": [
    { "root": "./agentMode", "entry": ["web/src/app"] },
    { "root": "./anime_list", "entry": ["src/app"] },
    { "root": "./backpropagate", "entry": ["src/main.tsx"] },
    { "root": "./chess", "entry": ["src/main.tsx"] },
    { "root": "./CodeVetter", "entry": ["apps/desktop/src/main.tsx"] },
    { "root": "./email-manager", "entry": ["src/app"] },
    { "root": "./free-ai", "entry": ["src/pages"] },
    { "root": "./linkchat", "entry": ["src/app"] },
    { "root": "./looptv", "entry": ["src/app"] },
    { "root": "./ludo-pass-play", "entry": ["src/main.tsx"] },
    { "root": "./mentionpilot", "entry": ["apps/web/src/app"] },
    { "root": "./open-historia", "entry": ["src/app"] },
    { "root": "./personalsite", "entry": ["pages"] },
    { "root": "./reader", "entry": ["src/app"] },
    { "root": "./reel-maker", "entry": ["src/index.ts"] },
    { "root": "./resume-tailor", "entry": ["src/app"] },
    { "root": "./saas-maker", "entry": ["apps/dashboard/src/app"] },
    { "root": "./significanthobbies", "entry": ["src/app"] },
    { "root": "./starboard", "entry": ["src/app"] },
    { "root": "./swe-interview-prep", "entry": ["src/main.tsx"] },
    { "root": "./today-little-log", "entry": ["src/main.tsx"] },
    { "root": "./truehire", "entry": ["apps/web/src/app"] }
  ],
  "dead-code": {
    "ignore-patterns": ["**/*.stories.*", "**/*.test.*", "**/mocks/**"]
  },
  "health": {
    "threshold-cyclomatic": 15,
    "threshold-cognitive": 20,
    "min-score": 70
  },
  "dupes": {
    "mode": "mild",
    "min-tokens": 50,
    "skip-local": false
  }
}
```

### Usage
```bash
# From ~/Desktop — scan all projects
fallow --summary

# Scan one project
fallow --root ~/Desktop/linkchat dead-code

# Pre-PR audit on changed files only
fallow audit --changed-since main --format json

# Health gate (for CI)
fallow health --min-score 70
```

### MCP server setup (Claude Code)
Add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "fallow": {
      "command": "fallow",
      "args": ["mcp"],
      "cwd": "/Users/sarthakagrawal/Desktop"
    }
  }
}
```

---

## Component 6: Renovate preset

**Repo**: create `sarthakagrawal927/renovate-config` (public, tiny)

### `default.json`
```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"],
  "schedule": ["every weekend"],
  "timezone": "Asia/Kolkata",
  "automerge": true,
  "automergeType": "pr",
  "packageRules": [
    {
      "matchUpdateTypes": ["patch", "minor"],
      "matchPackagePatterns": ["*"],
      "automerge": true,
      "groupName": "all non-major deps"
    },
    {
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "groupName": "major updates"
    },
    {
      "matchPackagePatterns": ["^@saas-maker/"],
      "groupName": "saas-maker packages",
      "automerge": true,
      "schedule": ["at any time"]
    },
    {
      "matchPackageNames": ["react", "react-dom", "next", "typescript", "tailwindcss"],
      "automerge": false,
      "groupName": "core framework"
    }
  ]
}
```

### Per-project usage (2 lines)
```json
// renovate.json
{
  "extends": ["github>sarthakagrawal927/renovate-config"]
}
```

---

## Rollout Plan

### Phase 1: Build packages in saas-maker (1–2 days)
1. Create `packages/eslint-config` with base/next/vite/astro variants
2. Create `packages/tsconfig` with base/next/vite/node variants
3. Create `packages/prettier-config`
4. Create `packages/dev-config` with postinstall hook script
5. Publish all 4 to npm (or keep as private workspace packages if all projects stay local)
6. Create `sarthakagrawal927/renovate-config` repo

### Phase 2: Install fallow globally (30 min)
```bash
cargo install fallow-cli
# create ~/Desktop/fallow.config.json (see above)
# add MCP server to ~/.claude/settings.json
```

### Phase 3: Migrate projects (per-project, 10 min each)
For each of the 22 projects:
```bash
pnpm add -D @saas-maker/dev-config @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config

# eslint.config.js → 2 lines
# tsconfig.json → 1 line extends
# package.json → add prettier field + renovate.json
# delete old .eslintrc, .prettierrc if any
```

### Phase 4: Set up Renovate (1 hour)
- Install Renovate GitHub App
- Add `renovate.json` to each project pointing at shared preset
- First run upgrades all deps → review → merge

### Priority order for migration
Start with active + clean projects first:
1. `linkchat`, `starboard`, `looptv`, `ludo-pass-play` — simple Next/Vite, no monorepo complexity
2. `significanthobbies`, `email-manager`, `open-historia`, `personalsite` — straightforward Next
3. `mentionpilot`, `truehire`, `reader` — monorepos, slightly more involved
4. `saas-maker` — last, it's the source of the packages

---

## Future Package: `@foundry/email`

**Location**: `saas-maker/packages/email/` (future)

**Purpose**: Standardised transactional email across all projects. Currently each project either has no email or wires Resend/SendGrid independently with duplicated templates and config.

### What it solves
- `resume-tailor` — sends job application emails (no shared template)
- `significanthobbies` — digest/notification emails
- `mentionpilot` — mention alert emails
- `truehire` — candidate notification emails
- `saas-maker` — team/account emails

All currently handle email differently or not at all.

### Planned API
```ts
import { email } from '@foundry/email';

// Simple transactional
await email.send({
  to: 'user@example.com',
  subject: 'Welcome',
  template: 'welcome',        // resolves to packages/email/templates/welcome.tsx
  data: { name: 'Sarthak' },
});

// With foundry tracing (auto-wired when @foundry/ops is present)
await email.send({ ... });   // auto-traced: foundry:email:send
```

### Package structure (planned)
```
packages/email/
  package.json
  src/
    index.ts          ← email.send(), email.batch(), email.preview()
    providers/
      resend.ts       ← primary (Resend API)
      smtp.ts         ← fallback (nodemailer for self-hosted)
    templates/
      welcome.tsx     ← React Email components
      digest.tsx
      alert.tsx
    render.ts         ← React Email → HTML/text
```

### Provider config (per project .env)
```
FOUNDRY_EMAIL_PROVIDER=resend       # or smtp
RESEND_API_KEY=re_...
FOUNDRY_EMAIL_FROM=noreply@yourdomain.com
```

### Integration with @foundry/ops
When `@foundry/ops` is installed, every `email.send()` call is auto-traced:
- timing
- delivery status
- bounce/error rate visible in Cockpit

### Per-project usage (zero config beyond env vars)
```ts
import { email } from '@foundry/email';
// That's it — provider, from-address, and tracing are auto-configured
```

### Priority
Build after `@foundry/ops` — needs the trace wrapper for observability.

---

## What NOT to do

- **Don't create a root monorepo** at `~/Desktop/` — 22 separate git repos is fine, shared packages are the right layer
- **Don't add fallow to each project's devDeps** — global install is the point
- **Don't merge tsconfig `ignoreDeprecations`** into each project manually — it's in the shared base
- **Don't add Renovate to archived projects** — skip anything in `_archived/`

---

## Known issues to fix per-project during migration

| Project | Issue |
|---|---|
| `agentMode` | On Next 14 — upgrade to 16 during migration |
| `personalsite` | On Next 13 — major upgrade needed, MDX config will change |
| `CodeVetter` | Missing `packages/` workspace — fix or remove local dep references |
| `anime_list` | `.wrangler/tmp/` tracked in git — add to `.gitignore` and untrack |
| `free-ai` | Bearer auth not enforced, `model=auto` not vision-aware |
| `assistant` | Frontend and backend are unintegrated |
| `linkchat` | In-memory rate limiter resets on deploy |
| Multiple | ESLint 10 compat — fixed by migrating to shared config on ESLint 9 |
