---
title: "The Standard"
description: "Learn about the Foundry Gold Standard for code quality and consistency."
---

The **Foundry Standard** is a set of local, version-controlled configs that eliminate drift across your project fleet. `fnd init` and `fnd fleet fix` write them into each repo — no shared npm tooling packages.

## Components

### 1. ESLint
Local flat `eslint.config.js` per stack (Next.js, Vite, or Node). Includes import sorting, React hooks rules, and Prettier compatibility.

### 2. TypeScript
Local `tsconfig.json` with strict defaults tuned for Next.js, Vite, or Workers.

### 3. Prettier
Local `.prettierrc.json` with Tailwind class sorting via `prettier-plugin-tailwindcss`.

### 4. Fleet integration
- `foundry.json` links the repo to the control plane
- `@saas-maker/sdk` for API calls from fleet products
- Embeddable widgets (`@saas-maker/feedback`, etc.) where needed

---

## How to apply

### Automated (recommended)

```bash
fnd init
# or refresh an existing fleet project:
fnd fleet fix
pnpm install
```

### Refresh lint/format devDependencies fleet-wide

```bash
fnd fleet upgrade
```

---

## Backend services

Use **`@saas-maker/sdk`** for feedback, waitlist, changelog, roadmap, events, and task worker helpers. Do not depend on removed internal packages (`@saas-maker/ops`, `@saas-maker/db`, shared eslint/tsconfig packages).
