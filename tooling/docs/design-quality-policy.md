# Design and quality policy

The owner-local `catalog/projects.json` is the source for Fleet design policy.
Edit its top-level `systems` blocks and optional `projects[].systems.ui` cells.
The public tooling manifests are generated projections, never editing inputs.
This document explains their meaning and the evidence needed to update them.

## The four policy blocks

`systems.uiLibrary` describes the shared library and consumer installation.
`systems.designDefaults` records the owner's default taste and continuity rules.
`systems.loadingStates` sets the behavior expected while data arrives.
`systems.releaseGate` records the checks required before and after deployment.

Each block has `schemaVersion: 1` and `decidedAt: "2026-10-11"`.
Each `source` object retains a verbatim owner `quote` and its original `date`.
The decision date records this catalog entry, not when the owner first spoke.
Dates use calendar-valid `YYYY-MM-DD` strings.
The validator rejects missing required fields and unknown policy fields.

## Owner quotes

The exact quotes live in `systems.<block>.source` in the private catalog.
They are also projected into `tooling/config/design-policy.json`.
Do not paraphrase a source quote when changing explanatory policy fields.

The library quote is “Very little code”, dated 2026-10-09.
It comes from the owner's UI-library project note and explains shared code.
The design-default quote, dated 2026-10-11, is:
“i prefer dark and easy to understand themes. when in doubt ask”.
The release direction, dated 2026-10-10, is:
“score it and, based on the score, release it… ensure SEO, GEO and speed tests: nothing fails”.
Loading states retain that release direction because they belong to the gate.
The gate's detailed requirements were supplied in the owner's release brief.

## Shared UI library

[SaaS Maker UI](https://github.com/sass-maker/ui-library) is public.
It ships through tagged GitHub dependencies and SwiftPM, without npm publishing.
`currentTag` is the latest verified release tag, not an automatic upgrade.
The recorded remote tag is `v0.1.19`, verified on 2026-10-11.
Consumer manifests may intentionally remain on earlier tags.

The web package names and repository subdirectories are:

| Package | Subdirectory |
| --- | --- |
| `@saas-maker/ui` | `/packages/ui` |
| `@saas-maker/motion` | `/packages/motion` |
| `@saas-maker/templates` | `/packages/templates` |
| `@saas-maker/tokens` | `/packages/tokens` |

The block stores a `pnpm pkg set` command for every package.
Replace `<tag>` with the deliberately chosen verified release tag.
For example, set the UI dependency before installing:

```sh
pnpm pkg set "dependencies.@saas-maker/ui=github:sass-maker/ui-library#v0.1.19&path:/packages/ui"
pnpm install
```

Keep ui, motion and templates on the same tag.
Templates requires ui and motion beside it.
Avoid `pnpm add` for these specs: pnpm 10.33 can discard the tag and subdirectory.
For Astro React integration, CSS entries and fonts, follow the
[consumer guide](https://github.com/sass-maker/ui-library/blob/main/README.md).
Reuse library variants and tokens rather than creating per-product forks.

The Swift product is `SaaSMakerUI`.
Its `Package.swift` is at the repository root.
The source target lives under `swift/Sources/SaaSMakerUI`.
Consumers use `.package(url: "https://github.com/sass-maker/ui-library", from: "0.1.19")`.
`from:` is a compatible version requirement; `Package.resolved` records resolution.

Gallery (`GalleryPage`) and Workbench (`WorkbenchPage`) are landing templates.
`ConsolePage` is the app shell for data tools.
Hero layouts include `center`, `split`, `form` and `masthead`.
Choose the template for the product's content and identity.

`StudioFooter` replaces the old Precise footer rollout.
React consumers import it from `@saas-maker/ui/blocks/footer`.
Framework-free consumers use `renderStudioFooterHtml` from `@saas-maker/ui/footer-html`.
They also load the library's `footer.css` and `footer.js` entries.
The footer carries subscribe, Ask AI, feedback and the studio strip.
Existing Precise footers remain accepted by the Fleet audit during migration.

## Design defaults

Dark and easy-to-understand themes are the default.
The landing page and app are one design system.
They must share palette, mode, typography, voice and component language.
The owner described “app and landing page not matching” as a defect.

Keep each section to one idea and one focal visual.
Use real copy and images, with no stat or pill noise.
Preserve the product's identity instead of applying a generic centered template.
Headlines, buttons and navigation use lowercase.
When a taste call is unclear, ask with two to four rendered options.
A light theme requires the owner's explicit pick before release.

## Loading behavior

Show a content-shaped skeleton within 300 ms on every data-fetching screen.
Never leave that screen blank or show a full-page spinner.
Data arrival must produce cumulative layout shift of at most 0.05.
Implement error, empty and retry states as part of the same screen.
Revisits show cached content instantly, then revalidate in the background.

Use `Skeleton` from `@saas-maker/ui/components/skeleton` for shaped placeholders.
`DataTable` has loading skeletons, empty/error rendering and an `onRetry` hook.
It is exported from `@saas-maker/ui/components/data-table`.
`EmptyState` from `@saas-maker/ui/blocks/app` explains empty results and actions.
These primitives support the policy; they do not implement caching automatically.
Verify behavior on Slow 4G with a four-times CPU slowdown.

## Release gate

Run every check before deployment and again on the live deployment.
Capture the baseline and permit no regression against it.
Every check must pass; fix failures and rerun them.
If a failure cannot be fixed, report it and do not release.
Passing this gate does not supply deployment approval.

Speed covers the home page and two key inner pages.
Use the median of three mobile Lighthouse runs and report the spread.
Required category scores are performance 90, accessibility 95,
best practices 95 and SEO 95, or higher.
Maximums are LCP 2.5 seconds, CLS 0.1 and TBT 200 ms.
The loading-state CLS limit of 0.05 applies specifically to data arrival.

SEO requires one H1, a unique title of at most 60 characters,
and a unique meta description of at most 160 characters.
Check self-canonical absolute URLs and parse page-appropriate JSON-LD.
OG/Twitter tags need a reachable image; robots and sitemap must be consistent.
Reject accidental noindex, broken images and internal links outside 2xx/3xx.

GEO checks AI crawler policy against the catalog's AI-visibility rules.
Cover GPTBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot.
Preserve llms.txt, any existing llms-full.txt and markdown content negotiation.
Organization, Product and SoftwareApplication facts must remain accurate.
Run available SaaS Maker GEO/AI-visibility tooling for the product.

Fleet contracts cover footer auditing, Clarity and App Health applicability,
working subscribe/feedback, and unchanged route statuses and headers.
Probe at least ten existing routes before and after the change.
Render at 390, 768 and 1440 pixels with no overflow or runtime failures.
Check visible keyboard focus and complete interactive flows.
Save before/after screenshots; check quiet design and product identity.
The gate also repeats the loading and continuity requirements above.
Record before/after results for every check in the PR and final report.

The intended [App Health performance contract](https://github.com/sass-maker/app-health/blob/main/docs/performance-contract.md)
is referenced by repository path in `releaseGate.performanceContract`.
That file was absent from the local App Health checkout on 2026-10-11.
Its repository path was verified through the GitHub contents API that day.
This catalog records the supplied release gate, without importing that contract.

## Reading UI adoption

`tooling/config/ui-adoption.json` contains only projects with `systems.ui`.
Its `projects` array follows canonical catalog order, without sorting by name.
Every sub-object and field is optional; absence means unknown or unrecorded.
Absence does not mean non-adoption, light mode, or failed continuity.
An explicit `library: false` or `saasMakerUI: false` needs actual evidence.

`landing` can record `library`, `version`, `template` and `mode`.
`app` can record `library`, `version` and `mode`.
`native` can record `saasMakerUI` and `version`.
`continuity` can record `score`, `notes` and `checkedAt`.
Modes are `light`, `dark` or `null`; scores are integers 0–3 or `null`.
An unknown score is not zero. The catalog does not invent a scoring rubric.

The initial web records are manifest pins, not deployed-version claims.
Root app packages identify anime-list, chatgpt-connections and techdata.
Landing packages identify ios-landings, calorie, knowledge-base,
significanthobbies, starboard and StorageDaddy's `site/landing`.
Templates are recorded only where a local content file explicitly names one.
StorageDaddy's native version comes from `Package.resolved`, not its minimum.
The initial records contain no inferred modes or continuity assessments.

## Updating and checking

Read local package manifests or Swift resolution files without changing consumers.
Refresh `currentTag` with `git ls-remote --tags` and compare versions numerically.
Edit only the private catalog, then run `pnpm catalog:sync`.
Run `pnpm catalog:check-systems`, `pnpm catalog:test-schema` and `pnpm check:docs`.
Use managed Fleet workspaces for installation and heavy checks.
The generator resolves its own outputs inside the current checkout.
Missing sibling manifest directories are reported as skipped and unverified.
Do not create or redirect sibling outputs to unrelated checkouts.
The full source check also expects Site Health's compatibility symlink.
An isolated worktree can generate local manifests while that check is unavailable.
The validator runs before any system manifest is written.
Tests cover malformed policy, optional adoption, output order and stale detection.
