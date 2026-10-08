---
name: design-workflow
description: Fleet's single design entry point for visual or frontend work, and for when the owner calls a design ugly, generic, bland, or template-like. Default lane is PRESERVE (keep the established look, do good work, check the rendered result). OVERHAUL (3-4 rendered directions, owner picks) only for a brand-new surface or an explicit redesign request. Also routes specialist design references (inspiration, slop check, evidence interfaces, components, effects, 3D, Tailwind/markup mechanics).
---

# Fleet design workflow

One entry point for design work. Process scales with the task: most UI work is
PRESERVE and needs no ceremony. Project `PRODUCT.md`, `DESIGN.md` and existing
components outrank generic advice, palettes or detector heuristics.

## 1. Pick the lane

**PRESERVE (default).** Any edit to an existing surface: new section, fix,
polish, component, responsive tweak, copy, refactor. Keep the established
direction. No selection round, no receipt, no scored rubric. Read the local
design context, do good work, then look at the rendered result (section 3).

**OVERHAUL (only when one of these is true):**

- the surface is brand new (no established look to preserve);
- the owner explicitly asks for a redesign, new look, or new direction;
- the owner says the current design is ugly, generic, bland, or template-like.

**Unclear?** Ask one line and wait: "Keep the current look, or explore new
directions?" Do not run the overhaul process as a precaution. A broad
"finish / improve / polish / release" request is PRESERVE unless the owner says
otherwise.

## 2. Overhaul: directions, pick, build

1. Resolve the product truth first (from `PRODUCT.md`, `PROJECT_STATUS.md`, the
   catalog `purposeContract` when relevant):
   `[Product] helps [audience] achieve [outcome] by [mechanism].` For a landing
   or other persuade surface, the first viewport must say what it is, who it is
   for, why it matters, and what to do next. Visual polish never hides an
   unclear proposition.
2. Show **3-4 materially different directions**, each rendered with real
   product content (not text descriptions, not palette swaps on one template).
   Vary the whole system: layout, type, hierarchy, density, colour roles,
   interaction thesis, and one product-native signature. Recommend one and
   name its tradeoff.
3. **Stop until the owner picks.** If the owner explicitly delegates the choice,
   pick one and say why. "Finish it" is not delegation.
4. Build the chosen direction, then review it as in section 3.

When the owner cannot name a UI they like, the agent sets the bar: study two or
three strong original products that fit the surface's job and turn what they do
well into the directions. Never copy another product's brand, assets, tokens,
or proprietary code.

Optional overhaul tooling (use when it helps; none of it is a gate):
[full overhaul process and receipt contract](references/overhaul-process.md),
`node <tooling-root>/scripts/design-workflow.mjs create|preflight|check`
(`fleet.design-review.v2` receipts), the
[slop-score runner](../../docs/slop-score.md) at direction, first render and
final checkpoints, and the [scored review rubric](references/quality-rubric.md).
`<tooling-root>` is the absolute path to `saas-maker/tooling`.

## 3. Review the real rendering (both lanes)

Scores, receipts and a SKILL.md read do not prove design quality. The rendered
result does.

1. Open the running surface (browser or native app) and look at it at phone,
   tablet and desktop widths. For native macOS, see
   [native evidence](references/native-evidence.md).
2. Check hierarchy, typography, composition, identity, interaction states, and
   responsive behavior against the established (PRESERVE) or chosen (OVERHAUL)
   direction. Fix what is generic, misaligned, or off-direction; generic
   styling that undermines the brief is a real defect even when the UI works.
3. Run a subject-swap test on new choices: if it would work unchanged for an
   unrelated product, make it more product-specific.
4. For persuade surfaces, do a fresh-visitor read: can someone state the
   product, audience, value, proof, and next action from the first viewport?
5. Run the project's smallest relevant build/check.
6. Report with the rendered result (screenshots), what you fixed, remaining
   tradeoffs, and verification. Keep the direction decision separate from owner
   acceptance.

Detector findings (slop scale, Impeccable audit) are advisory. Never rewrite an
intentional `DESIGN.md` decision just to silence a heuristic.

## 4. Landing + app coherence

When a product has both a landing page and an app, they are one product with one
design system. Before changing either, look at both. Keep shared identity,
vocabulary, product truth, and a clean CTA to onboarding to first-value handoff.
A standalone visual language on one side needs a reason. Details:
[product continuity](references/product-continuity.md).

## 5. Craft rules that always apply

- Use real product content and assets, not lorem or component-gallery filler.
- For new or materially redesigned web UI, reuse proven upstream patterns
  before inventing: healthy project-native pattern first, then Tailwind Plus
  (when licensed) or Preline. Smallest selective import. See
  [UI library standard](references/ui-library-standard.md). Apple-native UI is
  excluded.
- Dark mode: define semantic roles for surfaces, text, actions, focus, borders,
  status, and every interaction state; compose it, do not invert. Raster assets
  that need a dark variant get a real variant, not a CSS filter.
- Responsive: content-driven breakpoints; check reflow, navigation, forms,
  tables, touch targets, overflow.
- Missing `PRODUCT.md`/`DESIGN.md`: for overhaul work, write the needed context
  from the brief and repo evidence first. For preserve work, follow what exists.
- Do not add a production dependency, paid tool, or licensed asset without
  owner approval.

Impeccable (`$impeccable`, manual-only) is an optional mechanics playbook:
`shape`, `extract`, `colorize`, `adapt`, `critique`, `polish`, `audit`.

## 6. Specialist references

Load only the one the task needs. They are guidance, not extra gates.

- [design-inspiration](references/design-inspiration.md): external references,
  direction sets, brand boards
  ([research contract](references/design-inspiration-research-contract.md)).
- [slop-check](references/slop-check.md): detect AI-default tells in UI and
  prose; advisory detection only.
- [evidence-interface-design](references/evidence-interface-design.md):
  reports, dashboards, benchmarks, calculators, decision pages
  ([contract](references/evidence-interface-design-contract.md)).
- [component-pattern-mine](references/component-pattern-mine.md): research an
  unfamiliar component's anatomy, states and accessibility
  ([contract](references/component-pattern-mine-contract.md)).
- [creative-web-effects](references/creative-web-effects.md): purposeful CSS,
  SVG, Canvas, WebGL, scroll or pointer effects
  ([contract](references/creative-web-effects-contract.md)).
- [web-3d-pipeline](references/web-3d-pipeline.md): glTF, Three.js/R3F, 3D
  viewers and heroes ([contract](references/web-3d-pipeline-contract.md)).
- [design-engineering](references/design-engineering.md): Tailwind class
  canonicalization and semantic markup from an image; read-only toolchain
  doctor at `scripts/doctor.mjs`.
- [source map](references/source-map.md): discovery list of design tools and
  galleries (verify before relying on any entry).
- [quality rubric](references/quality-rubric.md): scored review and
  instruction/model comparison contract.

Editing this skill or its validators is tooling work: run the tooling checks,
not a visual-direction round.
