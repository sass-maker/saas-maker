# `@saas-maker/email` (Resend) — removed 2026-06-20

## What was removed

- The `@saas-maker/email` package (Resend-based transactional email helper).
- Resend sends from the feedback and waitlist API routes.

## Not yet removed

- The legacy Resend helper at `workers/api/src/email.ts` still exists. It holds
  a live `fetch('https://api.resend.com/emails', …)` call, but no route or
  module imports it — it is present-but-unused (dead code), not deleted. Delete
  it when the Cloudflare Email Workers path lands (see revisit conditions).

## Why

The package was orphaned after the decision to migrate to Cloudflare Email
Workers (see `2026-04-29` memory context: Cloudflare Email confirmed, React
Email chosen). Resend was pulled out of the active feedback/waitlist codepath;
the standalone `email.ts` helper was left in the tree but disconnected from all
routes. Owner email notifications for feedback/waitlist are parked pending the
Cloudflare Email Workers provider work.

## Revisit conditions

Replaced by Cloudflare Email Workers + React Email when that migration lands.
Do not reintroduce Resend — the provider decision is settled. Owner email
notifications remain blocked until the Cloudflare Email Workers path ships.

## Related

- Status: `STATUS.md` → Blockers; `PROJECT_STATUS.md` → Blocked.
- Memory context: `2026-04-29` email provider and template architecture
  decisions (Cloudflare Email + React Email).
