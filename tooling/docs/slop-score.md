# Local website slop scoring

Selected on 2026-10-02: [slop-detect](https://github.com/ravidsrk/slop-detect),
with Impeccable retained for source checks and wider design review. This is an
advisory rendered-page fingerprint, not a design grade or authorship probability.

## Why this tool

| Candidate | Evidence and fit | Decision |
| --- | --- | --- |
| [slop-detect](https://github.com/ravidsrk/slop-detect) | Real Chromium layout/computed styles; versioned weighted rules; per-pattern evidence; local CLI; design and copy axes; MIT with Apache-2.0 notices for derived Impeccable code. | Best fit for repeatable local numeric scoring. |
| [Impeccable](https://impeccable.style/docs/detector/) | Source and rendered checks, design-system context and narrow exceptions; broader quality findings. Already installed in Fleet. | Keep as the review companion; no canonical aggregate slop score. |
| [Slop Lab](https://github.com/davidcjw/is-this-ai-slop) | Explainable weighted categories, MIT, no external AI API; fetches HTML without JS rendering. | Less useful for hydrated apps and actual CSS/layout. |
| [Slopdar](https://github.com/Slopdar/slopdar) | MIT rule-based HTML scanning; screenshots; full self-hosted app requires MySQL and Redis. | Prefer rendered detection for scoring; no need for its hosted social/database layer. |
| [CrawlProof](https://crawlproof.com/slop) | Observable broken links, placeholders and carelessness across up to 50 pages; hosted reports. | Different job; no documented local engine found on the reviewed page. |
| [Slop Audit](https://slopaudit.dev/) | Hosted public-page readiness/slop checks, with unavailable checks labeled. | No documented local engine found on the reviewed page. |
| [The Slop Factory](https://www.theslopfactory.com/) | Paid rating and shareable badge. | No inspectable repeatable local scoring method found. |

This selection is based on inspectability and local operational fit. No candidate
established convincing independent accuracy evidence in the reviewed material.
Upstream's [calibration notes](https://github.com/ravidsrk/slop-detect/blob/cdd58e1d249ae39616d94950d6ea232ec7b0b378/CALIBRATION.md)
explicitly document false positives on premium bespoke websites. At the pinned
commit, its September seed evaluation reports 5/13 matching expected tiers and
contains no Heavy ground-truth labels. This small corpus is not a general accuracy
benchmark. Fonts, cream backgrounds, rounded cards and gradients can be intentional.
Never redesign a site just to reduce the number.

## Install and run

For any developer or agent, clone this public repository and run from its root.
No Fleet workspace, RTK installation, private catalog or provider account is needed:

```sh
git clone https://github.com/sass-maker/saas-maker.git
cd saas-maker
node tooling/scripts/slop-score.mjs setup
node tooling/scripts/slop-score.mjs http://localhost:3000 --json
node tooling/scripts/slop-score.mjs http://localhost:3000 --copy
node tooling/scripts/slop-score.mjs http://localhost:3000 --design-md /absolute/project/DESIGN.md
```

If this checkout already lives under Fleet, run the same commands using
`saas-maker/tooling/scripts/slop-score.mjs` from the Fleet root. The tool can also
be run from an unrelated project's working directory using an absolute script
path. `--design-md` paths resolve relative to that working directory.

Discover it through the public capability catalog:

```sh
node tooling/scripts/fleet-capabilities.mjs get script:slop-score --json
```

Setup requires Git, Bun and Node 20+, installs outside product repositories under
`~/.local/share/fleet-tools/slop-detect/<revision>` (or `XDG_DATA_HOME`), builds only
core and CLI, and installs the matching Playwright Chromium. The upstream locked
build toolchain is installed in that isolated cache; no product production dependency
is added. Dependency lifecycle scripts are disabled. Source is pinned to
`cdd58e1d249ae39616d94950d6ea232ec7b0b378` (package version 0.8.0), because the
registry release observed on 2026-10-02 was still 0.5.2. Updating the pin is an
explicit reviewed tooling change; no automatic latest-version lookup runs on scans.

macOS installation and browser scans are verified. Other Playwright-supported
platforms may need the system libraries described in
[Playwright's browser installation guide](https://playwright.dev/docs/browsers#install-system-dependencies).
Setup does not install OS packages or request elevated privileges. On Windows,
run the Node commands in a terminal with Git and Bun available on PATH.

The runner delegates all scoring to upstream. It emits JSON containing provenance,
time, fixed 1280×800 viewport, and the upstream results. It permits localhost and
public HTTP(S) targets, disables remote scoring, and rejects embedded URL credentials.
Each scan uses a fresh headless context rather than a personal browser profile.
Normal target-page network traffic still occurs, including the page's own third-party
scripts. There is no upload to the scoring provider, account, paid AI call, monitoring
subscription, public report registration or persistent scanner service.

Save reports outside the public tooling repository, or in the owning project's
gitignored `.fleet-local/` folder. Reports can contain page text, target URLs and
design tokens; do not commit private output. The runner does not save output itself.

## Interpretation

- Lower design score means fewer matching heuristics: upstream labels 0–9 Clean,
  10–27 Mild, and 28+ Heavy. These labels are advisory.
- Read `definitionsVersion`, `preset`, `browserVersion` and triggered evidence.
  Compare before/after only with the same source pin, preset, viewport and page state.
- `--copy` keeps design and copy in separate `axes`; the top-level score remains
  design. Do not present `unifiedScore` as a product-quality score. Sparse copy may
  be marked `thin`; that is insufficient evidence for a writing verdict.
- Design-system alignment is a separate score with the opposite polarity: higher
  is better. Review token drift against the actual project's design record.
- Exit 0 means a scored advisory report, including Heavy results. Exit 1 means
  an error, blocked/unscored page or failed extractor; a failed scan is unknown.
  Invalid options also exit 1. The wrapper deliberately provides no taste threshold gate.
- Continue responsive browser review at 390/768/1440px, purpose/comprehension,
  accessibility and primary-action validation through the Fleet design workflow.
  This fixed desktop scan does not replace any of those checks.

For future meaningful web design reviews, use this as a supporting before/after
signal alongside Impeccable, and preserve intentional choices in `DESIGN.md`.
