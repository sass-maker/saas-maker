# Skill: Fleet Debugging Protocol

**Purpose**: Autonomously investigate and fix errors reported in the Foundry Cockpit.

## 📥 Entry Criteria
- Error event detected in `foundry_error` stream.
- Project ID and Message are available.

## 🛠️ Step-by-Step Algorithm

### 1. Context Gathering
- Locate the project in `~/Desktop` using the `project_id`.
- Read the stack trace from the error metadata.
- Identify the failing file and line number.

### 2. Reproduction
- Run the local dev server: `pnpm dev`.
- Run unit tests: `pnpm test`.
- Check if `trace()` data in PostHog reveals latency or input payloads leading to the crash.

### 3. Isolation
- Use `grep_search` to find other occurrences of the failing pattern in the fleet.
- If it's a "Fleet-wide" issue (e.g., an AI provider changed their API), the fix must be applied to the **Foundry Block**, not the project.

### 4. Implementation
- Apply the fix.
- Ensure `FoundryError` is used for any new error boundaries.
- Add a test case to prevent regression.

### 5. Deployment
- Run `pnpm build`.
- Commit with a descriptive message: `fix(foundry): <description>`.
- Verify the error count drops in the Cockpit.

## 🛑 Failure Handling
- If the error is non-reproducible, log an "Observability Debt" and add more `trace()` points to the code.
