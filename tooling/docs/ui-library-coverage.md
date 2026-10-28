# UI Library source coverage

Use `node tooling/scripts/ui-library-coverage.mjs <private-manifest.json>` to
write a JSON observation to stdout. Redirect it to a private location. The
collector reads local Git objects only; it does not install, fetch, modify
products or contact a provider. There are no dependencies.

The input has `schemaVersion:1` and `projects`, each with `id`, an absolute
repository `root`, optional relative `prefix` and optional `excludePrefixes`.
Output uses `ui-library-source-coverage.v1`. Missing checkouts stay unknown.

**Control coverage = shared control call sites / identified reusable control
call sites ×100.** Each site is counted once in source, regardless of runtime
frequency. Library child parts are excluded to prevent a complex menu earning
more credit merely through its implementation anatomy. Installed packages,
unused imports and tokens earn no control credit. Shared shells, templates and
footers are separate block counts; a shared footer cannot establish100% UI reuse.

The scan reads committed `origin/main`, falling back explicitly to `HEAD` where
that ref is absent. Every record retains the exact revision/ref, source file
hashes, lines and counts. It does not prove that a ref is freshly fetched or that
production matches it. Web and SwiftUI estimates are broken out; landing paths
are a source-path heuristic, not a verified route inventory.

Web recognition covers direct library imports, aliases and namespace calls,
standard form/table/disclosure controls and exact named component families. SwiftUI
recognition covers selected shared/native control types and applied shared
button styles. Tokens, content text, generic layout containers, icons, models
and product-specific canvases/gameplay do not enter the control denominator.
Tests, fixtures, documentation, vendored/generated build output and archives
are excluded. A factory shared by products requires an explicitly scoped input;
scanning a whole factory must not credit every product with all of its UI.

This is deliberately a **source estimate**, not a percentage of pixels, actual
rendered instances, all reusable UI or design quality. Indirect wrappers and
re-exports, dynamically constructed HTML fragments, copied library components,
unrecognised custom controls and live visibility are not resolved. Native style
association is file-level. A zero means no direct shared control calls among
the identified controls, not no library use. No identified controls remains
unmeasured unless a complete inline HTML document was inspected; that case is
labelled `no-eligible-controls`, without an invented percentage. Template-only
and CLI products without supported source remain unmeasured.

Use the per-file evidence to review the largest bespoke clusters and classify
genuine library gaps before choosing a migration. Do not raise design scores
from adoption or migrate every product to100% merely to improve a proxy. A
complete quality review still exercises the rendered product and its core task.

Site Health owns the private portfolio manifest, observations and display. Its
`apps/backend/scripts/ui-library-coverage.mjs` creates the scoped manifest from
the owner catalog and writes the latest private observation. Refresh it after
relevant component work and during the existing weekly review; keep actual
source dates and previous evidence. This command installs no scheduler.

Method `shared-control-call-sites.v2` also inspects complete, untagged HTML
document template literals in JavaScript/TypeScript server sources. Original
source lines are retained; scripts, comments and interpolation expressions are
excluded from static markup. Fragment strings are not reconstructed. A directly
imported `renderStudioFooterHtml` call is separate block evidence; its
`studio-footer` wrapper is counted once. Links remain outside the standard-control
denominator. Preserve v1 observations as the old recognition baseline, not as
proof of a product improvement when v2 discovers additional source.
