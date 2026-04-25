# Skill: Factory Scaffolding Protocol

**Purpose**: Extend or modify the Foundry Forge blueprints (Templates).

## 📥 Entry Criteria
- New framework (e.g., Svelte, Astro) or pattern (e.g., Auth-ready) requested.
- Destination: `packages/cli/templates/`.

## 🛠️ Step-by-Step Algorithm

### 1. Template Structure
- Create a new directory in `packages/cli/templates/<type>`.
- Essential files: `package.json.tmpl`, `tsconfig.json`, `eslint.config.js`.
- Placeholder: Use `{{name}}` for the project slug.

### 2. Standardization
- Link to the Gold Standard packages in `package.json.tmpl`.
- Add `src/lib/foundry.ts.tmpl` for the Operational Layer initialization.
- Enforce the `foundry.json` config presence.

### 3. CLI Integration
- Update `packages/cli/src/commands/forge.ts` to include the new type in the prompts.
- Ensure `copyRecursive` handles any new file types.

### 4. Logic Validation
- Run `pnpm test` in the CLI package to ensure the `Forge Scaffolding` test suite passes.
- Perform a dry-run: `fnd forge --name test-project --type <type>`.

### 5. Verification
- Audit the newly forged project: `fnd audit`.
- Result MUST be **PASS**.

## 🛑 Failure Handling
- If the new template fails to build immediately after forging, the blueprint is invalid. Do not commit.
