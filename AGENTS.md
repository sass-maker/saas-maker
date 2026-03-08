# AGENTS.md

## CLI Philosophy (API-First, Minimal Code)
- Prefer `saasmaker api` as the primary interface for all backend features.
- Do not add feature-specific CLI commands by default.
- Add a dedicated command only when there is clear repeated workflow value that cannot be handled ergonomically via `saasmaker api`.

## Required Workflow When API Features Change
When adding/changing API routes, always do all of the following in the same change:

1. Regenerate OpenAPI route spec:
   - `node scripts/generate-openapi.mjs`
   - This updates:
     - `packages/cli/src/openapi.json` (CLI enforcement source)
     - `docs/openapi/openapi.json` (documentation artifact)
     - `apps/docs/public/openapi.json` (published artifact)
2. Keep CLI enforcement aligned:
   - `saasmaker api` validates method/path against OpenAPI by default.
   - Use `--no-validate` only for temporary experimentation.
3. Update documentation:
   - `packages/cli/README.md`
   - `apps/docs/src/content/docs/sdk/cli.md`
   - Include at least one concrete `saasmaker api` example for the new capability.
4. Update examples:
   - Add or adjust `saasmaker examples` entries if the new route is user-facing.

## Documentation Standard
- Optimize for concise, high-coverage docs.
- Prefer recipe-style examples over long prose.
- Every example should be copy-paste runnable (or clearly mark placeholders like `<projectId>`).
