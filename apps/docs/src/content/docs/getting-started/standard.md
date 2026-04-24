---
title: The Standard
description: Learn about the Foundry Gold Standard for code quality and consistency.
---

The **Foundry Standard** is a set of modular, versioned configurations that eliminate configuration drift across your project fleet. It ensures that every project, whether it's a Next.js frontend or a Node.js worker, follows the same best practices.

## 🛠️ Components

### 1. ESLint (`@saas-maker/eslint-config`)
Our "Gold Standard" linting rules are strictly enforced and include:
- **Import Sorting**: Automated organization of your imports.
- **Promise Best Practices**: Safety for async/await code.
- **React Refresh**: Specialized rules for Vite and Next.js.
- **Zero Conflict**: Perfectly aligned with our Prettier configuration.

### 2. TypeScript (`@saas-maker/tsconfig`)
Strict, optimized base configurations for various environments:
- `next.json`: Optimized for Next.js App Router.
- `vite.json`: Optimized for Vite/React.
- `node.json`: Optimized for Node.js and Cloudflare Workers.

### 3. Prettier (`@saas-maker/prettier-config`)
A shared formatting standard that includes:
- Tailwind CSS plugin for automated class sorting.
- Consistent spacing and quote rules for the whole fleet.

### 4. Dev-Config (`@saas-maker/dev-config`)
The "Auto-pilot" for your repositories. Installing this package automatically sets up:
- **Husky hooks**: Linting checks before every push.
- **Secret Scanning**: Basic checks to prevent committing credentials.

---

## 🚀 How to Apply

### Automated (Recommended)
Run the following command in any project directory:

```bash
fnd init
```

### Manual Installation
If you prefer to set it up yourself:

1. **Install the packages**:
   ```bash
   pnpm add -D @saas-maker/eslint-config @saas-maker/tsconfig @saas-maker/prettier-config
   ```

2. **Extend ESLint** in `eslint.config.js`:
   ```js
   import config from "@saas-maker/eslint-config/next"; // or /vite, or base
   export default config;
   ```

3. **Extend TSConfig** in `tsconfig.json`:
   ```json
   { "extends": "@saas-maker/tsconfig/next.json" }
   ```
