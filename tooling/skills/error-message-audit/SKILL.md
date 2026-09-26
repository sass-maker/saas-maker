---
name: error-message-audit
description: >
  Audit user-facing error messages in a codebase against an error-writing
  rubric, then walk findings one at a time proposing rewrites. Use whenever
  the user mentions auditing error messages, reviewing error copy, fixing
  "Something went wrong", error UX/wording/tone, or how errors are worded —
  even if they don't say "audit".
---

# error-message-audit

Quality of *communication*, not bug hunting — you're judging how errors are
worded, not whether handling is correct. Find strings real users see, score
against the rubric, propose a rewrite per finding, ask before editing.

## Scope

`$ARGUMENTS` path narrows the scan; otherwise whole repo minus
`node_modules`/`.git`/`dist`/`build`/`out`/`.next`/`vendor`/`target`/
`__pycache__`/`.venv`/locks/minified/build-output. Always announce scope
first.

## Find user-facing strings

**Strong signals** (almost certainly user-facing): toast/notify/alert calls
(`toast.error`, `Alert.alert`, `enqueueSnackbar`, `flash[:error]`,
`messages.error`, `put_flash`); i18n error keys (`t('errors.*')`, `en.json`
`error*|fail*|invalid*|cannot*`); form validation (`setError`, Zod/Yup/Joi
`.message()`, `react-hook-form` rules, `validates …, message:`); error UI
components (`<Alert>`, `<ErrorMessage>`, `error.tsx`, `*ErrorDialog`);
4xx/5xx response bodies (`res.status(4xx).json({error:…})`, `HTTPException`,
`render json: {error:…}`); error-boundary fallbacks.

**Weak — read context first**: `throw new Error(…)` counts only if it
bubbles to a user boundary; strings near `catch` only if rendered.

**Skip — dev-only**: `console.*`, loggers, `Sentry.capture*`, comments,
tests, throws that get caught and reformatted. When in doubt, read the file —
30 seconds of context beats flagging 100 dev strings.

**Group duplicates** — same string or i18n key across call sites = one
finding listing all locations.

## Rubric

**Critical — fix first:**

- **Generic / no information** — "Something went wrong", "Failed", "Oops" →
  say what failed + what to do: "We couldn't save your post — try again."
- **Technical jargon** — "fetch", "null", "schema", "request failed",
  endpoint paths → "We couldn't load your account."
- **Leaks internals** — raw HTTP codes, stack traces, exception classes, SQL.
  An opaque ref alongside a real message is fine: "(ref: A8C3)".
- **Collapses distinct causes** — one catch-all where the code knows the
  cause → branch: permission vs connection vs validation.
- **Blames the user** — "You entered an invalid…" → "That email doesn't look
  right — check for typos."
- **Blames a third party** — "Stripe isn't responding" → "We're having
  trouble connecting to Stripe. Try again in a moment."

**Serious — should fix:**

- **Inappropriate tone** — "Whoops!", "Yikes!", ALL CAPS, emoji in serious
  flows.
- **No next step** — a failure with no recovery path, retry, or support link.
- **No state reassurance where it matters** — after a failed save/payment,
  say whether their data/money is safe.
- **Ambiguous source** — doesn't say *what* failed when several things could
  have.

**Minor**: inconsistent terminology with the rest of the UI; missing
"try again" affordance text where the UI offers one.

## Walk findings one at a time

For each: quote the string + location, list violated principles, propose the
rewrite in the product's voice, wait for the user before editing. End with a
count by severity and anything you skipped as dev-only.
