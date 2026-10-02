# Landing and application continuity

Apply when a product has, or is getting, both a landing page and an application.
An application can be browser-based or native. Review the pair whenever either
surface receives meaningful design work, even if they live in different repos.

## One product design system

Use one product-level `DESIGN.md` authority for both surfaces. Record the shared
typography, semantic color roles, spacing rhythm, geometry, icons, imagery,
component states, motion character and product vocabulary. Reference existing
shared tokens and components where the stacks support them; do not add a
dependency or rebuild native controls just to share implementation code.

The landing page can explain the product with more space while the application
uses denser task layouts. Native controls and input conventions may differ.
Explain these differences through the surfaces' jobs and platform needs; they
must still carry the same recognizable identity and quality of execution.
A polished marketing page leading to a generic dashboard fails this review.

Inventory the real URLs, routes/states or native app screen locations in
`direction.productSurfaces.landing` and `.app`, with `scope: paired`. Identify
the relevant repos and shared design authority in the direction brief. Use
`scope: standalone` only when there is no separate counterpart, with a concrete
`reason`; never use it because the application is inaccessible or unfinished.

## Select the complete experience

For each comparison direction, preview the landing and a representative core
app screen together using real product content. Include the entry/onboarding
context when it determines the transition. Record their artifact paths in
`direction.probes[].surfaces.landing` and `.app`. Preflight requires both.
For supplied or delegated directions, record the pair in
`direction.pairedPreview`; the approval exception does not remove continuity.

When only one surface changes, inspect the actual existing counterpart and
anchor the target to its established system. A direction choice must make any
necessary changes to the counterpart visible to the owner. Do not silently
redesign another surface or repo beyond the authorized task. Resolve a known
conflict within scope or present the concrete additional change for approval.

Apply the slop checkpoints to both rendered web surfaces when assessing the
pair, and record finding dispositions per surface. One checkpoint can use a
multi-URL runner report, for example:

```sh
node <tooling-root>/scripts/slop-score.mjs <landing-url> <app-url> --json
```

Save that unchanged JSON in the checkpoint's own report file. Keep native visual review
separate from the browser scanner's capability. A low landing score cannot
establish application quality, and an unavailable surface remains unverified.

## Review the transition and the rendered pair

Record `evidence.productContinuity` separately from aesthetic totals:

- `status: pass`, a named `reviewer`, and a report path.
- Distinct current rendered captures in `surfaces.landing` and `surfaces.app`.
- Passing concrete observations under the five `checks` below.

Use `status: pending` before review and `blocked` when access or inspection is
unavailable. Only `pass` can qualify paired completion; `not-applicable` is
reserved for an explained standalone product.

| Check | Required comparison |
| --- | --- |
| `designSystem` | Typography, semantic colors, geometry, spacing, controls and state treatment follow the shared system; explain density and platform differences. |
| `identity` | Composition, imagery, icons and motion feel like the same product, without a sudden drop in craft after entry. |
| `vocabulary` | Product names, feature labels, actions and important concepts use consistent meanings across marketing, onboarding and app UI. |
| `productTruth` | Landing promises, screenshots, demos, pricing/access and lifecycle accurately describe the current app and its real core task. Label concept or upcoming states explicitly; do not present mock UI as a shipped capability. |
| `handoff` | Follow the actual landing CTA through the applicable signup, install or onboarding path to the first useful app state. Record what happened and any access/release limits. |

The report names mismatches, their rendered locations, corrections and remaining
limits. Fix material contradictions and unintended identity changes before
claiming completion. A blocked app inspection or handoff cannot be called pass;
it leaves continuity incomplete. Individual critique, audit or slop scores do
not compensate for that failure. For a genuinely standalone surface, record
`status: not-applicable` and a reason rather than manufacturing a counterpart.

These validators check the evidence contract when invoked. They do not prove
visual similarity from pixels, owner acceptance, or automatic workflow execution.
