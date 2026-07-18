# `@saas-maker/email` (Resend) — removed 2026-06-20

## What was removed

- The `@saas-maker/email` package (Resend-based transactional email helper).
- Resend sends from the feedback and waitlist API routes.
- The legacy Resend helper that lived in `workers/api/src/email.ts`.

## Why

The package was orphaned after the decision to migrate to Cloudflare Email
Workers (see `2026-04-29` memory context: Cloudflare Email confirmed, React
Email chosen). The Cloudflare Email Workers migration is not complete, so
keeping the Resend helper in the active codepath blocked cleanup without
serving production traffic. Owner email notifications for feedback/waitlist
are parked pending the Cloudflare Email Workers provider work.

## Revisit conditions

Replaced by Cloudflare Email Workers + React Email when that migration lands.
Do not reintroduce Resend — the provider decision is settled. Owner email
notifications remain blocked until the Cloudflare Email Workers path ships.

## Related

- Status: `STATUS.md` → Blockers; `PROJECT_STATUS.md` → Blocked.
- Memory context: `2026-04-29` email provider and template architecture
  decisions (Cloudflare Email + React Email).
