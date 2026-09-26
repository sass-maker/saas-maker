---
name: security-audit
description: >
  Audit a codebase for table-stakes security hygiene (the basics that would be
  embarrassing to miss) and verify the security/privacy promises in legal
  pages, marketing copy, and product UI actually hold up in code. Use for
  "security audit/review/check", "harden this app", "are we doing the basics",
  "audit our privacy claims", "do we do what the privacy policy says", or
  specific basics: secrets in repo, password hashing, security headers, cookie
  flags, CORS, CSRF, rate limiting, dependency CVEs.
---

# security-audit

The bar is **"would this be embarrassing on Hacker News"**, not SOC 2.
Functionality is sacred — prefer additive fixes (header, flag, hash on next
write) over restrictive ones that could lock users out. Every finding carries
a `Breakage risk:` line. Match the rigor of the surrounding codebase.

Fleet baseline: `node saas-maker/tooling/scripts/credential-guard.mjs` already
covers credential scanning — run it first and treat its output as that
section's evidence rather than duplicating.

## Two halves, one report

1. **Code/config hygiene** — the checklist below.
2. **Promise audit** — read what the product *claims* (privacy policy, terms,
   marketing copy, in-product UI: "we never store X", "end-to-end", "deleted
   immediately") and verify the code backs it. A promise the code breaks is
   the highest-severity finding class — it's a lie, not a bug.

## Critical checklist (the HN tier)

- **Secrets in git** — `git ls-files | grep -E '^\.env'`; scan tree + history
  for `sk_live_`, `xoxb-`, `AKIA[0-9A-Z]{16}`, `-----BEGIN.*PRIVATE KEY`,
  `ghp_`, `glpat-`, `AIza[0-9A-Za-z_-]{35}`. Fix = rotate + scrub + template.
- **Weak password hashing** — flag `md5(`, `sha1(`, plaintext compare on
  password fields; expect bcrypt/argon2/scrypt/pbkdf2.
- **SQL via string interpolation of user input** — `${`, `+ req.`, f-strings
  near `query`/`execute`/`raw`. Parameterize.
- **XSS sinks on user data** — `innerHTML`, `dangerouslySetInnerHTML`,
  `v-html`, `{{{ }}}`, `document.write`, `html_safe`, `|safe`.
- **Code-exec sinks** — `eval(`, `new Function(`, `child_process.exec(` with
  interpolation, `pickle.loads`, `Marshal.load`, YAML `load` not `safe_load`.
- **Missing auth on admin/internal routes** — find `admin/`, `internal/`,
  `/api/admin` handlers and check each has auth middleware.
- **IDOR** — `Model.find(params.id)` without scoping to current user/tenant.
- **JWT misconfig** — `alg: 'none'`, `verify: false`, hardcoded weak secret.
- **Open storage ACLs** — public buckets in IaC, signed URLs without expiry.
- **Debug errors in prod** — `DEBUG=True`, framework error pages reachable.
- **CORS `*` with credentials** — browsers block it; apps try to force it.
- **Unchecked uploads on the auth origin** — no MIME/size cap, no
  `Content-Disposition: attachment` or separate origin.

## Serious checklist

Cookies missing `Secure`/`HttpOnly`/`SameSite`; missing CSRF tokens on
state-changing POSTs in stacks that don't autoconfigure them; no rate limit
on auth/email endpoints; missing security headers (`Content-Security-Policy`,
`X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`); dependency
CVEs (`pnpm audit` / `npm audit` / `pip-audit` / `bundle audit` — run the
repo's ecosystem scanner); PII in logs; tokens in URLs or localStorage where
cookies belong.

## Method

- Announce scope first; `$ARGUMENTS` path narrows it. Exclude build output,
  deps, lock files, tests.
- Detect the stack from manifests; grep for callers before flagging —
  speculation isn't a finding.
- For the promise audit, quote the claim verbatim and cite the code that does
  or doesn't implement it.

## Report

Worst-first, one line each: `severity · file:line · what's wrong · why it
matters · fix · breakage risk`. Promise-audit findings first if any claim
fails — those outrank hygiene. End with what was verified clean.
