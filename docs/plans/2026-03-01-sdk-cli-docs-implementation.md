# SDK, CLI & Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add waitlist SDK widget, project management CLI, and README documentation for all packages.

**Architecture:** Three independent packages following existing monorepo patterns. Waitlist widget mirrors feedback-widget structure (React + tsup + scoped CSS). CLI is a standalone Node.js tool using commander. READMEs per package.

**Tech Stack:** React 19, tsup, commander, chalk, ora, TypeScript

---

### Task 1: Add WaitlistFormProps to shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add the WaitlistFormProps interface**

Append after the existing `FeedbackWidgetProps` interface at the end of the file:

```typescript
export interface WaitlistFormProps {
  projectId: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  accentColor?: string;
  showCount?: boolean;
  onSuccess?: (position: number) => void;
  placeholder?: string;
  buttonText?: string;
}
```

**Step 2: Build shared-types**

Run: `pnpm -F @saasmaker/shared-types build`
Expected: Clean build, no errors.

**Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat: add WaitlistFormProps to shared-types"
```

---

### Task 2: Scaffold waitlist-widget package

**Files:**
- Create: `packages/waitlist-widget/package.json`
- Create: `packages/waitlist-widget/tsconfig.json`
- Create: `packages/waitlist-widget/src/index.ts`

**Step 1: Create package.json**

Copy the pattern from `packages/feedback-widget/package.json` exactly, changing the name:

```json
{
  "name": "@saasmaker/waitlist",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts --external react --external react-dom"
  },
  "dependencies": {
    "@saasmaker/shared-types": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tsup": "^8.0.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

**Step 3: Create src/index.ts stub**

```typescript
export { WaitlistForm } from './WaitlistForm';
export type { WaitlistFormProps } from '@saasmaker/shared-types';
```

**Step 4: Install deps**

Run: `pnpm install` (from repo root)

**Step 5: Commit**

```bash
git add packages/waitlist-widget/
git commit -m "feat: scaffold waitlist-widget package"
```

---

### Task 3: Waitlist widget API client

**Files:**
- Create: `packages/waitlist-widget/src/api.ts`

**Step 1: Create the API client**

Follow the exact pattern from `packages/feedback-widget/src/api.ts`:

```typescript
const DEFAULT_API_BASE = 'https://api.saasmaker.dev';

export function createApiClient(projectId: string, apiBaseUrl?: string) {
  const base = (apiBaseUrl || DEFAULT_API_BASE).replace(/\/$/, '');

  return {
    async signup(email: string, name?: string): Promise<{ id: string; position: number }> {
      const res = await fetch(`${base}/v1/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Project-Key': projectId,
        },
        body: JSON.stringify({ email, name: name || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Signup failed');
      }
      return res.json();
    },

    async getCount(): Promise<number> {
      const res = await fetch(`${base}/v1/waitlist/count`, {
        headers: { 'X-Project-Key': projectId },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count ?? 0;
    },
  };
}

export type WaitlistApiClient = ReturnType<typeof createApiClient>;
```

**Step 2: Commit**

```bash
git add packages/waitlist-widget/src/api.ts
git commit -m "feat: add waitlist widget API client"
```

---

### Task 4: Waitlist widget CSS

**Files:**
- Create: `packages/waitlist-widget/src/styles/waitlist.css`

**Step 1: Create the stylesheet**

Scoped under `[data-saasmaker-waitlist]`. Follow the feedback widget's CSS variable pattern:

```css
/* SaaS-Maker Waitlist Widget Styles */

[data-saasmaker-waitlist].smw-wl--light {
  --smw-wl-bg: #ffffff;
  --smw-wl-text: #1a1a2e;
  --smw-wl-text-secondary: #6b7280;
  --smw-wl-border: #e5e7eb;
  --smw-wl-input-bg: #ffffff;
  --smw-wl-input-border: #d1d5db;
  --smw-wl-success: #10b981;
}

[data-saasmaker-waitlist].smw-wl--dark {
  --smw-wl-bg: #1e1e2e;
  --smw-wl-text: #e4e4ef;
  --smw-wl-text-secondary: #a0a0b8;
  --smw-wl-border: #363649;
  --smw-wl-input-bg: #262637;
  --smw-wl-input-border: #404055;
  --smw-wl-success: #34d399;
}

[data-saasmaker-waitlist].smw-wl--auto {
  --smw-wl-bg: #ffffff;
  --smw-wl-text: #1a1a2e;
  --smw-wl-text-secondary: #6b7280;
  --smw-wl-border: #e5e7eb;
  --smw-wl-input-bg: #ffffff;
  --smw-wl-input-border: #d1d5db;
  --smw-wl-success: #10b981;
}

@media (prefers-color-scheme: dark) {
  [data-saasmaker-waitlist].smw-wl--auto {
    --smw-wl-bg: #1e1e2e;
    --smw-wl-text: #e4e4ef;
    --smw-wl-text-secondary: #a0a0b8;
    --smw-wl-border: #363649;
    --smw-wl-input-bg: #262637;
    --smw-wl-input-border: #404055;
    --smw-wl-success: #34d399;
  }
}

[data-saasmaker-waitlist] {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--smw-wl-text);
}

.smw-wl-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.smw-wl-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--smw-wl-input-border);
  border-radius: 8px;
  background: var(--smw-wl-input-bg);
  color: var(--smw-wl-text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.smw-wl-input:focus {
  border-color: var(--smw-wl-accent, #1464ff);
}

.smw-wl-input::placeholder {
  color: var(--smw-wl-text-secondary);
}

.smw-wl-button {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--smw-wl-accent, #1464ff);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.smw-wl-button:hover {
  opacity: 0.9;
}

.smw-wl-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.smw-wl-error {
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}

.smw-wl-count {
  text-align: center;
  font-size: 12px;
  color: var(--smw-wl-text-secondary);
  margin-top: 4px;
}

.smw-wl-success {
  text-align: center;
  padding: 16px 0;
}

.smw-wl-success-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.smw-wl-success-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px;
}

.smw-wl-success-position {
  font-size: 14px;
  color: var(--smw-wl-text-secondary);
  margin: 0;
}
```

**Step 2: Commit**

```bash
git add packages/waitlist-widget/src/styles/
git commit -m "feat: add waitlist widget CSS styles"
```

---

### Task 5: WaitlistForm React component

**Files:**
- Create: `packages/waitlist-widget/src/WaitlistForm.tsx`

**Step 1: Build the component**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { WaitlistFormProps } from '@saasmaker/shared-types';
import { createApiClient } from './api';
import './styles/waitlist.css';

const DEFAULT_ACCENT = '#1464ff';

export const WaitlistForm: React.FC<WaitlistFormProps> = ({
  projectId,
  apiBaseUrl,
  theme = 'auto',
  accentColor = DEFAULT_ACCENT,
  showCount = true,
  onSuccess,
  placeholder = 'you@example.com',
  buttonText = 'Join Waitlist',
}) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);

  const api = useMemo(
    () => createApiClient(projectId, apiBaseUrl),
    [projectId, apiBaseUrl],
  );

  const themeClass =
    theme === 'light'
      ? 'smw-wl--light'
      : theme === 'dark'
        ? 'smw-wl--dark'
        : 'smw-wl--auto';

  useEffect(() => {
    if (showCount) {
      api.getCount().then(setCount).catch(() => {});
    }
  }, [api, showCount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await api.signup(email.trim(), name.trim() || undefined);
      setPosition(result.position);
      setCount((prev) => (prev !== null ? prev + 1 : null));
      onSuccess?.(result.position);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (position !== null) {
    return (
      <div
        data-saasmaker-waitlist=""
        className={themeClass}
        style={{ '--smw-wl-accent': accentColor } as React.CSSProperties}
      >
        <div className="smw-wl-success">
          <div className="smw-wl-success-icon">&#10003;</div>
          <p className="smw-wl-success-title">You're on the list!</p>
          <p className="smw-wl-success-position">You're #{position} on the waitlist.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-saasmaker-waitlist=""
      className={themeClass}
      style={{ '--smw-wl-accent': accentColor } as React.CSSProperties}
    >
      <form className="smw-wl-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="smw-wl-input"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={submitting}
        />
        <input
          type="text"
          className="smw-wl-input"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
        {error && <p className="smw-wl-error">{error}</p>}
        <button type="submit" className="smw-wl-button" disabled={submitting}>
          {submitting ? 'Joining...' : buttonText}
        </button>
      </form>
      {showCount && count !== null && count > 0 && (
        <p className="smw-wl-count">{count.toLocaleString()} already signed up</p>
      )}
    </div>
  );
};
```

**Step 2: Build the package**

Run: `pnpm -F @saasmaker/waitlist build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add packages/waitlist-widget/src/
git commit -m "feat: add WaitlistForm React component"
```

---

### Task 6: Scaffold CLI package

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@saasmaker/cli",
  "version": "0.1.0",
  "private": true,
  "bin": {
    "saasmaker": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --banner.js '#!/usr/bin/env node'",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "chalk": "^5.4.1",
    "commander": "^13.1.0",
    "ora": "^8.2.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create stub src/index.ts**

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('saasmaker')
  .description('SaaS Maker CLI — manage your projects')
  .version('0.1.0');

program.parse();
```

**Step 4: Install deps**

Run: `pnpm install` (from repo root)

**Step 5: Verify stub runs**

Run: `pnpm -F @saasmaker/cli dev -- --help`
Expected: Shows help text with "SaaS Maker CLI".

**Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat: scaffold CLI package with commander"
```

---

### Task 7: CLI config helpers

**Files:**
- Create: `packages/cli/src/lib/config.ts`
- Create: `packages/cli/src/lib/api.ts`
- Create: `packages/cli/src/lib/ui.ts`

**Step 1: Create config.ts**

Reads/writes `~/.saasmaker/config.json` and `.saasmaker.json`:

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const GLOBAL_DIR = join(homedir(), '.saasmaker');
const GLOBAL_CONFIG = join(GLOBAL_DIR, 'config.json');
const LOCAL_CONFIG = '.saasmaker.json';

interface GlobalConfig {
  apiKey?: string;
  apiBaseUrl?: string;
}

interface LocalConfig {
  projectId: string;
  slug: string;
}

export function getGlobalConfig(): GlobalConfig {
  try {
    return JSON.parse(readFileSync(GLOBAL_CONFIG, 'utf-8'));
  } catch {
    return {};
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  mkdirSync(GLOBAL_DIR, { recursive: true });
  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

export function getLocalConfig(): LocalConfig | null {
  try {
    return JSON.parse(readFileSync(LOCAL_CONFIG, 'utf-8'));
  } catch {
    return null;
  }
}

export function saveLocalConfig(config: LocalConfig): void {
  writeFileSync(LOCAL_CONFIG, JSON.stringify(config, null, 2) + '\n');
}

export function getApiKey(): string | null {
  return getGlobalConfig().apiKey ?? null;
}

export function getApiBase(): string {
  return getGlobalConfig().apiBaseUrl ?? process.env.SAASMAKER_API_URL ?? 'https://api.saasmaker.dev';
}

export function hasLocalConfig(): boolean {
  return existsSync(LOCAL_CONFIG);
}
```

**Step 2: Create api.ts**

```typescript
import { getApiKey, getApiBase } from './config.js';

export async function apiFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Not logged in. Run `saasmaker login` first.');

  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Project-Key': apiKey,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}
```

**Step 3: Create ui.ts**

```typescript
import chalk from 'chalk';

export const log = {
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  dim: (msg: string) => console.log(chalk.dim(msg)),
};

export function table(rows: string[][]): void {
  if (rows.length === 0) return;
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => (row[i] ?? '').length)),
  );
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
  }
}
```

**Step 4: Commit**

```bash
git add packages/cli/src/lib/
git commit -m "feat: add CLI config, API client, and UI helpers"
```

---

### Task 8: CLI commands — login, whoami, keys

**Files:**
- Create: `packages/cli/src/commands/login.ts`
- Create: `packages/cli/src/commands/whoami.ts`
- Create: `packages/cli/src/commands/keys.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create login.ts**

```typescript
import { createInterface } from 'readline/promises';
import { saveGlobalConfig, getGlobalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';

export async function loginCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const apiKey = await rl.question('Enter your API key (pk_...): ');
    if (!apiKey.trim()) {
      log.error('API key cannot be empty.');
      return;
    }

    const config = getGlobalConfig();
    config.apiKey = apiKey.trim();
    saveGlobalConfig(config);
    log.success('API key saved to ~/.saasmaker/config.json');
  } finally {
    rl.close();
  }
}
```

**Step 2: Create whoami.ts**

```typescript
import { getApiKey, getApiBase, getLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';

export function whoamiCommand(): void {
  const apiKey = getApiKey();
  const local = getLocalConfig();
  const base = getApiBase();

  if (!apiKey) {
    log.error('Not logged in. Run `saasmaker login` first.');
    return;
  }

  log.success('Logged in');
  log.dim(`  API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);
  log.dim(`  API Base: ${base}`);

  if (local) {
    log.dim(`  Project: ${local.slug} (${local.projectId.slice(0, 8)}...)`);
  } else {
    log.dim('  No project linked. Run `saasmaker init` in a project directory.');
  }
}
```

**Step 3: Create keys.ts**

```typescript
import { getLocalConfig, getApiKey } from '../lib/config.js';
import { log } from '../lib/ui.js';

export function keysCommand(): void {
  const local = getLocalConfig();
  const apiKey = getApiKey();

  if (!apiKey) {
    log.error('Not logged in. Run `saasmaker login` first.');
    return;
  }

  log.info(`API Key: ${apiKey}`);

  if (local) {
    log.dim(`  Project: ${local.slug}`);
  }
}
```

**Step 4: Wire commands into index.ts**

Replace `packages/cli/src/index.ts`:

```typescript
import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { whoamiCommand } from './commands/whoami.js';
import { keysCommand } from './commands/keys.js';

const program = new Command();

program
  .name('saasmaker')
  .description('SaaS Maker CLI — manage your projects')
  .version('0.1.0');

program.command('login').description('Save your API key').action(loginCommand);
program.command('whoami').description('Show current auth status').action(whoamiCommand);
program.command('keys').description('Show API key for current project').action(keysCommand);

program.parse();
```

**Step 5: Verify**

Run: `pnpm -F @saasmaker/cli dev -- whoami`
Expected: "Not logged in" error message.

**Step 6: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add login, whoami, keys CLI commands"
```

---

### Task 9: CLI commands — projects list, projects create

**Files:**
- Create: `packages/cli/src/commands/projects.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create projects.ts**

```typescript
import { createInterface } from 'readline/promises';
import ora from 'ora';
import { apiFetch } from '../lib/api.js';
import { log, table } from '../lib/ui.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  created_at: string;
}

export async function projectsListCommand(): Promise<void> {
  const spinner = ora('Loading projects...').start();

  try {
    const res = await apiFetch<{ data: Project[] }>('/v1/projects');
    spinner.stop();

    const projects = res.data ?? [];
    if (projects.length === 0) {
      log.info('No projects yet. Run `saasmaker projects create` to create one.');
      return;
    }

    table([
      ['NAME', 'SLUG', 'CREATED'],
      ...projects.map((p) => [
        p.name,
        p.slug,
        new Date(p.created_at).toLocaleDateString(),
      ]),
    ]);
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to list projects');
  }
}

export async function projectsCreateCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const name = await rl.question('Project name: ');
    if (!name.trim()) {
      log.error('Project name cannot be empty.');
      return;
    }

    const spinner = ora('Creating project...').start();

    try {
      const project = await apiFetch<Project>('/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      spinner.stop();
      log.success(`Created "${project.name}" (${project.slug})`);
      log.dim(`  API Key: ${project.api_key}`);
    } catch (err) {
      spinner.stop();
      log.error(err instanceof Error ? err.message : 'Failed to create project');
    }
  } finally {
    rl.close();
  }
}
```

**Step 2: Add to index.ts**

Add these imports and commands after the existing ones:

```typescript
import { projectsListCommand, projectsCreateCommand } from './commands/projects.js';

const projects = program.command('projects').description('Manage projects');
projects.command('list').description('List all projects').action(projectsListCommand);
projects.command('create').description('Create a new project').action(projectsCreateCommand);
```

**Step 3: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add projects list and create CLI commands"
```

---

### Task 10: CLI commands — init, status

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/commands/status.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create init.ts**

```typescript
import { createInterface } from 'readline/promises';
import ora from 'ora';
import { apiFetch } from '../lib/api.js';
import { saveLocalConfig, hasLocalConfig } from '../lib/config.js';
import { log } from '../lib/ui.js';

interface Project {
  id: string;
  name: string;
  slug: string;
  api_key: string;
}

export async function initCommand(): Promise<void> {
  if (hasLocalConfig()) {
    log.info('.saasmaker.json already exists in this directory.');
    return;
  }

  const spinner = ora('Loading projects...').start();
  let projects: Project[];

  try {
    const res = await apiFetch<{ data: Project[] }>('/v1/projects');
    projects = res.data ?? [];
    spinner.stop();
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to load projects');
    return;
  }

  if (projects.length === 0) {
    log.info('No projects found. Run `saasmaker projects create` first.');
    return;
  }

  console.log('\nAvailable projects:');
  projects.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.slug})`));

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const choice = await rl.question(`\nSelect project (1-${projects.length}): `);
    const idx = parseInt(choice, 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= projects.length) {
      log.error('Invalid selection.');
      return;
    }

    const project = projects[idx];
    saveLocalConfig({ projectId: project.api_key, slug: project.slug });
    log.success(`Linked to "${project.name}" — wrote .saasmaker.json`);
  } finally {
    rl.close();
  }
}
```

**Step 2: Create status.ts**

```typescript
import ora from 'ora';
import { getLocalConfig } from '../lib/config.js';
import { apiFetch } from '../lib/api.js';
import { log } from '../lib/ui.js';

export async function statusCommand(): Promise<void> {
  const local = getLocalConfig();
  if (!local) {
    log.error('No project linked. Run `saasmaker init` first.');
    return;
  }

  const spinner = ora(`Fetching status for ${local.slug}...`).start();

  try {
    const [feedbackRes, waitlistRes] = await Promise.allSettled([
      apiFetch<{ total: number }>(`/v1/feedback?type=all`),
      apiFetch<{ count: number }>('/v1/waitlist/count'),
    ]);

    spinner.stop();

    log.success(`Project: ${local.slug}`);

    if (feedbackRes.status === 'fulfilled') {
      log.dim(`  Feedback: ${feedbackRes.value.total ?? 0} items`);
    }

    if (waitlistRes.status === 'fulfilled') {
      log.dim(`  Waitlist: ${waitlistRes.value.count ?? 0} signups`);
    }
  } catch (err) {
    spinner.stop();
    log.error(err instanceof Error ? err.message : 'Failed to fetch status');
  }
}
```

**Step 3: Add to index.ts**

Add imports and commands:

```typescript
import { initCommand } from './commands/init.js';
import { statusCommand } from './commands/status.js';

program.command('init').description('Link a project to this directory').action(initCommand);
program.command('status').description('Show project stats').action(statusCommand);
```

**Step 4: Build CLI**

Run: `pnpm -F @saasmaker/cli build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add packages/cli/src/
git commit -m "feat: add init and status CLI commands"
```

---

### Task 11: Root README

**Files:**
- Create: `README.md`

**Step 1: Write the root README**

```markdown
# SaaS Maker

Open-source backend toolkit for SaaS products. Drop-in feedback collection, waitlists, analytics, and vector memory — all behind a single API key.

## Features

- **Feedback Widget** — Embeddable React component for bugs, feature requests, and general feedback with image uploads and voting
- **Waitlist** — Email collection with position tracking and signup counts
- **Analytics** — Privacy-friendly page view and custom event tracking (no cookies)
- **Vector Memory** — Semantic search with pluggable embedding models (Voyage AI, Gemini, Cloudflare Workers AI)
- **Public Feedback Board** — Hosted kanban board for feature requests at `/f/{slug}`

## Quick Start

### 1. Install the feedback widget

```bash
npm install @saasmaker/feedback
```

```tsx
import { FeedbackWidget } from '@saasmaker/feedback'

<FeedbackWidget projectId="pk_your_api_key" />
```

### 2. Add analytics tracking

```html
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_your_api_key"></script>
```

### 3. Add a waitlist form

```bash
npm install @saasmaker/waitlist
```

```tsx
import { WaitlistForm } from '@saasmaker/waitlist'

<WaitlistForm projectId="pk_your_api_key" />
```

### 4. Use the CLI

```bash
npx @saasmaker/cli login
npx @saasmaker/cli init
npx @saasmaker/cli status
```

## Packages

| Package | Description |
|---------|-------------|
| [`@saasmaker/feedback`](packages/feedback-widget/) | React feedback widget |
| [`@saasmaker/waitlist`](packages/waitlist-widget/) | React waitlist form |
| [`@saasmaker/analytics-sdk`](packages/analytics-sdk/) | Analytics tracking script |
| [`@saasmaker/cli`](packages/cli/) | Project management CLI |
| [`@saasmaker/shared-types`](packages/shared-types/) | Shared TypeScript types |
| [`@saasmaker/db`](packages/db/) | Database layer |

## Monorepo Structure

```
apps/dashboard/       # Next.js admin dashboard
workers/api/          # Cloudflare Workers API (Hono)
packages/
  shared-types/       # TypeScript type definitions
  db/                 # Database queries + migrations
  feedback-widget/    # React feedback component
  waitlist-widget/    # React waitlist component
  analytics-sdk/      # Analytics tracking script
  cli/                # CLI tool
```

## API Authentication

- **SDK/Widget endpoints** — `X-Project-Key` header with your project API key
- **Dashboard endpoints** — Bearer token (session auth via Auth.js)
- **Public endpoints** — No auth required (e.g., public feedback board)
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root README"
```

---

### Task 12: Package READMEs — feedback-widget

**Files:**
- Create: `packages/feedback-widget/README.md`

**Step 1: Write the README**

```markdown
# @saasmaker/feedback

Drop-in React feedback widget for collecting bugs, feature requests, and general feedback.

## Install

```bash
npm install @saasmaker/feedback
# or
pnpm add @saasmaker/feedback
```

## Quick Start

```tsx
import { FeedbackWidget } from '@saasmaker/feedback'

function App() {
  return (
    <FeedbackWidget projectId="pk_your_api_key" />
  )
}
```

This renders a floating button that opens a feedback modal.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project API key (`pk_...`) |
| `apiBaseUrl` | `string` | `https://api.saasmaker.dev` | API base URL |
| `userEmail` | `string` | — | Pre-fill submitter email |
| `userName` | `string` | — | Pre-fill submitter name |
| `types` | `FeedbackType[]` | `['bug', 'feature', 'feedback']` | Allowed feedback types |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | Trigger button position |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `#1464ff` | Primary accent color |
| `triggerText` | `string` | `'Feedback'` | Trigger button label |

## Examples

### Pre-fill user info

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  userEmail="user@example.com"
  userName="Jane Doe"
/>
```

### Dark mode with custom color

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  theme="dark"
  accentColor="#8b5cf6"
/>
```

### Feature requests only

```tsx
<FeedbackWidget
  projectId="pk_xxx"
  types={['feature']}
  triggerText="Request Feature"
/>
```
```

**Step 2: Commit**

```bash
git add packages/feedback-widget/README.md
git commit -m "docs: add feedback widget README"
```

---

### Task 13: Package READMEs — analytics-sdk

**Files:**
- Create: `packages/analytics-sdk/README.md`

**Step 1: Write the README**

```markdown
# @saasmaker/analytics-sdk

Privacy-friendly analytics tracking. No cookies, respects Do Not Track.

## Install

### Script tag (recommended)

```html
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_your_api_key"></script>
```

### npm

```bash
npm install @saasmaker/analytics-sdk
```

## Features

- Automatic page view tracking
- SPA support (patches `history.pushState` / `replaceState`)
- UTM parameter extraction
- Screen width reporting
- Custom event tracking
- Respects `Do Not Track` browser setting
- No cookies, no fingerprinting

## Custom Events

```javascript
// After the script loads, `window.sm` is available:
sm.track('signup', { plan: 'pro' })
sm.track('purchase', { amount: 29.99, currency: 'USD' })
```

### Queue pattern

Calls before the script loads are buffered automatically:

```html
<script>
  window.sm = window.sm || function() { sm.q = sm.q || []; sm.q.push(arguments); };
  sm('early_event', { source: 'header' });
</script>
<script defer src="https://unpkg.com/@saasmaker/analytics-sdk" data-project="pk_xxx"></script>
```

## Configuration

Set attributes on the script tag:

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-project` | **required** | Your project API key |
| `data-api` | `https://api.saasmaker.dev` | API base URL |

## What gets tracked

Each event sends:
- Event name (`page_view` or custom)
- Current URL
- Referrer
- Screen width
- UTM parameters (if present in URL)

The server adds country, device type, and browser from request headers.
```

**Step 2: Commit**

```bash
git add packages/analytics-sdk/README.md
git commit -m "docs: add analytics SDK README"
```

---

### Task 14: Package READMEs — waitlist-widget and CLI

**Files:**
- Create: `packages/waitlist-widget/README.md`
- Create: `packages/cli/README.md`

**Step 1: Write waitlist-widget README**

```markdown
# @saasmaker/waitlist

Drop-in React waitlist signup form with position tracking and count display.

## Install

```bash
npm install @saasmaker/waitlist
# or
pnpm add @saasmaker/waitlist
```

## Quick Start

```tsx
import { WaitlistForm } from '@saasmaker/waitlist'

function App() {
  return (
    <WaitlistForm projectId="pk_your_api_key" />
  )
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `projectId` | `string` | **required** | Your project API key (`pk_...`) |
| `apiBaseUrl` | `string` | `https://api.saasmaker.dev` | API base URL |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'auto'` | Color theme |
| `accentColor` | `string` | `#1464ff` | Primary accent color |
| `showCount` | `boolean` | `true` | Show "N already signed up" |
| `onSuccess` | `(position: number) => void` | — | Called after successful signup |
| `placeholder` | `string` | `'you@example.com'` | Email input placeholder |
| `buttonText` | `string` | `'Join Waitlist'` | Submit button text |

## Examples

### Custom styling

```tsx
<WaitlistForm
  projectId="pk_xxx"
  theme="dark"
  accentColor="#10b981"
  buttonText="Get Early Access"
/>
```

### With success callback

```tsx
<WaitlistForm
  projectId="pk_xxx"
  onSuccess={(position) => {
    console.log(`User is #${position} on the waitlist`)
  }}
/>
```

### Hide signup count

```tsx
<WaitlistForm
  projectId="pk_xxx"
  showCount={false}
/>
```
```

**Step 2: Write CLI README**

```markdown
# @saasmaker/cli

Command-line tool for managing SaaS Maker projects.

## Install

```bash
npm install -g @saasmaker/cli
# or use directly with npx
npx @saasmaker/cli
```

## Setup

```bash
# Save your API key
saasmaker login

# Link a project to the current directory
saasmaker init
```

## Commands

### `saasmaker login`

Prompts for your API key and saves it to `~/.saasmaker/config.json`.

### `saasmaker whoami`

Shows current authentication status and linked project.

### `saasmaker init`

Lists your projects and writes a `.saasmaker.json` file to the current directory, linking it to the selected project.

### `saasmaker projects list`

Lists all projects with name, slug, and creation date.

### `saasmaker projects create`

Prompts for a project name and creates a new project.

### `saasmaker status`

Shows stats for the linked project (feedback count, waitlist signups).

### `saasmaker keys`

Displays the API key for the current project.

## Configuration

### Global config (`~/.saasmaker/config.json`)

```json
{
  "apiKey": "pk_...",
  "apiBaseUrl": "https://api.saasmaker.dev"
}
```

### Project config (`.saasmaker.json`)

Created by `saasmaker init` in your project directory:

```json
{
  "projectId": "pk_...",
  "slug": "my-app"
}
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `SAASMAKER_API_URL` | Override the API base URL |
```

**Step 3: Commit**

```bash
git add packages/waitlist-widget/README.md packages/cli/README.md
git commit -m "docs: add waitlist widget and CLI READMEs"
```

---

### Task 15: Build all packages and verify

**Step 1: Build shared-types**

Run: `pnpm -F @saasmaker/shared-types build`

**Step 2: Build waitlist widget**

Run: `pnpm -F @saasmaker/waitlist build`

**Step 3: Build CLI**

Run: `pnpm -F @saasmaker/cli build`

**Step 4: Build feedback widget**

Run: `pnpm -F @saasmaker/feedback build`

**Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass.

**Step 6: Build dashboard**

Run: `pnpm -F @saasmaker/dashboard build`
Expected: Clean build.

**Step 7: Final commit if any fixups needed**

```bash
git add -A
git commit -m "chore: verify all packages build cleanly"
```
