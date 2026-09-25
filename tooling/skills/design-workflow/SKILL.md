---
name: design-workflow
description: Automatically use for meaningful Fleet visual or frontend design, including requests to design, redesign, beautify, modernize, polish, critique, or substantially improve a website, landing page, dashboard, app shell, onboarding flow, product UI, visual identity, layout, navigation, interaction, responsive system, theme, or component; also use when an interface is called ugly, generic, bland, template-like, amateur, or visually weak. Owns the required owner selection among three or four visual systems before overhaul implementation, plus product clarity, browser evidence, quality gates, and completion. Skip copy-only edits, invisible refactors, accessibility-only corrections, and trivial deterministic CSS fixes.
---

# Fleet design workflow

This is Fleet's single implicit entry point for meaningful design work. Use
Impeccable only as a supporting mechanics playbook. This skill owns direction,
approval, implementation alignment, and completion. Project `PRODUCT.md` and
`DESIGN.md` outrank generic component, palette, or detector recommendations.

## 0. Product-purpose gate

Before choosing a visual lane or writing UI, resolve the product truth for the
surface from `PRODUCT.md`, the surface brief, and supplied evidence. In Fleet,
also load the project's `purposeContract` from
`site-health/apps/backend/config/projects.json`; when only public data is
available, use the same generated contract in SaaS Maker's `projects.json`:

`[Product] helps [specific audience] achieve [specific outcome] by [distinct mechanism].`

For a landing or other `Persuade` surface, the first viewport must make four
things clear within seconds: what the product is, who it is for, why it matters
now, and what the visitor can do next. It must use the product's own vocabulary
and show or link to credible product-specific proof. If that cannot be stated
without vague category language, resolve the missing product truth in this
skill's direction contract before coding; use `$impeccable shape` only for an
explicit concept round or a genuine scope/identity blocker. Do not use visual
polish to hide an unclear proposition.

Record the canonical sentence and source in `direction.contract`. Compare all
six purpose fields with repository-local `PRODUCT.md` or `PROJECT_STATUS.md`.
Use `purposeAlignment: match` when they agree. If the repository has newer
truth, use `repository-override`, record the exact drift in `driftNote`, and
update the canonical Site Health contract in the same task before approving the
landing page. A live page that contradicts audience, outcome, mechanism, proof,
lifecycle, or next action cannot pass comprehension regardless of visual score.

## 1. Classify

Choose exactly one lane before implementation:

- `preserve`: keep the established visual language for a narrow, bounded change
  whose direction is already settled. Capture a before screenshot and follow
  existing design context. Copy-only edits, invisible refactors, accessibility
  corrections, and trivial deterministic CSS fixes do not need alternate
  directions.
- `overhaul`: use for a new surface or a meaningful change to visual language,
  composition, hierarchy, navigation, interaction, identity, or responsive
  behavior. Also use when the owner rejects the current design as ugly,
  generic, bland, template-like, amateur, or visually weak. Before writing UI
  code, present three or four materially different, polished, system-level
  directions using representative real product content. Each direction must
  define purpose, audience, screen job, visual thesis, layout and typography
  system, semantic color roles, interaction thesis, memorable product-native
  signature, and deliberate risk. Show a visual preview for every direction;
  text descriptions alone are insufficient. Vary the whole system rather than
  offering palette swaps, isolated hero art, or the same component template.
  Ask the owner to select a direction and stop before implementation until they
  answer. If the owner explicitly delegates the choice, select one, explain the
  decision, and record it as `delegated`.

When the requested scope could plausibly replace or materially change the
visual language, choose `overhaul`. The direction-selection gate is mandatory
for overhaul work even when one direction appears obviously strongest. Skip it
only when the owner already supplied a sufficiently complete direction or
explicitly delegated the choice in the current request.

If `PRODUCT.md` or `DESIGN.md` is missing, run `$impeccable init` before
meaningful work. Do not initialize untouched projects fleet-wide.

Create the receipt:

```bash
node scripts/design-workflow.mjs create \
  --project <project-root> \
  --mode <preserve|overhaul> \
  --register <brand|product> \
  --surface-mode <persuade|operate|read|experience> \
  --target "<surface>"
```

When invoked inside an independent child repo, call the same script through the
relative Fleet root.

## 2. Shape and build

- Preserve: use the tracked system and before evidence as the contract.
- Overhaul: record reference names, direction ids or probe paths, the owner's
  selected direction, and `approved` or `delegated` in
  `.fleet/design-review.json`. Do not record `agent-selected` unless an older
  receipt requires the field; the owner-selection gate controls new work.
- Before coding, fill the receipt's direction contract: purpose, audience,
  screen job, visual thesis, role-based color/type/spacing/layout system, one
  memorable signature drawn from the product's world, and one deliberate risk
  with a reason. Run a subject-swap test and revise any choice that would work
  unchanged for an unrelated product.
- Use a specialist only when the task genuinely needs it. For the mandatory
  overhaul direction set, read `../design-inspiration/SKILL.md` and use its
  direction-set contract; external reference research remains optional. Use
  `../component-pattern-mine/SKILL.md` for an unfamiliar component,
  `../web-3d-pipeline/SKILL.md` for real-time 3D, or
  `../creative-web-effects/SKILL.md` for a browser effect. Treat specialist
  output as evidence and implementation guidance; this skill remains the single
  completion authority. Do not route ordinary UI work through a second design
  router.
- Do not copy another system's brand styling, tokens, assets, proprietary code,
  or whole visual language. Record material references and anti-patterns when
  they influence a direction; project `PRODUCT.md`, `DESIGN.md`, and existing
  components remain authoritative.
- Use real product content and assets. Do not substitute a component-gallery
  aesthetic for project identity.
- For every new or materially redesigned web surface, read
  `references/ui-library-standard.md`. Use its upstream-first selection order:
  preserve a healthy project-native pattern, otherwise start with Tailwind Plus
  when licensed access is available and use Preline as the free fallback.
  Record exact source URLs in `direction.library`. Standard interface patterns
  are reused, not reinvented. A custom replacement requires explicit owner
  authorization and a recorded upstream gap. Keep any runtime dependency to the
  smallest selective import. Apple-native interfaces are excluded from this web
  standard.
- Use the same reference's priority-scaled delivery profile. P1 receives
  benchmark-grade bespoke composition and the deepest checks; lower priorities
  progressively reuse more of the selected upstream/template system. Priority
  never lowers the product-purpose, lifecycle truth, accessibility, responsive,
  or primary-action requirements.
- Invoke the narrowest Impeccable workflow that owns the job:
  - new UI: resolve the brief and complete this skill's mandatory direction
    selection before implementation. Use `$impeccable shape` only when the
    brief itself is unresolved; direction approval remains owned by this skill;
  - reusable components or tokens: use `$impeccable extract`, preserve rendered
    behavior and public APIs, migrate every caller, and run focused checks;
  - dark mode: use `$impeccable colorize`, define semantic roles for surfaces,
    text, actions, focus, borders, status, overlays, and every interaction state,
    and compose rather than mechanically invert the light theme;
  - phone, tablet, or desktop adaptation: use `$impeccable adapt`, choose
    content-driven breakpoints, preserve core capability, and validate reflow,
    navigation, forms, tables, text size, touch targets, overflow, and input
    methods.
- For a raster asset that needs a dark-mode counterpart, first load the
  installed imagegen skill and require the source image to be attached or
  locally available. Retain the original, create a distinct variant, preserve
  dimensions, composition, important content, softness, fades, transparency,
  and interface purpose, and inspect it on its intended dark surface. Do not
  substitute a blanket CSS filter.
- For requested external reference research or a visual brand board, use
  `../design-inspiration/SKILL.md`; research, probes, or generated boards are
  direction evidence, not a prerequisite for ordinary implementation.

### When comparing design instructions or models

Borrow the same-brief comparison approach from [WhichAI](https://www.whichai.dev/)
only when an evaluation or exploration is requested. Hold the product brief,
content, assets, framework, viewport, and effort budget constant; vary one
instruction set or model at a time and record the configuration. Judge outputs
without model labels where practical, using the existing purpose, visual,
accessibility, interaction, and performance gates—not screenshots alone.
Record useful differences and recurring failures in the existing receipt.
One brief is directional evidence, not a general model ranking. WhichAI's
personal taste rankings do not change Fleet's model defaults, and this method
does not add a routine multi-variant step or authorize extra agents or spend.

## 3. Review

Before completion:

1. Inspect the running surface in a browser.
2. Capture after screenshots at 390, 768, and 1440 pixels.
3. For `Persuade` surfaces, run a fresh-visitor comprehension check:
   without reading the whole page, an independent reviewer must be able to
   state the product, intended audience, primary value, proof of the promise,
   and next action. Record the answers and any mismatch in
   `evidence.comprehension`; set its status to `pass`. Use `not-applicable` for
   other surface modes.
   Score comprehension independently out of 100: product identity 25;
   audience 15; value/outcome 15; distinct mechanism 15; credible proof 15;
   honest next action and lifecycle 15. The minimum passing score is 85. Any
   material contradiction is a failure, even if the arithmetic total or visual
   scores would otherwise pass.
4. Run `$impeccable critique`, fix all P0/P1 findings, then run
   `$impeccable polish` and `$impeccable audit`.
5. Run the project's smallest relevant build/check.
6. Fill the receipt with evidence paths, scores, unresolved counts, purpose
   comprehension result, and check command.

The minimum floors come from `config/design-workflow.json`: purpose 85/100,
critique 32/40, audit 16/20, and zero unresolved P0/P1. Purpose and visual
scores stay separate. Never average them; visual craft cannot compensate for an
unclear or incorrect product promise. Scores are floors, not proof of taste.

Detector findings are advisory. Record them, but never rewrite an intentional
`DESIGN.md` decision only to silence an aesthetic heuristic.

## 4. Close with a decision record

For overhaul work, owner selection is a required approval gate. Record `keep`
when the owner selects or accepts a direction, or `delegated` when the owner
explicitly delegates judgment. Do not infer delegation from a broad request to
finish, improve, beautify, or release a product. Preserve the decision and note
in the receipt so the next design pass can learn from it. Preserve work needs a
question only when a material ambiguity would change product identity or scope.

Validate:

```bash
node scripts/design-workflow.mjs check --project <project-root>
```

Do not claim the meaningful visual change is complete until this command
passes. Report the lane, evidence, scores, owner decision, and any advisory
detector findings.
