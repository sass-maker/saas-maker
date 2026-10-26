# Portfolio readiness moved to Site Health

The private portfolio sheet, six-category checklist, effort/result scores,
evidence, usage and weekly improvement cadence now live in Site Health at
`http://127.0.0.1:4321/readiness`.

Use the canonical [scoreboard guide](https://github.com/sass-maker/site-health/blob/main/docs/product-scoreboard.md)
and [readiness checklist](https://github.com/sass-maker/site-health/blob/main/docs/product-readiness-checklist.md).

SaaS Maker’s authenticated `/projects?view=scoreboard` is an export-only recovery
bridge. Export the existing account-scoped workspace, import it in Site Health,
reload and verify its scores, usage, retained assessments and history. Keep the
original backup until the exported Site Health workspace matches. The migration
does not upload private data, change scores, or delete the previous workspace.

SaaS Maker retains its public product directory and public projection. Customer
feedback, subscriptions, project keys and authentication remain part of SaaS
Maker’s service; they are not portfolio operations. Shared tooling and the UI
library remain reusable. See the canonical [ownership boundary](https://github.com/sass-maker/site-health/blob/main/docs/ownership.md).
