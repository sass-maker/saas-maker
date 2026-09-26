---
name: ping
description: Wire a fleet app to App Health application logs (Slack-alertable events like signup, waitlist.join, payment.failed) or add a new alertable event. Use when asked to "alert on X", "notify me when someone signs up", "add a ping/log", or to add an app to the Logs tab.
---

# ping — App Health application logs

Canonical docs: `~/Desktop/fleet/app-health/docs/logs.md` (wiring + decisions)
and `app-health/README.md` § Application logs. Read `docs/logs.md` first.

## Add an app

1. Copy `app-health/examples/dropin-log-client/ping.ts` to the app's
   `src/lib/ping.ts` (or its `@/lib` equivalent). Never edit the copy.
2. Add the hook for its auth library (better-auth `databaseHooks.user.create.after`,
   Auth.js `events.signIn` with `isNewUser`, JWT-only Auth.js select-before-upsert,
   or `void ping(...)` after the write in a route handler).
3. Tell the user to create the app in the App Health dashboard, then set
   `APP_HEALTH_INGEST_KEY` (secret) and `APP_HEALTH_ENVIRONMENT` (var) on the
   app. Do not generate or store keys. The client is a no-op until the key is set.
4. Run the app's own tests/typecheck.

## Browser (frontend) events

Server hooks stay the source of truth for signup/payment. For events only the
page sees, create a **public key** in the Logs tab (pinned to the site origins),
then the fleet standard: copy `app-health/examples/dropin-log-client/app-health-log.template.js`
to the site's `public/app-health-log.js` (fill `__PUBLIC_KEY__`), add
`<script src="/app-health-log.js" defer></script>` to the shared head, and add
`https://ingest.sassmaker.com` to `connect-src` if the site has a CSP. knip-strict
repos need `public/app-health-log.js` in knip ignore. Bundled frontends may use
`createWebLogger` from `@saas-maker/app-health/web` instead. Browser logs show a `browser` badge and alert only at `error`.
Routing to sinks is `LOG_ROUTES` on the Worker (see `docs/logs.md` § Routing).

## Add an event to an already-wired app

Call `ping('<noun>.<verb>', { title, props })` right after the write that makes
the event true. Lowercase names, email in `title`, filterable fields in `props`,
`level: 'warn' | 'error'` for things that need attention. No secrets in props.

## Verify

Open the Logs tab at health.sassmaker.com for the app, or watch the Slack
channel bound to `LOG_ALERT_WEBHOOK_URL`.
