---
title: "OpenAPI Artifact"
description: "How the generated SaaS Maker OpenAPI artifacts stay current."
---

This directory holds the generated OpenAPI specification for the SaaS Maker
API. **Do not edit `openapi.json` by hand** — it is regenerated from the
running API by `pnpm generate:openapi` (`scripts/generate-openapi.mjs`).

## Regeneration

When API routes change, run:

```bash
pnpm generate:openapi   # updates packages/cli/src/openapi.json and docs/openapi/openapi.json
pnpm check:openapi      # regenerate + git diff --exit-code on the two artifacts
```

`pnpm check:openapi` runs in CI on every push/PR, so a stale spec fails the
build. The CLI (`packages/cli`) validates all `fnd` commands against
`packages/cli/src/openapi.json` by default.

## Related

- API reference (human-readable): [`../api/overview.md`](../api/overview.md)
  and the per-service pages under [`../services/`](../services/projects.md).
- CLI docs: [`../sdk/cli.md`](../sdk/cli.md).
- Required workflow when API routes change:
  [`../development/README.md`](../development/README.md).
