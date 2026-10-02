---
name: design-workflow
description: Use before meaningful Fleet visual or frontend work and whenever the owner is unhappy with a design or calls it ugly, generic, bland, template-like, or weak. Owns direction selection, implementation preflight, rendered craft review, and completion. Excludes copy-only edits, invisible refactors, accessibility corrections, and trivial deterministic CSS fixes.
---

# Fleet design workflow

This is Fleet's single implicit entry point for meaningful design work. Use
Impeccable only as a supporting mechanics playbook. This skill owns direction,
approval, implementation alignment, and completion. Project `PRODUCT.md` and
`DESIGN.md` outrank generic component, palette, or detector recommendations.
Editing this workflow's instructions or validators is tooling work; run the
relevant tooling checks rather than a product visual-direction round.

When the product has landing and app surfaces, apply
[product continuity](references/product-continuity.md): inventory both, use one
design system, select paired previews, and review their rendered identity,
vocabulary, product truth and entry flow. Standalone work needs a reason.

State the applicable lane and gates in the task plan before UI edits. Read this
skill again when a task shifts into meaningful visual work. Prior skill reads, receipts or passing builds cannot qualify new work.
The excluded copy-only, invisible-refactor, accessibility-correction, and trivial
CSS tasks need ordinary scoped verification, not a receipt or the full design
gates. A change that also alters composition, hierarchy, or interaction is not
covered by that exception.
The optional Codex `UserPromptSubmit` routing reminder is installed with
`node <tooling-root>/scripts/install-skill-run-hook.mjs --design-routing`.
Codex requires review/trust of that definition through `/hooks`; an installed
definition is not proof of runtime activation. The reminder reinforces routing;
the preflight and completion validators enforce receipt requirements, not taste.

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
update the canonical SaaS Maker catalog and regenerate its views in the same task before approving the
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

If `PRODUCT.md` or `DESIGN.md` is missing, establish the missing product/design
context before meaningful work. Use `$impeccable init` when available; otherwise
write the context from the actual brief and repository evidence. Do not claim
an unavailable skill ran or initialize untouched projects fleet-wide.

Create the receipt:

```bash
node <tooling-root>/scripts/design-workflow.mjs create \
  --project <project-root> \
  --mode <preserve|overhaul> \
  --register <brand|product> \
  --surface-mode <persuade|operate|read|experience> \
  --target "<surface>"
```

`<tooling-root>` is the absolute path to `saas-maker/tooling` in this workspace;
resolve it before running commands from an independent child repo. Receipts use
`fleet.design-review.v2`. Keep a legacy receipt as historical evidence and use
`--receipt .fleet/design-review-<task>.json` for a new pass; pass that same path
to both gates. Do not overwrite or relabel historical evidence as a fresh review.
Retain every referenced preview, capture and report through completion and future
audit. Cleanup of temporary implementation code must preserve receipt evidence.

Browser receipts use web viewports. For native macOS, read
[the native evidence contract](references/native-evidence.md) before creating or reviewing a receipt.

## 2. Shape and build

- Preserve: use the tracked system and before evidence as the contract.
- Overhaul: use `direction.source: comparison`, record three or four probes
  with distinct visual artifact paths plus `thesis`, `layout`, and `typography`,
  the selected id, and `approved` or `delegated`. Record the exact owner quote
  and its attributable local decision record in `direction.ownerEvidence`.
  For a complete owner-supplied direction, use `source: owner-supplied` with its
  artifact in `direction.supplied`; for explicitly delegated selection, use
  `source: delegated`. These are evidenced exceptions to the comparison round,
  not interpretations of "finish", "improve", or "release". `agent-selected`
  never passes a new overhaul.
- Before coding, fill the receipt's direction contract: purpose, audience,
  screen job, visual thesis, role-based color/type/spacing/layout system, one
  memorable signature drawn from the product's world, and one deliberate risk
  with a reason. Fill `qualityBar` with the concrete qualities this surface
  must achieve and the owner's current concerns. Use repository-local identity
  and the current brief; do not impose one Fleet-wide palette, layout, or mood.
  If prior work disappointed the owner, name the failure and show how each
  direction addresses it. Run a subject-swap test and revise any choice that would work
  unchanged for an unrelated product.
- The agent owns establishing the quality standard. When the owner cannot name
  a UI they like, inspect two or three strong original product references that
  fit this surface's job, state what their composition/type/interaction does
  well, and turn those observations into the quality bar and direction probes.
  Record attributable references and an anti-reference in the direction brief.
  Do not require the owner to supply inspiration or convert a reference's
  branding into a Fleet-wide style. A selection chooses among already polished
  alternatives; it is not a request for the owner to design them.
- For each direction, show representative real content in a primary screen
  and a second relevant context or state; for landing/app products, show both
  using `probes[].surfaces` or `direction.pairedPreview`. Include compact-screen
  behavior where relevant. Recommend one and explain its tradeoff; do not
  silently implement it. A polished hero alone does not establish the system.
- At direction review, run the [slop scale](../../docs/slop-score.md) on each
  rendered web direction before presenting it. Review triggered evidence, fix
  generic choices that conflict with the brief, and record intentional choices.
  Save a `directions` checkpoint for each probe (or the supplied/delegated
  direction). Static-only previews or unavailable scans need a recorded
  limitation; never invent a score. Preflight requires these checkpoint records.
- Before UI implementation, run:

  ```bash
  node <tooling-root>/scripts/design-workflow.mjs preflight --project <project-root>
  ```

  This checks context, the direction contract, source choice, and approval
  evidence without requiring after screenshots or final scores. Direction
  previews may be produced before it passes; production UI implementation may
  begin only after it passes. A passing preflight is not completion.
- After the first working web render, run the slop scale again and record the
  `iteration` checkpoint before final polish. Use its actual triggered evidence
  to guide a fix/review pass; do not postpone every scan until handoff. Re-scan
  after material fixes and save a separate `final` checkpoint during review.
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
- Reuse upstream interaction behavior and accessible primitives without letting
  their demo composition become the product identity. Product-specific layout,
  typography, art direction, and content remain the selected direction's job.
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

For requested instruction/model comparisons, use
[the comparison contract](references/quality-rubric.md#instruction-or-model-comparisons) and preserve all design gates.

## 3. Review

Before completion:

1. Inspect the running browser surface or native application.
2. For web receipts, capture after screenshots at 390, 768, and 1440 pixels.
   For native macOS, follow [the native evidence contract](references/native-evidence.md).
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
4. Review the rendered surface against the selected direction and `qualityBar`.
   Use `$impeccable critique`, `polish`, and `audit` when available; otherwise
   perform and name a direct review rather than inventing an invocation. Record
   `evidence.visualReview` with reviewer, selected direction id, report path,
   and checks for hierarchy, typography, composition, identity, interaction,
   and responsive behavior. Every check needs a concrete observation; only
   interaction can be `not-applicable`, with a reason. The report must name
   observed defects, where they appear in rendered evidence, and how they were
   fixed. Generic styling, weak composition, or deviation from the selected
   direction is P1 when it undermines the brief, even if the UI works. Fix all
   P0/P1 findings and inspect the result again. Never invent an independent
   reviewer or equate a subjective self-score with owner acceptance.
   Read [the review rubric](references/quality-rubric.md) before assigning scores.
   Record dimension scores and evidence for the deductions; totals must match.
5. Run the project's smallest relevant build/check.
6. Fill the receipt with evidence paths, scores, unresolved counts, purpose
   comprehension result, and check command.

For paired landing/app products, also require `evidence.productContinuity` with
both rendered captures and passing concrete checks from its linked contract.
Individual scores cannot compensate for a mismatched or unverified pair.

The minimum floors come from `config/design-workflow.json`: purpose 85/100,
critique 32/40, audit 16/20, and zero unresolved P0/P1. Purpose and visual
scores stay separate. Never average them; visual craft cannot compensate for an
unclear or incorrect product promise. Scores are floors, not proof of taste.

Detector findings are advisory. Record them, but never rewrite an intentional
`DESIGN.md` decision only to silence an aesthetic heuristic.

Run the pinned local [slop-score runner](../../docs/slop-score.md) on the final
web render: `node <tooling-root>/scripts/slop-score.mjs <url> --json`.
Retain before evidence when an existing surface is available. Save raw reports
under the owning project's gitignored `.fleet-local/` directory and record
`evidence.slopScale` using that document's checkpoint contract. Include finding
dispositions and compare scores only with the same pin, definitions, preset,
viewport and page state. Direction-review records gate overhaul preflight;
iteration and final records gate completion for meaningful web work. The
numeric score stays advisory and separate from purpose, critique and audit:
there is no score ceiling. Failed/blocked scans remain unknown with concrete
errors, and native surfaces require a justified web-scanner exemption. Preserve
intentional choices; score reduction does not establish quality or acceptance.

## 4. Close with a decision record

For overhaul work, owner selection is a required approval gate. Record `keep`
when the owner selects or accepts a direction, or `delegated` when the owner
explicitly delegates judgment. Do not infer delegation from a broad request to
finish, improve, beautify, or release a product. Preserve the decision and note
in the receipt so the next design pass can learn from it. Preserve work needs a
question only when a material ambiguity would change product identity or scope.

Validate:

```bash
node <tooling-root>/scripts/design-workflow.mjs check --project <project-root>
```

Do not claim the meaningful visual change is complete until this command
passes. Follow [the output contract](references/quality-rubric.md#deliver-the-rendered-work):
show the rendered result, concrete fixes, remaining tradeoffs and verification.
Distinguish the direction decision from owner acceptance. Scores and receipts
support the deliverable; they do not establish its design quality.
