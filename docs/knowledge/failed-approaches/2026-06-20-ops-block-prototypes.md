# Ops block prototypes (Magic Form Builder, AI Feedback Digest) — shelved 2026-06-20

## What was removed

- `packages/blocks/ops/` deleted (Magic Form Builder, AI Feedback Digest).
- `packages/blocks/views/` shelved.
- 26 retired npm packages deprecated on npm on 2026-06-20; 6 active packages
  remain (`sdk`, `cli`, `feedback`, `testimonials`, `changelog-widget`,
  `waitlist`).
- `packages/tooling/*` (eslint-config, prettier-config, tsconfig,
  astro-landing, eslint-plugin-fallow) removed in favor of local per-repo
  configs written by `fnd init` / `fnd fleet fix`.

## Why

The ops block prototypes had no product owner, no human-review boundary, and no
clear integration limit. They added npm surface area and maintenance cost
without a path to production. Automatic task creation from AI feedback was
deferred for the same reason: humans must review digest output before it
becomes work.

## Revisit conditions

Only if product ownership, a human-review step, and concrete integration
boundaries are defined first. Per `PROJECT_STATUS.md` → Planned #2.

## Related

- Design records: [`../../architecture/decisions/2026-06-04-ai-feedback-digest-module.md`](../../architecture/decisions/2026-06-04-ai-feedback-digest-module.md),
  [`../../architecture/decisions/2026-06-04-magic-form-block-design.md`](../../architecture/decisions/2026-06-04-magic-form-block-design.md).
- Timeline entry: `PROJECT_STATUS.md` → 2026-06-20.
