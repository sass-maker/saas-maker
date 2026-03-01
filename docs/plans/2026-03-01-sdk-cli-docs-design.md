# SDK, CLI & Documentation Design

## Overview

Three additions to complete saas-maker's developer experience:

1. **Waitlist SDK** — React component for embedding waitlist signup forms
2. **CLI** — Project management tool (`saasmaker init`, `login`, `status`, etc.)
3. **Documentation** — README files per package + root monorepo README

---

## 1. Waitlist SDK — `@saas-maker/waitlist`

### Package

- Location: `packages/waitlist-widget/`
- Published name: `@saas-maker/waitlist`
- Build: tsup (ESM + CJS + DTS), same pattern as `@saas-maker/feedback`
- Peer deps: `react >= 18`, `react-dom >= 18`
- Workspace dep: `@saas-maker/shared-types`

### Component: `<WaitlistForm />`

Props (add `WaitlistFormProps` to shared-types):

```typescript
export interface WaitlistFormProps {
  projectId: string;
  apiBaseUrl?: string;       // default: https://api.saasmaker.dev
  theme?: 'light' | 'dark' | 'auto';  // default: auto
  accentColor?: string;      // default: #1464ff
  showCount?: boolean;       // default: true — show "N people signed up"
  onSuccess?: (position: number) => void;
  placeholder?: string;      // default: "you@example.com"
  buttonText?: string;       // default: "Join Waitlist"
}
```

### States

1. **Default** — Email input + optional name input + submit button + signup count
2. **Submitting** — Button shows spinner, inputs disabled
3. **Success** — "You're #N on the list!" with checkmark
4. **Error** — Inline error message (duplicate email, validation, network)

### API Calls

- `POST /v1/waitlist` with `X-Project-Key` header — signup
- `GET /v1/waitlist/count` with `X-Project-Key` header — count display

### Styling

- Self-contained CSS, scoped with `smw-waitlist-` prefix
- CSS variables for theming (`--smw-waitlist-accent`, etc.)
- Light/dark/auto modes via prefers-color-scheme
- Same approach as feedback widget's `widget.css`

### Usage

```tsx
import { WaitlistForm } from '@saas-maker/waitlist'

<WaitlistForm
  projectId="pk_xxx"
  onSuccess={(position) => console.log(`Position: ${position}`)}
/>
```

---

## 2. CLI — `@saas-maker/cli`

### Package

- Location: `packages/cli/`
- Published name: `@saas-maker/cli`
- Bin name: `saasmaker`
- Dependencies: `commander`, `chalk`, `ora`
- No workspace deps needed (talks to API directly via fetch)

### Auth

- `saasmaker login` prompts for API key, stores in `~/.saasmaker/config.json`
- Format: `{ "apiKey": "pk_xxx" }`
- All commands that need auth read from this file

### Project Context

- `saasmaker init` writes `.saasmaker.json` to cwd
- Format: `{ "projectId": "pk_xxx", "slug": "my-app" }`
- Commands that need project context read from this file
- Falls back to prompting if not found

### Commands

```
saasmaker login                 # Store API key
saasmaker whoami                # Show auth status + linked project
saasmaker init                  # Interactive: pick/create project, write .saasmaker.json
saasmaker projects list         # List all projects (name, slug, created)
saasmaker projects create       # Create new project (prompts for name)
saasmaker status                # Show project stats (feedback, waitlist, events counts)
saasmaker keys                  # Show API key for current project
```

### API Base

- Default: `https://api.saasmaker.dev`
- Override: `SAASMAKER_API_URL` env var or `apiBaseUrl` in config

### Build

- tsup, single entry `src/index.ts`
- Output to `dist/index.js` with `#!/usr/bin/env node` shebang
- `"bin": { "saasmaker": "./dist/index.js" }` in package.json

---

## 3. Documentation — README Files

### Root README (`README.md`)

- What saas-maker is (one paragraph)
- Feature list: feedback, waitlist, analytics, vector memory
- Monorepo structure table (packages, apps, workers)
- Quick start: create project, install SDK, collect feedback
- Links to each package README

### Package READMEs

Each follows the same structure:

1. **Title + one-liner**
2. **Install** — npm/pnpm command
3. **Quick Start** — minimal working example
4. **API Reference** — all props/options with types and defaults
5. **Examples** — 2-3 common use cases
6. **Configuration** — theming, customization

Specific files:
- `packages/feedback-widget/README.md`
- `packages/analytics-sdk/README.md`
- `packages/waitlist-widget/README.md`
- `packages/cli/README.md`

---

## File Structure

```
packages/waitlist-widget/
  package.json
  tsconfig.json
  tsup.config.ts
  README.md
  src/
    index.ts
    WaitlistForm.tsx
    api.ts
    styles/
      waitlist.css

packages/cli/
  package.json
  tsconfig.json
  tsup.config.ts
  README.md
  src/
    index.ts              # CLI entry, commander setup
    commands/
      login.ts
      whoami.ts
      init.ts
      projects.ts
      status.ts
      keys.ts
    lib/
      config.ts           # Read/write ~/.saasmaker/config.json
      api.ts              # API client (fetch wrapper)
      ui.ts               # Chalk formatting helpers

README.md                 # Root monorepo README
packages/feedback-widget/README.md
packages/analytics-sdk/README.md
```

---

## Shared Types Addition

Add to `packages/shared-types/src/index.ts`:

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
