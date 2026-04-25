# Skill: Fleet Migration Protocol

**Purpose**: Safely bring a legacy repository into the Foundry Gold Standard.

## 📥 Entry Criteria
- Project exists in `~/Desktop`.
- Project has a `package.json`.

## 🛠️ Step-by-Step Algorithm

### 1. Audit
Run `fnd audit` inside the project directory.
- Identify missing files (`foundry.json`, `eslint.config.js`).
- Check `package.json` for drift in `prettier` or `devDependencies`.

### 2. Initialization
If `foundry.json` is missing:
- Run `fnd init`.
- Follow prompts to link to the Cockpit.
- Rename `.saasmaker.json` if it exists.

### 3. Standards Application
Manually verify or run `fnd fleet fix`:
- **ESLint**: Replace `eslint.config.js` with `import config from "@saas-maker/eslint-config/<type>"; export default config;`.
- **TSConfig**: Set `extends: "@saas-maker/tsconfig/<type>.json"`.
- **Prettier**: Set `"prettier": "@saas-maker/prettier-config"` in `package.json`.

### 4. Operational Layer
- Install dependencies: `pnpm add @saas-maker/ops @saas-maker/db @saas-maker/foundry-shield`.
- Create `src/lib/foundry.ts` using the Forge template.
- Wrap the main entry point (API handler or Page) with `trace()`.

### 5. Verification
- Run `pnpm lint` and `pnpm build`.
- Run `fnd audit` again. Ensure status is **PASS**.

## 🛑 Failure Handling
- If `pnpm install` fails, do NOT proceed. Report dependency conflicts.
- If `lint` fails after migration, use AI to fix rules or mark as a "Modernization Debt."
