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
- **ESLint**: Use the local flat config from `fnd init` templates (`eslint.config.js` per stack — Next, Vite, or Node).
- **TSConfig**: Copy the matching template `tsconfig.json` (local extends, no shared npm package).
- **Prettier**: Copy `.prettierrc.json` from the matching `fnd init` template.

### 4. Operational Layer
- Install fleet widgets/SDK as needed: `@saas-maker/sdk`, `@saas-maker/feedback`, etc.
- Create `src/lib/foundry.ts` using the Forge template when the project talks to the API.
- Use local PostHog/telemetry helpers (see `workers/api/src/lib/telemetry.ts` in saas-maker) instead of removed `@saas-maker/ops`.

### 5. Verification
- Run `pnpm lint` and `pnpm build`.
- Run `fnd audit` again. Ensure status is **PASS**.

## 🛑 Failure Handling
- If `pnpm install` fails, do NOT proceed. Report dependency conflicts.
- If `lint` fails after migration, use AI to fix rules or mark as a "Modernization Debt."
